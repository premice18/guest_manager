import type { NextConfig } from "next";

// CSP appliquée UNIQUEMENT en production. En dev, Next.js injecte des scripts
// inline (HMR/refresh) impossibles à hacher, qui seraient bloqués.
const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // En production uniquement. `unsafe-inline` est nécessaire sur script-src :
          // Next.js émet toujours des scripts inline pour l'hydratation (payload RSC
          // `self.__next_f.push`) dont le contenu varie à chaque build, impossible à
          // hacher proprement. La doc Next.js recommande cette approche quand les pages
          // restent rendues STATIQUEMENT (l'alternative nonce impose le rendu dynamique
          // de toutes les pages). Le reste du script-src reste restreint à 'self',
          // et les autres directives (images, connect-src Supabase, frame, base-uri...)
          // restent strictes.
          ...(isProd
            ? [
                {
                  key: "Content-Security-Policy",
                  value: [
                    "default-src 'self'",
                    "script-src 'self' 'unsafe-inline'",
                    "style-src 'self' 'unsafe-inline'",
                    "img-src 'self' data: blob:",
                    "font-src 'self' data:",
                    `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""} wss://${(() => {
                      try {
                        return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
                      } catch {
                        return "";
                      }
                    })()}`,
                    "frame-ancestors 'none'",
                    "base-uri 'self'",
                    "form-action 'self'",
                  ].join("; "),
                },
              ]
            : []),
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
