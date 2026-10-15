import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed/index.ts",
  },
  datasource: {
    // Commandes Prisma (migrations) : connexion DIRECTE. Avec Neon, l'application utilise la connexion
    // « pooled » (DATABASE_URL) et les migrations la connexion directe (DATABASE_URL_UNPOOLED).
    // En local, une seule variable suffit.
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "",
  },
});
