/**
 * Données de démonstration — Groupe COSEMAD (Carrefour Médical, Sonerco, FLS).
 *
 * Les réclamations, personnes, activités et équipes sont celles des maquettes validées
 * (donnees-maquette.json). Toutes les dates sont décalées pour que le « jour de la maquette »
 * (02/10/2026) corresponde au jour où le script est lancé : la démonstration garde ainsi les
 * mêmes statuts (en cours, en retard, à viser…) quel que soit le jour où on la charge.
 *
 *   npm run db:seed                      → recharge toutes les données de démonstration
 *   SEED_AUJOURDHUI=2026-10-02 npm run db:seed → dates exactes de la maquette
 *
 * ATTENTION : le script VIDE la base avant de la remplir. Il refuse de tourner en production.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { aujourdhuiDakar, chargerDemonstration, MOT_DE_PASSE_DEMO_PUBLIC, resume } from "./demonstration";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_FORCER !== "1") {
    throw new Error("Refus : le seed vide la base. En production, définissez SEED_FORCER=1 si c'est vraiment voulu.");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante (fichier .env).");

  const aujourdhui = process.env.SEED_AUJOURDHUI ?? aujourdhuiDakar();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const debut = Date.now();
  try {
    const { ecart } = await chargerDemonstration(db, aujourdhui);
    console.log(`Données de démonstration — jour de référence : ${aujourdhui} (décalage de ${ecart} jours sur la maquette)`);
    await resume(db);
    console.log(`Terminé en ${((Date.now() - debut) / 1000).toFixed(1)} s. Mot de passe de tous les comptes : ${MOT_DE_PASSE_DEMO_PUBLIC}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((erreur: unknown) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exit(1);
});
