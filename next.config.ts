import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Le client Prisma et le pilote pg restent côté serveur, non empaquetés.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "exceljs", "@react-pdf/renderer"],
  experimental: {
    // Dépôt avec 3 pièces jointes de 10 Mo maximum (contrôlées une à une côté serveur).
    serverActions: { bodySizeLimit: "32mb" },
  },
  async headers() {
    const securite = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    ];
    if (process.env.NODE_ENV === "production") {
      securite.push(
        // Uniquement des ressources du site lui-même : aucune police, image ou script externe n'est utilisé.
        // 'unsafe-inline' reste nécessaire aux scripts d'hydratation de Next.js et aux styles en ligne.
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self'",
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
          ].join("; "),
        },
        // HTTPS obligatoire pendant 2 ans (le site est servi uniquement en HTTPS par Infomaniak).
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      );
    }
    return [{ source: "/:path*", headers: securite }];
  },
};

export default nextConfig;
