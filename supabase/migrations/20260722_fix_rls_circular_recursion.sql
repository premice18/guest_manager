-- ============================================================
-- Migration : 20260722_fix_rls_circular_recursion.sql
-- Description : Correction de la récursion circulaire entre
--               events et event_staff via SECURITY DEFINER
-- ============================================================

-- 1. Fonction utilitaire : vérifie si l'utilisateur est owner d'un événement
CREATE OR REPLACE FUNCTION is_owner_of_event(target_event_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM events
    WHERE events.id = target_event_id
      AND events.owner_id = auth.uid()
  );
$$;

-- 2. Fonction utilitaire : vérifie si l'utilisateur est admin du staff
CREATE OR REPLACE FUNCTION is_admin_of_event(target_event_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_staff
    WHERE event_staff.event_id = target_event_id
      AND event_staff.user_id = auth.uid()
      AND event_staff.role = 'admin'
  );
$$;

-- 3. Fonction utilitaire : vérifie si l'utilisateur est membre du staff
CREATE OR REPLACE FUNCTION is_staff_of_event(target_event_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_staff
    WHERE event_staff.event_id = target_event_id
      AND event_staff.user_id = auth.uid()
  );
$$;

-- 4. Suppression de toutes les anciennes politiques
DROP POLICY IF EXISTS "events_select_policy" ON events;
DROP POLICY IF EXISTS "events_insert_policy" ON events;
DROP POLICY IF EXISTS "events_update_policy" ON events;
DROP POLICY IF EXISTS "events_delete_policy" ON events;
DROP POLICY IF EXISTS "zones_select_policy" ON zones;
DROP POLICY IF EXISTS "zones_insert_policy" ON zones;
DROP POLICY IF EXISTS "zones_update_policy" ON zones;
DROP POLICY IF EXISTS "zones_delete_policy" ON zones;
DROP POLICY IF EXISTS "tables_select_policy" ON tables;
DROP POLICY IF EXISTS "tables_insert_policy" ON tables;
DROP POLICY IF EXISTS "tables_update_policy" ON tables;
DROP POLICY IF EXISTS "tables_delete_policy" ON tables;
DROP POLICY IF EXISTS "guests_select_policy" ON guests;
DROP POLICY IF EXISTS "guests_insert_policy" ON guests;
DROP POLICY IF EXISTS "guests_update_policy" ON guests;
DROP POLICY IF EXISTS "guests_delete_policy" ON guests;
DROP POLICY IF EXISTS "event_staff_select_policy" ON event_staff;
DROP POLICY IF EXISTS "event_staff_insert_policy" ON event_staff;
DROP POLICY IF EXISTS "event_staff_delete_policy" ON event_staff;

-- 5. Nouvelles politiques utilisant les fonctions SECURITY DEFINER
--    pour éviter toute récursion

-- events
CREATE POLICY "events_select_policy" ON events
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR is_staff_of_event(events.id)
  );

CREATE POLICY "events_insert_policy" ON events
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "events_update_policy" ON events
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR is_admin_of_event(events.id)
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR is_admin_of_event(events.id)
  );

CREATE POLICY "events_delete_policy" ON events
  FOR DELETE
  USING (owner_id = auth.uid());

-- zones
CREATE POLICY "zones_select_policy" ON zones
  FOR SELECT
  USING (
    is_owner_of_event(zones.event_id)
    OR is_staff_of_event(zones.event_id)
  );

CREATE POLICY "zones_insert_policy" ON zones
  FOR INSERT
  WITH CHECK (
    is_owner_of_event(zones.event_id)
    OR is_admin_of_event(zones.event_id)
  );

CREATE POLICY "zones_update_policy" ON zones
  FOR UPDATE
  USING (
    is_owner_of_event(zones.event_id)
    OR is_admin_of_event(zones.event_id)
  )
  WITH CHECK (
    is_owner_of_event(zones.event_id)
    OR is_admin_of_event(zones.event_id)
  );

CREATE POLICY "zones_delete_policy" ON zones
  FOR DELETE
  USING (
    is_owner_of_event(zones.event_id)
    OR is_admin_of_event(zones.event_id)
  );

-- tables
CREATE POLICY "tables_select_policy" ON tables
  FOR SELECT
  USING (
    is_owner_of_event(tables.event_id)
    OR is_staff_of_event(tables.event_id)
  );

CREATE POLICY "tables_insert_policy" ON tables
  FOR INSERT
  WITH CHECK (
    is_owner_of_event(tables.event_id)
    OR is_admin_of_event(tables.event_id)
  );

CREATE POLICY "tables_update_policy" ON tables
  FOR UPDATE
  USING (
    is_owner_of_event(tables.event_id)
    OR is_admin_of_event(tables.event_id)
  )
  WITH CHECK (
    is_owner_of_event(tables.event_id)
    OR is_admin_of_event(tables.event_id)
  );

CREATE POLICY "tables_delete_policy" ON tables
  FOR DELETE
  USING (
    is_owner_of_event(tables.event_id)
    OR is_admin_of_event(tables.event_id)
  );

-- guests
CREATE POLICY "guests_select_policy" ON guests
  FOR SELECT
  USING (
    is_owner_of_event(guests.event_id)
    OR is_staff_of_event(guests.event_id)
  );

CREATE POLICY "guests_insert_policy" ON guests
  FOR INSERT
  WITH CHECK (
    is_owner_of_event(guests.event_id)
    OR is_staff_of_event(guests.event_id)
  );

CREATE POLICY "guests_update_policy" ON guests
  FOR UPDATE
  USING (
    is_owner_of_event(guests.event_id)
    OR is_staff_of_event(guests.event_id)
  )
  WITH CHECK (
    is_owner_of_event(guests.event_id)
    OR (
      is_staff_of_event(guests.event_id)
      AND (
        (guests.first_name IS NOT DISTINCT FROM first_name)
        AND (guests.last_name IS NOT DISTINCT FROM last_name)
        AND (guests.category IS NOT DISTINCT FROM category)
        AND (guests.age_type IS NOT DISTINCT FROM age_type)
        AND (guests.dietary_notes IS NOT DISTINCT FROM dietary_notes)
        AND (guests.needs_accessibility IS NOT DISTINCT FROM needs_accessibility)
        AND (guests.table_id IS NOT DISTINCT FROM table_id)
        AND (guests.group_id IS NOT DISTINCT FROM group_id)
        AND (guests.group_name IS NOT DISTINCT FROM group_name)
      )
    )
  );

CREATE POLICY "guests_delete_policy" ON guests
  FOR DELETE
  USING (
    is_owner_of_event(guests.event_id)
    OR is_admin_of_event(guests.event_id)
  );

-- event_staff
CREATE POLICY "event_staff_select_policy" ON event_staff
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_owner_of_event(event_staff.event_id)
  );

CREATE POLICY "event_staff_insert_policy" ON event_staff
  FOR INSERT
  WITH CHECK (
    is_owner_of_event(event_staff.event_id)
    OR is_admin_of_event(event_staff.event_id)
  );

CREATE POLICY "event_staff_delete_policy" ON event_staff
  FOR DELETE
  USING (
    is_owner_of_event(event_staff.event_id)
    OR is_admin_of_event(event_staff.event_id)
  );
