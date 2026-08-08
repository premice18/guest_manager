-- ============================================================
-- Migration : 20260810_fix_host_guard_cross_event.sql
-- Description : Correctif de sécurité (audit 20260802) — faille
--   « cross-event » sur la gestion des invités.
--   Un host de l'événement A, owner d'un événement B, pouvait modifier
--   `event_id` des invités de A vers B : le trigger zz_guests_host_guard
--   ne testait que NEW.event_id (l'événement cible, dont il est owner),
--   et le WITH CHECK RLS passait puisque l'événement cible est le sien.
--   Correctifs :
--   1. Nouveau guard « event_id immuable » : le champ event_id ne peut
--      changer que si l'utilisateur est owner des DEUX événements.
--   2. Le host-guard vérifie désormais le rôle sur OLD.event_id et non
--      plus seulement NEW.event_id.
--   3. events : interdiction pour un admin de se nommer owner_id.
-- ============================================================

-- ============================================================
-- 1. Guard « event_id immuable » sur les invités
-- ============================================================
CREATE OR REPLACE FUNCTION guests_event_id_guard()
RETURNS TRIGGER AS $$
BEGIN
  -- Un invité appartient à un événement pour toujours. Seul le
  -- propriétaire des DEUX événements (source et cible) peut le
  -- transférer (import de données, fusion de listes).
  IF NEW.event_id IS DISTINCT FROM OLD.event_id
     AND NOT (
       is_owner_of_event(OLD.event_id)
       AND is_owner_of_event(NEW.event_id)
     )
  THEN
    RAISE EXCEPTION 'Le changement d''événement d''un invité est interdit'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS zz_guests_event_id_guard ON guests;
CREATE TRIGGER zz_guests_event_id_guard
  BEFORE UPDATE OF event_id ON guests
  FOR EACH ROW
  EXECUTE FUNCTION guests_event_id_guard();

-- ============================================================
-- 2. Hardening du host-guard : vérifie le rôle sur l'événement
--    d'origine (OLD) en plus de la cible (NEW).
-- ============================================================
CREATE OR REPLACE FUNCTION guests_host_field_guard()
RETURNS TRIGGER AS $$
BEGIN
  -- Un staff (host) ne peut modifier que la présence, que son rôle soit
  -- déclaré sur l'événement d'origine ou sur la cible. Le owner gauche
  -- tous les champs.
  IF (
       is_staff_of_event(OLD.event_id)
       OR is_staff_of_event(NEW.event_id)
     )
     AND NOT is_owner_of_event(OLD.event_id)
     AND NOT is_owner_of_event(NEW.event_id)
     AND NOT is_admin_of_event(OLD.event_id)
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
-- 3. events : un admin ne peut pas se nommer lui-même owner_id
-- ============================================================
CREATE OR REPLACE FUNCTION events_owner_id_guard()
RETURNS TRIGGER AS $$
BEGIN
  -- Seul le propriétaire actuel peut transférer la propriété. Un admin
  -- (non-owner) ne peut pas se déclarer owner.
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
     AND NOT is_owner_of_event(OLD.id)
  THEN
    RAISE EXCEPTION 'Seul le propriétaire peut transférer l''événement'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS zz_events_owner_id_guard ON events;
CREATE TRIGGER zz_events_owner_id_guard
  BEFORE UPDATE OF owner_id ON events
  FOR EACH ROW
  EXECUTE FUNCTION events_owner_id_guard();