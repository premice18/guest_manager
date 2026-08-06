import type { MetadataRoute } from "next";

// Sitemap : l'application est entièrement derrière authentification.
// On ne propose aucune URL publique indexable.
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}