import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSafeRedirect } from "@/lib/redirect";

// Route de callback pour la confirmation d'email Supabase Auth
// Échange le code d'authentification contre une session utilisateur
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";

  // Si le paramètre « next » est fourni mais invalide, on retombe sur le dashboard
  const next = isSafeRedirect(nextParam) ? nextParam : "/dashboard";

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
