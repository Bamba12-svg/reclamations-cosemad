/**
 * Initialisation d'une base de PRODUCTION (vide) — à lancer une seule fois après « npm run db:deploy » :
 *
 *   INIT_QHSE_NOM="Fatou Sarr" INIT_QHSE_EMAIL="f.sarr@cosemad.sn" INIT_QHSE_MOT_DE_PASSE="…" npm run db:init
 *
 * Crée, sans aucune donnée de démonstration :
 *  - les 3 sociétés (Carrefour Médical, Sonerco, FLS) avec leurs délais cibles et modèles de messages ;
 *  - leurs activités et le nom de leurs équipes (sans membres : le QHSE les compose dans Paramètres) ;
 *  - les jours fériés à date fixe de l'année en cours et de la suivante ;
 *  - le premier compte Service QHSE, qui crée ensuite tous les autres comptes dans l'application.
 * Sans danger si on le relance : ce qui existe déjà n'est ni modifié ni dupliqué.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import donneesBrutes from "./donnees-maquette.json";
import { aujourdhuiDakar, FERIES_FIXES, META_SOCIETES } from "./demonstration";
import type { DonneesMaquette } from "./types";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante.");
  const donnees = donneesBrutes as unknown as DonneesMaquette;
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    for (const code of ["CM", "SON", "FLS"] as const) {
      const s = donnees.societes[code];
      const meta = META_SOCIETES[code];
      if (await db.societe.findUnique({ where: { code } })) {
        console.log(`${code} : déjà présente, inchangée.`);
        continue;
      }
      await db.societe.create({
        data: {
          code,
          slug: meta.slug,
          nom: s.nom,
          domaine: s.domaine,
          accroche: s.accroche,
          telStandard: s.telStd,
          mailDomaine: s.mailDomain,
          logo: meta.logo,
          ordre: meta.ordre,
          parametres: {
            create: {
              delaiQualificationH: s.defaults.delais.qual,
              delaiReponseJO: s.defaults.delais.rep,
              delaiClotureJ: s.defaults.delais.clo,
              modeleSms: s.defaults.sms,
              modeleEmailObjet: `${s.nom} : votre réclamation {numero} est bien reçue`,
              modeleEmail: s.defaults.mail,
            },
          },
          activites: {
            create: s.divisions.map((d, i) => ({
              code: d.code,
              nom: d.nom,
              nomCourt: d.court,
              description: d.desc,
              icone: d.icon,
              ordre: i + 1,
              equipes: { create: d.equipes.map((e, j) => ({ nom: e.nom, ordre: j + 1 })) },
            })),
          },
        },
      });
      console.log(`${code} : ${s.nom} créée avec ${s.divisions.length} activités.`);
    }

    const annee = Number(aujourdhuiDakar().slice(0, 4));
    const feries = await db.jourFerie.createMany({
      data: [annee, annee + 1].flatMap((a) => FERIES_FIXES.map(([md, libelle]) => ({ date: new Date(`${a}-${md}T00:00:00Z`), libelle }))),
      skipDuplicates: true,
    });
    console.log(`Jours fériés à date fixe ajoutés : ${feries.count}. Ajoutez les fêtes à date variable dans Paramètres > Délais cibles.`);

    if (await db.user.findFirst({ where: { role: "QHSE", actif: true } })) {
      console.log("Un compte Service QHSE actif existe déjà : aucun compte créé.");
      return;
    }
    const nom = process.env.INIT_QHSE_NOM?.trim();
    const email = process.env.INIT_QHSE_EMAIL?.trim().toLowerCase();
    const motDePasse = process.env.INIT_QHSE_MOT_DE_PASSE ?? "";
    if (!nom || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Renseignez INIT_QHSE_NOM et INIT_QHSE_EMAIL pour créer le premier compte QHSE.");
    if (motDePasse.length < 12 || !/[a-zA-Z]/.test(motDePasse) || !/\d/.test(motDePasse)) {
      throw new Error("INIT_QHSE_MOT_DE_PASSE : 12 caractères minimum, avec au moins une lettre et un chiffre.");
    }
    const u = await db.user.create({
      data: { nom, email, fonction: "Service QHSE", role: "QHSE", toutesSocietes: true, motDePasseHash: await bcrypt.hash(motDePasse, 12), doitChangerMotDePasse: true },
    });
    await db.journalAudit.create({ data: { action: "utilisateur.creer", entite: "User", entiteId: u.id, details: { email, role: "QHSE", origine: "db:init" } } });
    console.log(`Compte Service QHSE créé : ${email}. Connectez-vous puis créez les autres comptes dans Paramètres.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((erreur: unknown) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exit(1);
});
