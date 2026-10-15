import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** Client de test : même base que l'application (DATABASE_URL). Les tests créent puis suppriment leurs propres données. */
export const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }) });

/** Société jetable (code et slug uniques), supprimée en fin de test avec tout ce qui en dépend. */
export async function creerSocieteDeTest() {
  const suffixe = Math.random().toString(36).slice(2, 8);
  return db.societe.create({
    data: {
      code: `T${suffixe.toUpperCase().replace(/[^A-Z]/g, "X").slice(0, 3)}${Date.now() % 10}`,
      slug: `test-${suffixe}`,
      nom: `Société de test ${suffixe}`,
      domaine: "Test",
      accroche: "",
      telStandard: "+221 33 000 00 00",
      mailDomaine: "test.sn",
      logo: "/logos/groupe-cosemad.png",
      ordre: 99,
    },
  });
}

export async function supprimerSociete(id: string) {
  await db.message.deleteMany({ where: { societeId: id } });
  await db.reclamation.deleteMany({ where: { societeId: id } });
  await db.activite.deleteMany({ where: { societeId: id } });
  await db.societe.delete({ where: { id } });
}
