import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

// Crée un client Supabase pour le navigateur (côté client)
// Utilisé dans les pages interactives (formulaires, composants)
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
