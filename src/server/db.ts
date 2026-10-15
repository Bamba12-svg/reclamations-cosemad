import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Client Prisma unique pour toute l'application (Prisma 7 + pilote pg).
 * En développement, le rechargement à chaud recrée les modules : on garde
 * l'instance sur globalThis pour ne pas ouvrir un nouveau pool à chaque fois.
 */
const globalPourPrisma = globalThis as unknown as { prisma?: PrismaClient };

function creerClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL manquante : copiez .env.example vers .env et renseignez la connexion PostgreSQL.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export const db: PrismaClient = globalPourPrisma.prisma ?? creerClient();

if (process.env.NODE_ENV !== "production") globalPourPrisma.prisma = db;
