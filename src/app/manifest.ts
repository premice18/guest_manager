import type { MetadataRoute } from "next";

// Manifest Web App : permet l'installation du site en PWA sur l'écran d'accueil
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Guest Manager — L'art de recevoir, simplifié.",
    short_name: "Guest Manager",
    description: "Gérez vos invités, tables et placements avec élégance.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1A1A1A",
    theme_color: "#C9A96E",
    categories: ["business", "productivity", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}