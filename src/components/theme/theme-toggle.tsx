"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/hooks/use-theme";
import { cn } from "@/lib/utils";

// Bouton de bascule clair/sombre. Accessible au clavier (Tab + Entrée) et
// au lecteur d'écran via le libellé dynamique reflétant l'action à venir.
export function ThemeToggle({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { isDark, toggleTheme } = useTheme();
  // Vrai uniquement après hydratation : on affiche l'icône réelle côté client
  // pour éviter un conflit SSR/hydratation (le HTML initial est côté clair).
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Libellé dynamique : indique l'ACTION à effectuer (et non l'état courant).
  const label = isDark ? "Passer au mode clair" : "Passer au mode sombre";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-gold",
        compact ? "size-9" : "size-10",
        className
      )}
    >
      {/* Rendu uniquement côté client pour éviter les warnings d'hydratation */}
      {isClient ? (
        isDark ? (
          <Moon className="size-4" aria-hidden="true" />
        ) : (
          <Sun className="size-4" aria-hidden="true" />
        )
      ) : (
        <span className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}