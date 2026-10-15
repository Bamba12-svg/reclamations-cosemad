import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed/index.ts",
  },
  datasource: {
    // Définie dans .env (local) ou dans les variables de l'hébergeur (Neon en ligne).
    url: process.env.DATABASE_URL ?? "",
  },
});
