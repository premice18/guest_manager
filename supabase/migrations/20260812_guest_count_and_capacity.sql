-- ============================================================
-- Migration : 20260812_guest_count_and_capacity.sql
-- Description : Invitations "comptant pour plusieurs" + capacité
--               des tables basée sur la somme des guest_count.
--  1. Ajout de la colonne guests.guest_count (>= 1, défaut 1).
--  2. Le trigger host guard interdit la modification de guest_count
--     par un hôte (champ métadonnées réservé owner/admin).
--  3. Les triggers de capacité (per-row + statement INSERT + statement
--     UPDATE) utilisent désormais SUM(guest_count) au lieu de COUNT(*).
-- ============================================================

-- ============================================================
-- 1. Colonne guest_count sur guests
-- ============================================================
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS guest_count INTEGER NOT NULL DEFAULT 1
  CHECK (guest_count >= 1);

-- Index pratique pour un accès groupé par table
CREATE INDEX IF NOT EXISTS idx_guests_table_id_count
  ON guests(table_id, guest_count);

-- ============================================================
-- 2. Trigger host guard : guest_count est un champ métadonnées
-- ============================================================
DROP TRIGGER IF EXISTS zz_guests_host_guard ON guests;
CREATE TRIGGER zz_guests_host_guard
  BEFORE UPDATE ON guests
  FOR EACH ROW
  EXECUTE FUNCTION guests_host_field_guard();

CREATE OR REPLACE FUNCTION guests_host_field_guard()
RETURNS TRIGGER AS $$
BEGIN
  -- Un host (non owner, non admin) ne peut modifier que is_present,
  -- checked_in_at et notes. Tout autre champ modifié (dont guest_count)
  -- => refus.
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
       OR NEW.guest_count IS DISTINCT FROM OLD.guest_count
       OR NEW.event_id IS DISTINCT FROM OLD.event_id
     )
  THEN
    RAISE EXCEPTION 'Un hôte ne peut modifier que la présence d''un invité'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. Trigger per-row : capacité basée sur la somme des guest_count
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

  -- Placement nul (retrait complet) : rien de plus à vérifier.
  IF NEW.table_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verrouille la ligne de la table afin de sérialiser les opérations
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

  -- Somme des personnes déjà occupées hors cette ligne. Sur un changement
  -- de table, l'invité est pour l'instant compté sur son ANCIENNE table.
  SELECT COALESCE(SUM(guest_count), 0) INTO v_occupied
    FROM guests
   WHERE table_id = NEW.table_id
     AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');

  -- L'invité placé compte pour NEW.guest_count personnes physiques.
  IF v_occupied + NEW.guest_count > v_capacity THEN
    RAISE EXCEPTION 'Capacité dépassée pour la table % (limite %)',
      NEW.table_id, v_capacity
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. Trigger statement INSERT : re-contrôle après insertion par lots
-- ============================================================
CREATE OR REPLACE FUNCTION guests_validate_group_statement()
RETURNS TRIGGER AS $$
DECLARE
  v_table_id UUID;
  v_locked   BOOLEAN;
  v_capacity INTEGER;
  v_count    BIGINT;
BEGIN
  -- Statement sans changement de placement : rien à vérifier.
  IF NOT EXISTS (
    SELECT 1 FROM new_table nt WHERE nt.table_id IS NOT NULL
  ) THEN
    RETURN NULL;
  END IF;

  -- Re-contrôle l'état final de chaque table touchée par l'instruction.
  FOR v_table_id IN
    SELECT DISTINCT nt.table_id
      FROM new_table nt
     WHERE nt.table_id IS NOT NULL
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

    -- Occupation en personnes physiques (somme des guest_count)
    SELECT COALESCE(SUM(guest_count), 0) INTO v_count
      FROM guests
     WHERE table_id = v_table_id;

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
-- 5. Trigger statement UPDATE : re-contrôle des déplacements de groupe
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
    SELECT COALESCE(SUM(guest_count), 0) INTO v_count
      FROM guests
     WHERE table_id = v_table_id;

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
-- 6. Re-création des triggers après remplacement des fonctions
-- ============================================================
DROP TRIGGER IF EXISTS zz_guests_enforce_capacity ON guests;
CREATE TRIGGER zz_guests_enforce_capacity
  BEFORE INSERT OR UPDATE OF table_id ON guests
  FOR EACH ROW
  EXECUTE FUNCTION guests_enforce_table_capacity();

DROP TRIGGER IF EXISTS zz_guests_validate_statement_insert ON guests;
CREATE TRIGGER zz_guests_validate_statement_insert
  AFTER INSERT ON guests
  REFERENCING NEW TABLE AS new_table
  FOR EACH STATEMENT
  EXECUTE FUNCTION guests_validate_group_statement();

DROP TRIGGER IF EXISTS zz_guests_validate_statement_update ON guests;
CREATE TRIGGER zz_guests_validate_statement_update
  AFTER UPDATE ON guests
  REFERENCING OLD TABLE AS old_table NEW TABLE AS new_table
  FOR EACH STATEMENT
  EXECUTE FUNCTION guests_validate_group_statement_update();