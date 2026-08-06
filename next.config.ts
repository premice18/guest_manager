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
          // En production uniquement. Autorise le script inline du thème (voir
          // src/app/layout.tsx) via son hash, et les flux Supabase+Realtime.
          // Recalculez le hash si le script de thème change.
          ...(isProd
            ? [
                {
                  key: "Content-Security-Policy",
                  value: [
                    "default-src 'self'",
                    "script-src 'self' 'sha256-3ZGJDkIJoAUO/YtBCGW4Lo/2NOqWTJKS1AotDqhih4A='",
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
