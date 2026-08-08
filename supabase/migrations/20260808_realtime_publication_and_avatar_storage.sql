-- ============================================================
-- Migration : 20260808_realtime_publication_and_avatar_storage.sql
-- Description : Active la synchronisation temps réel (Realtime)
--   et provisionne le bucket Storage des photos de profil.
--   1. Ajoute les tables métier à la publication supabase_realtime
--      (obligatoire pour recevoir les événements postgres_changes).
--   2. Définit REPLICA IDENTITY FULL pour que chaque événement
--      postgres_changes transporte la ligne complète (toutes colonnes).
--   3. Crée le bucket 'avatars' + politiques RLS Storage
--      (lecture publique des avatars, écriture réservée au
--      propriétaire du dossier <user_id>/).
-- ============================================================

-- ============================================================
-- 1. Publication Realtime
-- ============================================================
-- La table events alimente le dashboard et les gardes d'accès.
-- La table guests alimente la réception (check-in groupé) et les
-- statistiques en direct. tables/zones/event_staff sont ajoutées
-- par cohérence (envoi d'événements aux seuls utilisateurs autorisés
-- par RLS — SELECT uniquement pour les personnes concernées).
DO $$
DECLARE
  t text;
  tables_to_add text[] := ARRAY['events', 'zones', 'tables', 'guests', 'event_staff'];
BEGIN
  FOREACH t IN ARRAY tables_to_add
  LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$$;

-- ============================================================
-- 2. REPLICA IDENTITY FULL
-- ============================================================
-- Garantit que le payload d'un événement Realtime contienne la ligne
-- complète (l'application rehydrate l'invité depuis payload.new pour
-- vérifier le nom de table, la présence, etc.).
ALTER TABLE public.guests REPLICA IDENTITY FULL;
ALTER TABLE public.tables REPLICA IDENTITY FULL;
ALTER TABLE public.events REPLICA IDENTITY FULL;

-- ============================================================
-- 3. Bucket Storage 'avatars' + politiques RLS
-- ============================================================

-- Création du bucket (idempotent). Public : true pour servir l'image
-- via l'URL publique (/object/public/avatars/...) sans authentification.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE,
  5242880, -- 5 Mo max
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Avatars publics : n'importe quel utilisateur authentifié peut lire
-- (les images sont publiques, elles ne contiennent pas de PII sensible
-- et l'accès REST aux dossiers reste restreint).
DROP POLICY IF EXISTS "avatar_select" ON storage.objects;
CREATE POLICY "avatar_select"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

-- Insertion : uniquement dans SON dossier <user_id>/
-- (le chemin d'upload du profil est `${user.id}/profile.<ext>`).
DROP POLICY IF EXISTS "avatar_insert_own" ON storage.objects;
CREATE POLICY "avatar_insert_own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Mise à jour (upsert d'un nouvel avatar) : uniquement son dossier.
DROP POLICY IF EXISTS "avatar_update_own" ON storage.objects;
CREATE POLICY "avatar_update_own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Suppression (remplacement / suppression d'avatar) : uniquement son dossier.
DROP POLICY IF EXISTS "avatar_delete_own" ON storage.objects;
CREATE POLICY "avatar_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);