import Link from "next/link";
import Image from "next/image";

// Layout partagé pour toutes les pages du dashboard (events, event details, etc.)
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-off-white">
      {/* Barre de navigation supérieure */}
      <header className="sticky top-0 z-50 border-b border-border bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/dashboard"
            className="group flex items-center gap-2.5 transition-opacity hover:opacity-80"
          >
            <Image
              src="/logo.svg"
              alt="Guest Manager"
              width={36}
              height={36}
              className="size-9 transition-transform duration-300 group-hover:scale-110"
            />
            <div>
              <span className="block font-serif text-lg leading-tight text-gold sm:text-xl">
                Guest Manager
              </span>
              <span className="hidden text-[10px] leading-tight tracking-wider text-muted-foreground sm:block">
                GESTION D&rsquo;ÉVÉNEMENTS
              </span>
            </div>
          </Link>

          {/* Navigation principale */}
          <nav className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="group relative text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-gold"
            >
              Mes événements
              <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-gold transition-all duration-300 group-hover:w-full" />
            </Link>
            <Link
              href="/dashboard/profile"
              className="group relative text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-gold"
            >
              Profil
              <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-gold transition-all duration-300 group-hover:w-full" />
            </Link>
          </nav>
        </div>
        {/* Ligne d'accentuation dorée sous le header */}
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      </header>
      {children}
    </div>
  );
}
