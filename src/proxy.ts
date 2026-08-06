import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const authRoutes = ["/login", "/register", "/forgot-password", "/reset-password"];
const protectedRoutes = ["/dashboard", "/event", "/reception"];

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 100;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(ip)) {
    return new NextResponse("Trop de requêtes", { status: 429 });
  }

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
    // Conserve la route d'origine pour y revenir après connexion
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
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
