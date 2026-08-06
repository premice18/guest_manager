import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Valide que la cible de redirection est un chemin local (évite l'open redirect)
function isSafeRedirectPath(value: string): boolean {
  // Rejette les URLs absolues, les protocoles et les chemins protocol-relative (//...)
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  // Rejette tout qui ressemble à une URL absolue (ex: /\/evil.com)
  if (value.startsWith("/\\")) return false;
  try {
    const url = new URL(value, "http://localhost");
    return url.origin === "http://localhost";
  } catch {
    return false;
  }
}

// Route de callback pour la confirmation d'email Supabase Auth
// Échange le code d'authentification contre une session utilisateur
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";

  // Si le paramètre « next » est fourni mais invalide, on retombe sur le dashboard
  const next = isSafeRedirectPath(nextParam) ? nextParam : "/dashboard";

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } catch {
      // En cas d'erreur, on redirige vers la page de connexion
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
