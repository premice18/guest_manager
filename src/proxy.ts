import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Routes d'authentification (accessibles sans session, mais redirigent si déjà connecté)
const authRoutes = ["/login", "/register"];

// Routes protégées nécessitant une authentification
const protectedRoutes = ["/dashboard", "/event", "/reception"];

// Proxy Next.js 16 : protège les routes et gère les redirections de session
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Vérifie si la route courante nécessite une protection ou est une page d'auth
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAuth = authRoutes.some((route) => pathname === route);

  // Crée un client Supabase avec les cookies de la requête
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
        },
      },
    }
  );

  // Récupère l'utilisateur connecté
  const { data: { user } } = await supabase.auth.getUser();

  // Redirige vers la page de connexion si non authentifié sur une route protégée
  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirige vers le dashboard si déjà connecté sur une page d'auth
  if (isAuth && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

// Configuration du matcher : applique le proxy à toutes les routes sauf les assets statiques
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
