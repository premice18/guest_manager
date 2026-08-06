-- ============================================================
-- Migration : 20260806_fix_rls_host_and_capacity.sql
-- Description : Correction de deux failles d'autorisation/intégrité
--  1. RLS « guests_update_policy » : la restriction des hôtes
--     (comparaisons NEW vs NEW) était inopérante. RLS n'a pas accès
--     à la ligne OLD, donc la logique de colonnes est déportée dans
--     un trigger BEFORE UPDATE.
--  2. Intégrité : capacité et verrouillage des tables n'étaient
--     vérifiés QUE côté client. Ajout d'un trigger qui les fait
--     respecter en base.
-- ============================================================

-- ============================================================
-- 1. Correctif de la politique de mise à jour des invités
-- ============================================================
-- La politique WITH CHECK devient simple : owner OU staff peuvent
-- mettre à jour. La vérification fine (host ne peut toucher qu'à la
-- présence) est garantie par le trigger zz_guests_host_guard ci-après,
-- qui a accès à OLD et NEW.
DROP POLICY IF EXISTS "guests_update_policy" ON guests;
CREATE POLICY "guests_update_policy" ON guests
  FOR UPDATE
  USING (
    is_owner_of_event(guests.event_id)
    OR is_staff_of_event(guests.event_id)
  )
  WITH CHECK (
    is_owner_of_event(guests.event_id)
    OR is_staff_of_event(guests.event_id)
  );

-- ============================================================
-- 2. Trigger : un host ne peut modifier que la présence
-- ============================================================
CREATE OR REPLACE FUNCTION guests_host_field_guard()
RETURNS TRIGGER AS $$
BEGIN
  -- Un host (non owner, non admin) ne peut modifier que is_present,
  -- checked_in_at et notes. Tout autre champ modifié => refus.
  IF is_staff_of_event(NEW.event_id)
     AND NOT is_owner_of_event(NEW.event_id)
     AND NOT is_admin_of_event(NEW.event_id)
     AND (
       NEW.first_name IS DISTINCT FROM OLD.first_name
       OR NEW.last_name IS DISTINCT FROM OLD.last_name
       OR NEW.category IS DISTINCT FROM OLD.category
       OR NEW.age_type IS DISTINCT FROM OLD.age_type
       OR NEW.dietary_notes IS DISTINCT FROM OLD.dietary_notes
       OR NEW.needs_accessibility IS DISTINCT FROM OLD.needs_accessibility
       OR NEW.table_id IS DISTINCT FROM OLD.table_id
       OR NEW.group_id IS DISTINCT FROM OLD.group_id
       OR NEW.group_name IS DISTINCT FROM OLD.group_name
       OR NEW.event_id IS DISTINCT FROM OLD.event_id
     )
  THEN
    RAISE EXCEPTION 'Un hôte ne peut modifier que la présence d''un invité'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS zz_guests_host_guard ON guests;
CREATE TRIGGER zz_guests_host_guard
  BEFORE UPDATE ON guests
  FOR EACH ROW
  EXECUTE FUNCTION guests_host_field_guard();

-- ============================================================
-- 3. Trigger : capacité et verrouillage des tables en base
-- ============================================================
CREATE OR REPLACE FUNCTION guests_enforce_table_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_capacity INTEGER;
  v_locked   BOOLEAN;
  v_occupied INTEGER;
  v_self_delta INTEGER;
BEGIN
  IF NEW.table_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verrouille la ligne de la table afin de sérialiser les check-ins
  -- concurrents ciblant la même table (évite la course en écriture).
  SELECT t.capacity, t.is_locked
    INTO v_capacity, v_locked
    FROM tables t
   WHERE t.id = NEW.table_id
     FOR UPDATE;

  -- Table introuvable : on laisse RLS/les FK gérer
  IF v_capacity IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_locked THEN
    RAISE EXCEPTION 'La table % est verrouillée', NEW.table_id
      USING ERRCODE = '23514'; -- check_violation
  END IF;

  -- Nombre de places occupées hors cette ligne
  v_self_delta := CASE WHEN TG_OP = 'INSERT' THEN 0
                       WHEN OLD.table_id = NEW.table_id THEN 1
                       ELSE 0 END;
  SELECT COUNT(*) INTO v_occupied
    FROM guests
   WHERE table_id = NEW.table_id
     AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');

  IF v_occupied + v_self_delta >= v_capacity THEN
    RAISE EXCEPTION 'Capacité dépassée pour la table % (limite %)',
      NEW.table_id, v_capacity
      USING ERRCODE = '23514'; -- check_violation
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur l'insertion et le changement de table
DROP TRIGGER IF EXISTS zz_guests_enforce_capacity ON guests;
CREATE TRIGGER zz_guests_enforce_capacity
  BEFORE INSERT OR UPDATE OF table_id ON guests
  FOR EACH ROW
  EXECUTE FUNCTION guests_enforce_table_capacity();
