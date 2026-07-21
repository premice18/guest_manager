-- ============================================================
-- Migration : 20260720_initial_schema.sql
-- Description : Schéma initial de la base de données
--               Guest Manager
-- ============================================================

-- 1. Création des types enum
-- ============================================================

DO $$ BEGIN
  CREATE TYPE age_category AS ENUM ('adult', 'child', 'baby');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE table_shape AS ENUM ('round', 'rectangular', 'imperial');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Création des tables
-- ============================================================

-- Table events : regroupe les informations générales d'un événement
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  location TEXT,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table zones : espaces (ex: Salle principale, Terrasse VIP)
CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, name)
);

-- Table tables : configuration des tables d'un événement
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  shape table_shape NOT NULL DEFAULT 'round',
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, name)
);

-- Table guests : invités d'un événement
CREATE TABLE IF NOT EXISTS guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  category TEXT,
  age_type age_category NOT NULL DEFAULT 'adult',
  dietary_notes TEXT,
  needs_accessibility BOOLEAN NOT NULL DEFAULT FALSE,
  is_present BOOLEAN NOT NULL DEFAULT FALSE,
  checked_in_at TIMESTAMPTZ,
  group_id UUID, -- identifiant partagé pour lier les membres d'un groupe
  group_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table event_staff : membres du personnel (admins & hosts)
CREATE TABLE IF NOT EXISTS event_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'host')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- 3. Index pour optimiser les performances
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_events_owner_id ON events(owner_id);
CREATE INDEX IF NOT EXISTS idx_zones_event_id ON zones(event_id);
CREATE INDEX IF NOT EXISTS idx_tables_event_id ON tables(event_id);
CREATE INDEX IF NOT EXISTS idx_tables_zone_id ON tables(zone_id);
CREATE INDEX IF NOT EXISTS idx_guests_event_id ON guests(event_id);
CREATE INDEX IF NOT EXISTS idx_guests_table_id ON guests(table_id);
CREATE INDEX IF NOT EXISTS idx_guests_group_id ON guests(group_id);
CREATE INDEX IF NOT EXISTS idx_guests_name_search ON guests(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_event_staff_event_id ON event_staff(event_id);
CREATE INDEX IF NOT EXISTS idx_event_staff_user_id ON event_staff(user_id);

-- 4. Activation de la sécurité niveau ligne (RLS)
-- ============================================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_staff ENABLE ROW LEVEL SECURITY;

-- 5. Politiques RLS
-- ============================================================

-- -- events --
-- Lecture : le propriétaire ou un membre du staff peut lire
DROP POLICY IF EXISTS "events_select_policy" ON events;
CREATE POLICY "events_select_policy" ON events
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM event_staff
      WHERE event_staff.event_id = events.id
        AND event_staff.user_id = auth.uid()
    )
  );

-- Insertion : seul l'utilisateur connecté peut créer un événement (il devient owner)
DROP POLICY IF EXISTS "events_insert_policy" ON events;
CREATE POLICY "events_insert_policy" ON events
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Modification : seul le owner ou un admin peut modifier
DROP POLICY IF EXISTS "events_update_policy" ON events;
CREATE POLICY "events_update_policy" ON events
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM event_staff
      WHERE event_staff.event_id = events.id
        AND event_staff.user_id = auth.uid()
        AND event_staff.role = 'admin'
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM event_staff
      WHERE event_staff.event_id = events.id
        AND event_staff.user_id = auth.uid()
        AND event_staff.role = 'admin'
    )
  );

-- Suppression : seul le owner peut supprimer
DROP POLICY IF EXISTS "events_delete_policy" ON events;
CREATE POLICY "events_delete_policy" ON events
  FOR DELETE
  USING (owner_id = auth.uid());

-- -- zones --
DROP POLICY IF EXISTS "zones_select_policy" ON zones;
CREATE POLICY "zones_select_policy" ON zones
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = zones.event_id
        AND (
          events.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM event_staff
            WHERE event_staff.event_id = events.id
              AND event_staff.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "zones_insert_policy" ON zones;
CREATE POLICY "zones_insert_policy" ON zones
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = zones.event_id
        AND (
          events.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM event_staff
            WHERE event_staff.event_id = events.id
              AND event_staff.user_id = auth.uid()
              AND event_staff.role = 'admin'
          )
        )
    )
  );

DROP POLICY IF EXISTS "zones_update_policy" ON zones;
CREATE POLICY "zones_update_policy" ON zones
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = zones.event_id
        AND (
          events.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM event_staff
            WHERE event_staff.event_id = events.id
              AND event_staff.user_id = auth.uid()
              AND event_staff.role = 'admin'
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = zones.event_id
        AND (
          events.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM event_staff
            WHERE event_staff.event_id = events.id
              AND event_staff.user_id = auth.uid()
              AND event_staff.role = 'admin'
          )
        )
    )
  );

DROP POLICY IF EXISTS "zones_delete_policy" ON zones;
CREATE POLICY "zones_delete_policy" ON zones
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = zones.event_id
        AND (
          events.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM event_staff
            WHERE event_staff.event_id = events.id
              AND event_staff.user_id = auth.uid()
              AND event_staff.role = 'admin'
          )
        )
    )
  );

-- -- tables --
DROP POLICY IF EXISTS "tables_select_policy" ON tables;
CREATE POLICY "tables_select_policy" ON tables
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = tables.event_id
        AND (
          events.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM event_staff
            WHERE event_staff.event_id = events.id
              AND event_staff.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "tables_insert_policy" ON tables;
CREATE POLICY "tables_insert_policy" ON tables
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = tables.event_id
        AND (
          events.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM event_staff
            WHERE event_staff.event_id = events.id
              AND event_staff.user_id = auth.uid()
              AND event_staff.role = 'admin'
          )
        )
    )
  );

DROP POLICY IF EXISTS "tables_update_policy" ON tables;
CREATE POLICY "tables_update_policy" ON tables
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = tables.event_id
        AND (
          events.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM event_staff
            WHERE event_staff.event_id = events.id
              AND event_staff.user_id = auth.uid()
              AND event_staff.role = 'admin'
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = tables.event_id
        AND (
          events.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM event_staff
            WHERE event_staff.event_id = events.id
              AND event_staff.user_id = auth.uid()
              AND event_staff.role = 'admin'
          )
        )
    )
  );

DROP POLICY IF EXISTS "tables_delete_policy" ON tables;
CREATE POLICY "tables_delete_policy" ON tables
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = tables.event_id
        AND (
          events.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM event_staff
            WHERE event_staff.event_id = events.id
              AND event_staff.user_id = auth.uid()
              AND event_staff.role = 'admin'
          )
        )
    )
  );

-- -- guests --
-- Lecture : tout membre du staff ou le owner peut voir les invités
DROP POLICY IF EXISTS "guests_select_policy" ON guests;
CREATE POLICY "guests_select_policy" ON guests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = guests.event_id
        AND (
          events.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM event_staff
            WHERE event_staff.event_id = events.id
              AND event_staff.user_id = auth.uid()
          )
        )
    )
  );

-- Insertion : le owner ou un admin peut créer un invité ; un host peut créer un walk-in
DROP POLICY IF EXISTS "guests_insert_policy" ON guests;
CREATE POLICY "guests_insert_policy" ON guests
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = guests.event_id
        AND (
          events.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM event_staff
            WHERE event_staff.event_id = events.id
              AND event_staff.user_id = auth.uid()
          )
        )
    )
  );

-- Modification : le owner ou un admin peut modifier tous les champs ;
-- un host ne peut modifier que is_present, checked_in_at et notes
DROP POLICY IF EXISTS "guests_update_policy" ON guests;
CREATE POLICY "guests_update_policy" ON guests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = guests.event_id
        AND (
          events.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM event_staff
            WHERE event_staff.event_id = events.id
              AND event_staff.user_id = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = guests.event_id
        AND (
          events.owner_id = auth.uid()
          OR (
            EXISTS (
              SELECT 1 FROM event_staff
              WHERE event_staff.event_id = events.id
                AND event_staff.user_id = auth.uid()
                AND event_staff.role = 'host'
            )
            -- Un host ne peut modifier que is_present, checked_in_at, notes
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
          OR events.owner_id = auth.uid()
        )
    )
  );

-- Suppression : seul le owner ou un admin peut supprimer un invité
DROP POLICY IF EXISTS "guests_delete_policy" ON guests;
CREATE POLICY "guests_delete_policy" ON guests
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = guests.event_id
        AND (
          events.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM event_staff
            WHERE event_staff.event_id = events.id
              AND event_staff.user_id = auth.uid()
              AND event_staff.role = 'admin'
          )
        )
    )
  );

-- -- event_staff --
-- Lecture : les membres de l'événement peuvent voir le staff
DROP POLICY IF EXISTS "event_staff_select_policy" ON event_staff;
CREATE POLICY "event_staff_select_policy" ON event_staff
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_staff.event_id
        AND (
          events.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM event_staff AS es
            WHERE es.event_id = events.id
              AND es.user_id = auth.uid()
          )
        )
    )
  );

-- Insertion : seul un admin peut ajouter un membre du staff
DROP POLICY IF EXISTS "event_staff_insert_policy" ON event_staff;
CREATE POLICY "event_staff_insert_policy" ON event_staff
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_staff.event_id
        AND (
          events.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM event_staff AS es
            WHERE es.event_id = events.id
              AND es.user_id = auth.uid()
              AND es.role = 'admin'
          )
        )
    )
  );

-- Suppression : seul un admin peut supprimer un membre du staff
DROP POLICY IF EXISTS "event_staff_delete_policy" ON event_staff;
CREATE POLICY "event_staff_delete_policy" ON event_staff
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_staff.event_id
        AND (
          events.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM event_staff AS es
            WHERE es.event_id = events.id
              AND es.user_id = auth.uid()
              AND es.role = 'admin'
          )
        )
    )
  );

-- 6. Trigger pour mettre à jour automatiquement updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_events_updated_at ON events;
DROP TRIGGER IF EXISTS set_zones_updated_at ON zones;
DROP TRIGGER IF EXISTS set_tables_updated_at ON tables;
DROP TRIGGER IF EXISTS set_guests_updated_at ON guests;

CREATE TRIGGER set_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_zones_updated_at
  BEFORE UPDATE ON zones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_tables_updated_at
  BEFORE UPDATE ON tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_guests_updated_at
  BEFORE UPDATE ON guests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();




