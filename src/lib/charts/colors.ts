"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/lib/hooks/use-theme";

// Palettes/couleurs des graphiques Recharts. Elles doivent suivre le thème
// (clair/sombre) : elles sont donc lues à partir des variables CSS définies
// dans globals.css plutôt que codées en dur. Les variables CSS ne pouvant pas
// être utilisées directement dans les attributs SVG, on lit leurs valeurs
// calculées via getComputedStyle à chaque changement de thème.

// Lit la valeur résolue d'une variable CSS sur l'élément racine
function readVar(name: string): string {
  if (typeof window === "undefined") return "";
  const value = getComputedStyle(window.document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value;
}

export interface ChartColors {
  gold: string;
  success: string;
  grid: string;
  axis: string;
  category: string[];
}

// Valeurs de repli si les variables CSS sont indisponibles (SSR)
const FALLBACK: ChartColors = {
  gold: "#C9A96E",
  success: "#4CAF50",
  grid: "#f0f0f0",
  axis: "#8a8a8a",
  category: [
    "#C9A96E", "#4CAF50", "#2196F3", "#FF9800",
    "#9C27B0", "#F44336", "#00BCD4", "#607D8B",
  ],
};

// Hook : expose les couleurs de graphiques synchronisées avec le thème.
export function useChartColors(): ChartColors {
  const { isDark } = useTheme();
  const [colors, setColors] = useState<ChartColors>(FALLBACK);

  useEffect(() => {
    // Lit les variables APRÈS que le navigateur a appliqué la classe .dark
    // (requestAnimationFrame garantit que la classe a bien été prise en compte).
    const raf = window.requestAnimationFrame(() => {
      setColors({
        gold: readVar("--gold") || FALLBACK.gold,
        success: readVar("--success") || FALLBACK.success,
        grid: readVar("--border-muted") || readVar("--border") || FALLBACK.grid,
        axis: readVar("--muted-foreground-light") || FALLBACK.axis,
        // Palette catégorielle : or, puis vert/info/attention/erreur du thème,
        // complétée par des teintes fixes lisibles sur fond clair ET sombre.
        category: [
          readVar("--gold") || FALLBACK.category[0],
          readVar("--success") || FALLBACK.category[1],
          readVar("--info") || FALLBACK.category[2],
          readVar("--warning") || FALLBACK.category[3],
          FALLBACK.category[4],
          readVar("--error") || FALLBACK.category[5],
          FALLBACK.category[6],
          FALLBACK.category[7],
        ],
      });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [isDark]);

  return colors;
}