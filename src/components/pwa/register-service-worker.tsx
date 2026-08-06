"use client";

import { useEffect } from "react";

// Enregistre le service worker (PWA) uniquement en production,
// pour éviter tout artefact de cache en développement.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Échec silencieux : la PWA reste un bonus, pas une dépendance
      });
    };
    document.addEventListener("load", register);
    return () => document.removeEventListener("load", register);
  }, []);

  return null;
}