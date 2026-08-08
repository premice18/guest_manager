-- ============================================================
-- Migration : 20260806_fix_rls_host_and_capacity   (existante)
--   → 20260809 (addendum) : corrections d'intégrité placement
-- Description :
--  1. Le trigger PER ROW zz_guests_enforce_capacity bloquait la
--     simple édition d'un invité (nom/catégorie...) lorsqu'il est
--     assis sur une table pleine ou verrouillée : la comparaison
--     OLD.table_id = NEW.table_id comptait la place de l'invité
--     deux fois. On court-circuite désormais les mises à jour sans
--     changement de table.
--  2. Le déplacement d'un GROUPE (UPDATE multi-lignes) contournait
--     la vérification de capacité per-row (les lignes d'une même
--     statement ne sont pas visibles entre elles). Un trigger de
--     validation au niveau STATEMENT (relation de transition) re-
--     contrôle l'occupation ET le verrouillage de toutes les tables
--     touchées après l'instruction.
-- ============================================================

-- ============================================================
-- 1. Trigger row : même placement = aucun re-contrôle
-- ============================================================
CREATE OR REPLACE FUNCTION guests_enforce_table_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_capacity INTEGER;
  v_locked   BOOLEAN;
  v_occupied INTEGER;
BEGIN
  -- Même placement (mise à jour d'un champ non-position) : la capacité
  -- et le verrou ne sont pas remis en cause (édition de nom, notes...).
  IF TG_OP = 'UPDATE' AND OLD.table_id IS NOT DISTINCT FROM NEW.table_id THEN
    RETURN NEW;
  END IF;

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
-- 2. Trigger STATEMENT : re-vérification après les instructions
--    groupées (groupe entier, insertions par lots)
-- ============================================================
CREATE OR REPLACE FUNCTION guests_validate_group_statement()
RETURNS TRIGGER AS $$
DECLARE
  v_table_id UUID;
  v_locked   BOOLEAN;
  v_capacity INTEGER;
  v_count    BIGINT;
BEGIN
  -- Statement sans changement de placement (ex. mise à jour de présence) :
  -- rien à vérifier.
  IF NOT EXISTS (
    SELECT 1 FROM new_table nt WHERE nt.table_id IS NOT NULL
  ) THEN
    RETURN NULL;
  END IF;

  -- Re-contrôle l'état final de chaque table touchée par l'instruction.
  -- À ce stade, TOUTES les lignes de la mise à jour sont visibles, ce qui
  -- couvre les déplacements de groupe (angle mort du trigger per-row).
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

-- Remplace le trigger per-row existant (même nom que la migration 20260806)
-- pour prendre en compte la logique corrigée.
DROP TRIGGER IF EXISTS zz_guests_enforce_capacity ON guests;
CREATE TRIGGER zz_guests_enforce_capacity
  BEFORE INSERT OR UPDATE OF table_id ON guests
  FOR EACH ROW
  EXECUTE FUNCTION guests_enforce_table_capacity();

-- Un seul trigger par événement : PostgreSQL interdit les transition tables
-- (REFERENCING NEW TABLE) sur un trigger qui écoute plusieurs événements,
-- mais aussi sur un trigger avec une LISTE DE COLONNES (UPDATE OF ...).
-- La fonction ignore elle-même les statements sans changement de placement.
DROP TRIGGER IF EXISTS zz_guests_validate_statement_insert ON guests;
CREATE TRIGGER zz_guests_validate_statement_insert
  AFTER INSERT ON guests
  REFERENCING NEW TABLE AS new_table
  FOR EACH STATEMENT
  EXECUTE FUNCTION guests_validate_group_statement();

DROP TRIGGER IF EXISTS zz_guests_validate_statement_update ON guests;
CREATE TRIGGER zz_guests_validate_statement_update
  AFTER UPDATE ON guests
  REFERENCING NEW TABLE AS new_table
  FOR EACH STATEMENT
  EXECUTE FUNCTION guests_validate_group_statement();