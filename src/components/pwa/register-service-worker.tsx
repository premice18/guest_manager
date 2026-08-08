"use client";

import { useEffect, useRef } from "react";

// Enregistre le service worker (PWA) uniquement en production,
// pour éviter tout artefact de cache en développement.
export function RegisterServiceWorker() {
  // Évite un double enregistrement si le composant remonte (StrictMode).
  const registeredRef = useRef(false);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator) ||
      registeredRef.current
    ) {
      return;
    }
    registeredRef.current = true;
    // L'événement "load" est émis sur window, PAS sur document. Ce listener
    // sur document ne se déclenchait donc jamais (fix audit) et le service
    // worker n'était jamais enregistré.
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Échec silencieux : la PWA reste un bonus, pas une dépendance
      });
    };
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}