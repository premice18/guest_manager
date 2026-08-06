import type { MetadataRoute } from "next";

// Robots.txt : tout est privé (auth requise sur les pages métier).
// On bloque l'indexation par défaut ; si un jour des pages publiques
// existent, on les ajoutera explicitement.
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
    sitemap: baseUrl ? `${baseUrl}/sitemap.xml` : undefined,
  };
}