-- ============================================================
-- Migration : 20260810_fix_trigger_checkin_locked.sql
-- Description : Correctif de sécurité fonctionnelle (audit 20260802).
--   Le trigger STATEMENT de la migration 20260809 re-scanne la TOTALITE
--   des lignes NEW et lève `is_locked` même quand l'instruction ne touche
--   pas au placement (ex : un simple check-in `UPDATE is_present` d'un
--   invité assis sur une table verrouillée).
--   Correctif : le trigger UPDATE ne re-valide la capacité/le verrou QUE
--   sur les lignes dont `table_id` a réellement changé.
-- ============================================================

-- ============================================================
-- 1. Trigger per-row : re-vérifie aussi le verrou de l'ANCIENNE table
--    (aucun mouvement entrant/sortant sur une table verrouillée), mais
--    jamais les mises à jour qui ne touchent pas au placement.
-- ============================================================
CREATE OR REPLACE FUNCTION guests_enforce_table_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_capacity INTEGER;
  v_locked   BOOLEAN;
  v_occupied INTEGER;
BEGIN
  -- Même placement (mise à jour d'un champ non-position : check-in,
  -- édition de nom, notes...) : la capacité et le verrou ne sont pas
  -- remis en cause.
  IF TG_OP = 'UPDATE' AND OLD.table_id IS NOT DISTINCT FROM NEW.table_id THEN
    RETURN NEW;
  END IF;

  -- Retrait / changement de table : l'ancienne table, si elle est
  -- verrouillée, ne permet aucune exportation de l'invité.
  IF TG_OP = 'UPDATE' AND OLD.table_id IS NOT NULL THEN
    SELECT is_locked INTO v_locked
      FROM tables
     WHERE id = OLD.table_id;
    IF v_locked THEN
      RAISE EXCEPTION 'La table % est verrouillée', OLD.table_id
        USING ERRCODE = '23514'; -- check_violation
    END IF;
  END IF;

  -- Placement nul (retrait complet) : rien de plus à vérier.
  IF NEW.table_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verrouille la ligne de la table afin de sérialiser les operations
  -- concurrentes ciblant la même table (évite la course en écriture).
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
      USING ERRCODE = '23514';
  END IF;

  -- Nombre de places occupées hors cette ligne. Sur un changement de
  -- table, l'invité est pour l'instant compté sur son ANCIENNE table.
  SELECT COUNT(*) INTO v_occupied
    FROM guests
   WHERE table_id = NEW.table_id
     AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');

  IF v_occupied >= v_capacity THEN
    RAISE EXCEPTION 'Capacité dépassée pour la table % (limite %)',
      NEW.table_id, v_capacity
      USING ERRCODE = '23514'; -- check_violation
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. Fonction STATEMENT additionnelle : re-contrôle des groupes.
--    Elle ne s'applique QUE si au moins une ligne a changé de table
--    (OLD.table_id != NEW.table_id). Un check-in sur une table
--    verrouillée ne déclenche plus jamais d'exception.
-- ============================================================
CREATE OR REPLACE FUNCTION guests_validate_group_statement_update()
RETURNS TRIGGER AS $$
DECLARE
  v_table_id UUID;
  v_locked   BOOLEAN;
  v_capacity INTEGER;
  v_count    BIGINT;
BEGIN
  -- Aucun changement de placement dans l'instruction ? Rien à vérifier
  -- (check-in, édition, notes...).
  IF NOT EXISTS (
    SELECT 1
      FROM new_table nt
      JOIN old_table ot ON ot.id = nt.id
     WHERE nt.table_id IS DISTINCT FROM ot.table_id
  ) THEN
    RETURN NULL;
  END IF;

  -- Tables de source : interdiction de sortir d'une table verrouillée,
  -- même lors d'un déplacement de groupe (la source est visible dans
  -- old_table, invisible au trigger per-row).
  IF EXISTS (
    SELECT 1
      FROM old_table ot
      JOIN new_table nt ON nt.id = ot.id
      JOIN tables src ON src.id = ot.table_id
     WHERE ot.table_id IS DISTINCT FROM nt.table_id
       AND src.is_locked
  ) THEN
    RAISE EXCEPTION 'Une des tables de provenance est verrouillée'
      USING ERRCODE = '23514';
  END IF;

  -- Tables de destination (table_id présent dans NEW et réellement
  -- modifié) : verrou + capacité.
  FOR v_table_id IN
    SELECT DISTINCT nt.table_id
      FROM new_table nt
      JOIN old_table ot ON ot.id = nt.id
     WHERE nt.table_id IS DISTINCT FROM ot.table_id
       AND nt.table_id IS NOT NULL
  LOOP
    SELECT m.is_locked, m.capacity
      INTO v_locked, v_capacity
      FROM tables m
     WHERE m.id = v_table_id;

    IF v_capacity IS NULL THEN
      CONTINUE;
    END IF;

    IF v_locked THEN
      RAISE EXCEPTION 'La table % est verrouillée', v_table_id
        USING ERRCODE = '23514';
    END IF;

    -- À ce stade, TOUTES les lignes de la mise à jour sont visibles,
    -- ce qui couvre les déplacements de groupe (angle mort per-row).
    SELECT COUNT(*) INTO v_count FROM guests WHERE table_id = v_table_id;

    IF v_count > v_capacity THEN
      RAISE EXCEPTION
        'Capacité dépassée pour la table % (limite %, occupation %)',
        v_table_id, v_capacity, v_count
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. Triggers
-- ============================================================

-- Trigger per-row : même que 20260809 mais avec la vérification de
-- l'ancienne table (sortie d'une table verrouillée interdite).
DROP TRIGGER IF EXISTS zz_guests_enforce_capacity ON guests;
CREATE TRIGGER zz_guests_enforce_capacity
  BEFORE INSERT OR UPDATE OF table_id ON guests
  FOR EACH ROW
  EXECUTE FUNCTION guests_enforce_table_capacity();

-- Trigger statement INSERT : inchangé (les transcripts n'ont pas de OLD).
DROP TRIGGER IF EXISTS zz_guests_validate_statement_insert ON guests;
CREATE TRIGGER zz_guests_validate_statement_insert
  AFTER INSERT ON guests
  REFERENCING NEW TABLE AS new_table
  FOR EACH STATEMENT
  EXECUTE FUNCTION guests_validate_group_statement();

-- Trigger statement UPDATE : re-écrit pour ne valider QUE les placements
-- (compare OLD/NEW). Le check-in ne déclenche plus de re-vérification.
DROP TRIGGER IF EXISTS zz_guests_validate_statement_update ON guests;
CREATE TRIGGER zz_guests_validate_statement_update
  AFTER UPDATE ON guests
  REFERENCING OLD TABLE AS old_table NEW TABLE AS new_table
  FOR EACH STATEMENT
  EXECUTE FUNCTION guests_validate_group_statement_update();