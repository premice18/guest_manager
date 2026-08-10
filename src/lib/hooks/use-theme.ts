"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

// Clé utilisée par le script inline de layout.tsx (read au chargement initial)
// et par ce hook (write au basculement). Doivent rester identiques.
const THEME_KEY = "theme";

// Durée de l'animation de bascule (doit correspondre à la durée CSS plus bas).
const ANIM_DURATION = 350;

// Ouvre le nouvel état : 'light' | 'dark'
export type Theme = "light" | "dark";

// Lit le thème actuellement appliqué sur <html> (synchronisé avec le script
// inline de layout.tsx qui lit localStorage, sinon la préférence système).
function readAppliedTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
}

// Applique le thème sur <html>, le persiste dans localStorage et lève une
// animation de transition douce (classe theme-anim) pendant ~350ms.
function applyTheme(theme: Theme) {
  const root = window.document.documentElement;
  const prefersReduced =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!prefersReduced) {
    // La classe theme-anim (globals.css) active une transition sur TOUS les
    // éléments : le changement de fond/couleurs devient fluide, sans flash.
    root.classList.add("theme-anim");
    window.setTimeout(() => root.classList.remove("theme-anim"), ANIM_DURATION);
  }
  root.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Stockage indisponible (mode privé) : le thème reste côté session.
  }
}

// Abonne au changement de thème : à la fois le stockage (autre onglet) et les
// notifications internes émises après un basculement dans cet onglet.
function subscribeTheme(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  listeners.add(onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    listeners.delete(onChange);
  };
}

// Ensemble des abonnés React à prévenir quand le thème change.
const listeners = new Set<() => void>();
function notifyThemeChanged() {
  listeners.forEach((listener) => listener());
}

// Hook central de gestion du thème (clair/sombre).
// L'état est un miroir externe (classe .dark sur <html>) pour ne jamais
// diverger du reste de l'app après une navigation ou un changement d'onglet.
export function useTheme() {
  const theme = useSyncExternalStore<Theme>(
    subscribeTheme,
    readAppliedTheme,
    () => "light",
  );

  // Bascule entre clair et sombre avec animation.
  const toggleTheme = useCallback(() => {
    const next: Theme = readAppliedTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    notifyThemeChanged();
  }, []);

  // Force un thème donné (utilisé depuis le profil, la landing, les raccourcis).
  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    notifyThemeChanged();
  }, []);

  // Garde le <meta name="theme-color"> (barre du navigateur) en phase avec
  // le thème, pour ne pas conserver un thèmeColor doré fixe sur fond sombre.
  useEffect(() => {
    const meta = window.document.querySelector('meta[name="theme-color"]');
    const nextColor = theme === "dark" ? "#121212" : "#C9A96E";
    if (meta) {
      meta.setAttribute("content", nextColor);
    } else {
      const el = window.document.createElement("meta");
      el.name = "theme-color";
      el.content = nextColor;
      window.document.head.appendChild(el);
    }
  }, [theme]);

  return {
    theme,
    isDark: theme === "dark",
    toggleTheme,
    setTheme,
  };
}