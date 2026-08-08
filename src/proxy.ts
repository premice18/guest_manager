import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const authRoutes = ["/login", "/register", "/forgot-password", "/reset-password"];
const protectedRoutes = ["/dashboard", "/event", "/reception"];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/+$/, "") || "/";

  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathname === route);

  // Crée la réponse AVANT le client Supabase pour pouvoir y propager les
  // cookies de session rafraîchis par Supabase (voir setAll ci-dessous).
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // ⚠️ Critique (fix audit) : les cookies de session (access + refresh,
          // réécrits lors de la rotation des tokens) doivent être positionnés
          // SUR LA RÉPONSE. Les écrire sur la requête les perdait : le navigateur
          // conservait d'anciens cookies révoqués → déconnexion silencieuse ~1h
          // après l'expiration de l'access token.
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Récupère l'utilisateur connecté. Une panne réseau/plateforme Supabase ne
  // doit PAS être confondue avec un état déconnecté (message trompeur) : on
  // laisse alors la requête continuer, la page se chargera côté serveur.
  let user: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  // Redirige vers la page de connexion si non authentifié sur une route protégée
  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    // Conserve la route d'ORIGINE (path + query) pour y revenir après connexion
    loginUrl.searchParams.set("next", pathname + (request.nextUrl.search || ""));
    return NextResponse.redirect(loginUrl);
  }

  // Redirige vers le dashboard si déjà connecté sur une page d'auth
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

// Matcher : exécute le proxy sur les pages uniquement (pas les assets statiques,
// pas les routes API qui gerent leur propre auth via requireEventAccess).
// NB : le rate-limit d'authentification n'est PAS géré ici — les tentatives de
// login passent directement par GoTrue (Supabase), jamais par le proxy. Un
// rate-limit fiable doit se faire côté Supabase (email rate limits) ou via une
// route API dédiée avec un store externe (à implémenter selon besoin).
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};