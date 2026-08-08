-- ============================================================
-- Migration : 20260811_hardening_security.sql
-- Description : Durcissement de la sécurité (recommandations de
--               l'audit sécurité complet - audit_complet.md)
--  1. REVOKE/GRANT sur les fonctions SECURITY DEFINER (plus
--     exécutables par anon, uniquement par authenticated).
--  2. FORCE ROW LEVEL SECURITY sur les 5 tables.
--  3. Index composite event_staff(event_id, user_id).
--  4. Politique UPDATE sur event_staff (changement de rôle).
--  5. CHECK d'intégrité is_present ⇔ checked_in_at sur guests.
-- ============================================================

-- ============================================================
-- 1. Restreindre l'exécution des fonctions helper
-- ============================================================
-- Les fonctions SECURITY DEFINER (utilisées par les policies RLS) sont
-- exécutées avec les droits du propriétaire (postgres) : elles ne doivent
-- PAS être appelables par public/anon. On ne laisse que authenticated,
-- ce qui suffit au moteur RLS et à l'application.
REVOKE ALL ON FUNCTION public.is_owner_of_event(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_of_event(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff_of_event(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_owner_of_event(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_of_event(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_of_event(UUID) TO authenticated;

-- ============================================================
-- 2. FORCE ROW LEVEL SECURITY — verrouillage en base
-- ============================================================
-- Empêche le propriétaire de la table (postgres lui-même via le dashboard)
-- de contourner RLS par inadvertance. Les triggers/seed restent autorisés,
-- mais toute requête passant par un rôle non "bypassrls" est filtrée.
ALTER TABLE events     FORCE ROW LEVEL SECURITY;
ALTER TABLE zones      FORCE ROW LEVEL SECURITY;
ALTER TABLE tables     FORCE ROW LEVEL SECURITY;
ALTER TABLE guests     FORCE ROW LEVEL SECURITY;
ALTER TABLE event_staff FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Index composite pour les accès RLS les plus fréquents
-- ============================================================
-- Lecture la plus courante : (event_id, user_id) dans event_staff pour
-- is_staff_of_event / is_admin_of_event. Remplace avantageusement les
-- deux index simples créés initialement.
CREATE INDEX IF NOT EXISTS idx_event_staff_event_user
  ON event_staff(event_id, user_id);

-- ============================================================
-- 4. Politique UPDATE sur event_staff
-- ============================================================
-- Un changement de rôle d'un membre (ex. host -> admin) exigeait
-- DELETE + INSERT. Ajout d'une politique UPDATE réservée aux owners
-- et admins. Comme RLS n'a accès qu'à la ligne NEW, la ré-assignation
-- du membre à un autre événement/utilisateur est bloquée côté serveur
-- par un trigger (pattern déjà utilisé pour les hôtes).
DROP POLICY IF EXISTS "event_staff_update_policy" ON event_staff;
CREATE POLICY "event_staff_update_policy" ON event_staff
  FOR UPDATE
  USING (
    is_owner_of_event(event_staff.event_id)
    OR is_admin_of_event(event_staff.event_id)
  );

CREATE OR REPLACE FUNCTION event_staff_update_guard()
RETURNS TRIGGER AS $$
BEGIN
  -- Interdit de ré-associer une ligne (event_id / user_id sont
  -- immuables). Seul le rôle peut évoluer.
  IF NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'Impossible de ré-associer un membre à un autre événement ou utilisateur'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS zz_event_staff_update_guard ON event_staff;
CREATE TRIGGER zz_event_staff_update_guard
  BEFORE UPDATE ON event_staff
  FOR EACH ROW
  EXECUTE FUNCTION event_staff_update_guard();

-- ============================================================
-- 5. Intégrité : is_present cohérent avec checked_in_at
-- ============================================================
-- Les deux champs se décident ensemble (check-in/check-out). Une base
-- de données de présence doit rester cohérente : toute entrée présente
-- a forcément une heure de check-in, et réciproquement.
-- On normalise d'abord les éventuelles données héritées incohérentes
-- (is_present=true avec checked_in_at=NULL) pour que le ADD CONSTRAINT
-- ne puisse pas échouer la migration.
UPDATE guests
   SET checked_in_at = NOW()
 WHERE is_present = TRUE AND checked_in_at IS NULL;

ALTER TABLE guests
  DROP CONSTRAINT IF EXISTS guests_check_presence_consistency;
ALTER TABLE guests
  ADD CONSTRAINT guests_check_presence_consistency
  CHECK (is_present = (checked_in_at IS NOT NULL));

-- ============================================================
-- 6. Réordonnancement atomique des tables
-- ============================================================
-- Le réordonnancement côté client en 2 UPDATE séparés n'est pas atomique :
-- une panne entre les deux laissait les sort_order incohérents. Cette
-- fonction remplace la liste complète des sort_order en une seule
-- instruction à l'intérieur d'une transaction. Elle est SECURITY DEFINER
-- (héritage des droits du propriétaire pour lire tables/event_staff sans
-- retourner à RLS en cascade), avec search_path verrouillé et accès limité
-- aux owners/admins via la même logique que les policies.
CREATE OR REPLACE FUNCTION reorder_tables(target_event_id UUID, table_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_position INTEGER;
  v_tid UUID;
BEGIN
  -- Seul le propriétaire de l'événement (ou un admin du staff) peut
  -- réordonner TOUTES les tables de l'événement.
  v_is_admin := is_owner_of_event(target_event_id)
                OR is_admin_of_event(target_event_id);
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Accès refusé'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  -- Toutes les tables listées doivent appartenir à target_event_id
  -- (garde anti-cross-event : empêche de réordonner les tables d'un autre
  -- événement via l'argument).
  IF EXISTS (
    SELECT 1 FROM unnest(table_ids) AS t(tid)
    LEFT JOIN tables tb ON tb.id = t.tid
    WHERE tb.id IS NULL OR tb.event_id <> target_event_id
  ) THEN
    RAISE EXCEPTION 'Table invalide pour cet événement'
      USING ERRCODE = '23503'; -- foreign_key_violation
  END IF;

  -- Remplace les sort_order en une seule instruction dans la transaction
  -- (l'ordre de l'array définit 1, 2, 3...).
  v_position := 0;
  FOREACH v_tid IN ARRAY table_ids
  LOOP
    v_position := v_position + 1;
    UPDATE tables
       SET sort_order = v_position,
           updated_at = NOW()
     WHERE id = v_tid
       AND event_id = target_event_id;
  END LOOP;
END;
$$;

-- Verrouillage : seule une requête authentifiée peut exécuter reorder_tables.
REVOKE ALL ON FUNCTION public.reorder_tables(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_tables(UUID, UUID[]) TO authenticated;