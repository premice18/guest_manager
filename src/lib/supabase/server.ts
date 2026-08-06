import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

// Crée un client Supabase pour le serveur (Server Components, Server Actions, Route Handlers)
// Utilise les cookies HTTP pour gérer la session utilisateur
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Le client serveur ne peut pas modifier les cookies pendant le rendu
            // d'un Server Component. Ignoré ici car le proxy (src/proxy.ts)
            // rafraîchit déjà la session à chaque requête.
          }
        },
      },
    }
  );
}
