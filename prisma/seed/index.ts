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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import type {
  Canal,
  ModeTransmission,
  Prisma,
  Role,
  SousTypeProduit,
  StatutAction,
  TypeReclamation,
} from "../../src/generated/prisma/client";
import type { DonneesMaquette, ModeMaquette, ReclamationMaquette, SocieteMaquette } from "./types";

const MOT_DE_PASSE_DEMO = "demo2026";

const META_SOCIETES = {
  CM: { slug: "carrefour-medical", logo: "/logos/carrefour-medical.png", ordre: 1 },
  SON: { slug: "sonerco", logo: "/logos/sonerco.png", ordre: 2 },
  FLS: { slug: "fls", logo: "/logos/fls.png", ordre: 3 },
} as const;

/** Jours fériés à date fixe au Sénégal. Les fêtes religieuses (Korité, Tabaski, Tamkharit,
 *  Maouloud, Magal, lundi de Pâques, Ascension, Pentecôte) changent chaque année : le QHSE les saisit. */
const FERIES_FIXES = [
  ["01-01", "Jour de l'an"],
  ["04-04", "Fête de l'Indépendance"],
  ["05-01", "Fête du Travail"],
  ["08-15", "Assomption"],
  ["11-01", "Toussaint"],
  ["12-25", "Noël"],
] as const;

// ───────────────────────── Correspondances maquette → modèle ─────────────────────────

const MODES: Record<ModeMaquette, ModeTransmission> = {
  Verbal: "VERBAL",
  Mail: "MAIL",
  Téléphone: "TELEPHONE",
  Courrier: "COURRIER",
  "Plateforme web": "PLATEFORME_WEB",
  Autres: "AUTRES",
};
const TYPES: Record<ReclamationMaquette["type"], TypeReclamation> = { Produit: "PRODUIT", Service: "SERVICE", Autre: "AUTRE" };
const SOUS_TYPES: Record<Exclude<ReclamationMaquette["sous"], "">, SousTypeProduit> = {
  qualité: "QUALITE",
  prix: "PRIX",
  fonctionnalité: "FONCTIONNALITE",
};
const STATUTS_ACTION: Record<string, StatutAction> = { "À faire": "A_FAIRE", "En cours": "EN_COURS", Réalisée: "REALISEE" };

function canauxDepuisTexte(texte: string | undefined): Canal[] {
  if (!texte) return ["SMS"];
  const t = texte.toLowerCase();
  const c: Canal[] = [];
  if (t.includes("sms")) c.push("SMS");
  if (t.includes("e-mail")) c.push("EMAIL");
  return c.length ? c : ["SMS"];
}

/** « +221 77 412 35 08 » → « +221774123508 » (E.164). */
function versE164(tel: string): string {
  const chiffres = tel.replace(/\D/g, "").replace(/^221/, "");
  if (chiffres.length !== 9) throw new Error(`Téléphone invalide dans la maquette : ${tel}`);
  return `+221${chiffres}`;
}

function slugEmail(nom: string): string {
  return nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

function typeMime(nom: string): string {
  const ext = nom.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  return "image/jpeg";
}

// ───────────────────────── Dates ─────────────────────────

const JOUR_MS = 86_400_000;

function creerDecaleur(jourMaquette: string, aujourdhui: string) {
  const ecart = Math.round((Date.parse(`${aujourdhui}T00:00:00Z`) - Date.parse(`${jourMaquette}T00:00:00Z`)) / JOUR_MS);
  /** Date + heure de la maquette (heure de Dakar = UTC) → instant décalé. */
  const instant = (date: string, heure = "00:00"): Date =>
    new Date(Date.parse(`${date}T${heure}:00Z`) + ecart * JOUR_MS);
  /** Date seule (colonne @db.Date). */
  const jour = (date: string): Date => instant(date, "00:00");
  return { ecart, instant, jour };
}

function aujourdhuiDakar(): string {
  return new Date().toISOString().slice(0, 10); // Dakar est à UTC+0 toute l'année
}

// ───────────────────────── Programme principal ─────────────────────────

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_FORCER !== "1") {
    throw new Error("Refus : le seed vide la base. En production, définissez SEED_FORCER=1 si c'est vraiment voulu.");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante (fichier .env).");

  const donnees = JSON.parse(readFileSync(join(__dirname, "donnees-maquette.json"), "utf8")) as DonneesMaquette;
  const aujourdhui = process.env.SEED_AUJOURDHUI ?? aujourdhuiDakar();
  const dates = creerDecaleur(donnees.today, aujourdhui);

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const debut = Date.now();
  console.log(`Données de démonstration — jour de référence : ${aujourdhui} (décalage de ${dates.ecart} jours sur la maquette)`);

  try {
    await viderLaBase(db);
    const hash = await bcrypt.hash(MOT_DE_PASSE_DEMO, 10);

    await db.$transaction(
      async (tx) => {
        // Utilisateurs du groupe : accès aux 3 sociétés
        const groupe: { nom: string; email: string; fonction: string; role: Role }[] = [
          ...donnees.groupe.map((u) => ({
            nom: u.nom,
            email: u.email,
            fonction: u.fonction ?? u.role,
            role: (u.droit === "qhse" ? "QHSE" : u.droit === "dc" ? "DIRECTION_COMMERCIALE" : "AGENT_ACCUEIL") as Role,
          })),
          { nom: "Mariama Kane", email: "mariama.kane@cosemad.sn", fonction: "Directrice générale", role: "DIRECTION_GENERALE" },
        ];
        const idsGroupe = new Map<string, string>();
        for (const u of groupe) {
          const cree = await tx.user.create({
            data: { nom: u.nom, email: u.email, fonction: u.fonction, role: u.role, motDePasseHash: hash, toutesSocietes: true },
          });
          idsGroupe.set(u.nom, cree.id);
        }

        for (const code of ["CM", "SON", "FLS"] as const) {
          await chargerSociete(tx, donnees.societes[code], META_SOCIETES[code], idsGroupe, hash, dates);
        }

        const annees = new Set([Number(aujourdhui.slice(0, 4)), Number(aujourdhui.slice(0, 4)) + 1]);
        await tx.jourFerie.createMany({
          data: [...annees].flatMap((a) => FERIES_FIXES.map(([md, libelle]) => ({ date: new Date(`${a}-${md}T00:00:00Z`), libelle }))),
        });
      },
      { timeout: 120_000, maxWait: 10_000 },
    );

    await resume(db);
    console.log(`Terminé en ${((Date.now() - debut) / 1000).toFixed(1)} s. Mot de passe de tous les comptes : ${MOT_DE_PASSE_DEMO}`);
  } finally {
    await db.$disconnect();
  }
}

async function viderLaBase(db: PrismaClient) {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) throw new Error("Aucune table : lancez d'abord « npm run db:migrate ».");
  const liste = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${liste} RESTART IDENTITY CASCADE`);
}

type Tx = Prisma.TransactionClient;
type Decaleur = ReturnType<typeof creerDecaleur>;

async function chargerSociete(
  tx: Tx,
  s: SocieteMaquette,
  meta: (typeof META_SOCIETES)[keyof typeof META_SOCIETES],
  idsGroupe: Map<string, string>,
  hash: string,
  dates: Decaleur,
) {
  const societe = await tx.societe.create({
    data: {
      code: s.code,
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
    },
  });

  // Personnes de la société : responsables d'activité et membres d'équipe (rôle Responsable de traitement)
  const idsPersonnes = new Map(idsGroupe);
  const creerPersonne = async (nom: string, fonction: string) => {
    if (idsPersonnes.has(nom)) return idsPersonnes.get(nom)!;
    const u = await tx.user.create({
      data: {
        nom,
        email: `${slugEmail(nom)}@${s.mailDomain}`,
        fonction,
        role: "RESPONSABLE_TRAITEMENT",
        motDePasseHash: hash,
        acces: { create: { societeId: societe.id } },
      },
    });
    idsPersonnes.set(nom, u.id);
    return u.id;
  };

  const idsActivites = new Map<string, string>();
  for (const [i, d] of s.divisions.entries()) {
    const responsableId = await creerPersonne(d.resp, `Responsable – ${d.nom}`);
    const activite = await tx.activite.create({
      data: {
        societeId: societe.id,
        code: d.code,
        nom: d.nom,
        nomCourt: d.court,
        description: d.desc,
        icone: d.icon,
        ordre: i + 1,
        responsableId,
      },
    });
    idsActivites.set(d.code, activite.id);
    for (const [j, e] of d.equipes.entries()) {
      const membres: string[] = [];
      for (const nom of e.membres) membres.push(await creerPersonne(nom, `${e.nom} – ${d.nom}`));
      await tx.equipe.create({
        data: { activiteId: activite.id, nom: e.nom, ordre: j + 1, membres: { create: membres.map((userId) => ({ userId })) } },
      });
    }
  }

  const idDe = (nom: string): string => {
    const id = idsPersonnes.get(nom);
    if (!id) throw new Error(`${s.code} : personne inconnue « ${nom} »`);
    return id;
  };
  const accueil = idDe("Awa Ba");
  const qhseParDefaut = idDe("Fatou Sarr");

  // Réclamations
  const idsReclamations = new Map<string, string>();
  const compteurs = new Map<number, number>();
  for (const r of s.recs) {
    const [, anneeTxt, seqTxt] = r.id.split("-");
    const annee = Number(anneeTxt);
    const sequence = Number(seqTxt);
    compteurs.set(annee, Math.max(compteurs.get(annee) ?? 0, sequence));

    const web = r.mode === "Plateforme web";
    const recueLe = dates.instant(r.date, r.heure);
    // La maquette affecte « à 17 h » ; si la réclamation arrive plus tard, l'affectation suit de 30 min.
    const affecteeLe = r.resp
      ? r.heure < "16:30"
        ? dates.instant(r.date, "17:00")
        : new Date(recueLe.getTime() + 30 * 60_000)
      : null;
    const responsableId = r.resp ? idDe(r.resp) : null;

    const cree = await tx.reclamation.create({
      data: {
        numero: r.id,
        societeId: societe.id,
        annee,
        sequence,
        activiteId: idsActivites.get(r.fil)!,
        recueLe,
        mode: MODES[r.mode],
        origine: r.origine,
        saisieParId: web ? null : accueil,
        profil: r.profil === "societe" ? "SOCIETE" : "PARTICULIER",
        clientNom: r.client,
        secteur: r.secteur || null,
        contactNom: r.contact || null,
        telephone: versE164(r.tel),
        email: r.email || null,
        canauxReponse: r.canaux.map((c) => (c === "email" ? "EMAIL" : "SMS")),
        consentementLe: web ? recueLe : null,
        type: TYPES[r.type],
        sousType: r.sous ? SOUS_TYPES[r.sous] : null,
        description: r.desc,
        recurrent: r.recurrent,
        responsableId,
        affecteeLe,
        causes: r.causes || null,
        observations: r.obs || null,
        reponse: r.reponse?.detail ?? null,
        reponseLe: r.reponse ? dates.instant(r.reponse.date, "15:30") : null,
        reponseCanaux: r.reponse ? canauxDepuisTexte(r.reponse.canaux) : [],
        reponseParId: r.reponse ? responsableId : null,
        clotureLe: r.cloture ? dates.instant(r.cloture, "18:00") : null,
        clotureParId: r.cloture ? (r.visaQHSE ? idDe(r.visaQHSE.nom) : qhseParDefaut) : null,
        actions: {
          create: r.actions.map((a, i) => ({
            ordre: i + 1,
            libelle: a.action,
            responsableId: idDe(a.resp),
            echeance: dates.jour(a.echeance),
            statut: STATUTS_ACTION[a.statut]!,
            critere: a.critere,
            efficace: a.efficace,
            realiseeLe: a.statut === "Réalisée" ? dates.instant(a.echeance, "17:00") : null,
          })),
        },
        visas: {
          create: [
            ...(r.visaDC ? [{ type: "DIRECTION_COMMERCIALE" as const, userId: idDe(r.visaDC.nom), viseLe: dates.instant(r.visaDC.date, r.visaDC.heure) }] : []),
            ...(r.visaQHSE ? [{ type: "QHSE" as const, userId: idDe(r.visaQHSE.nom), viseLe: dates.instant(r.visaQHSE.date, r.visaQHSE.heure) }] : []),
          ],
        },
        // Fichiers de démonstration : seules les métadonnées existent (contenu fictif servi par le stockage démo).
        pieces: {
          create: r.pieces.map((nom) => ({
            source: web ? ("CLIENT" as const) : ("INTERNE" as const),
            nomOriginal: nom,
            typeMime: typeMime(nom),
            taille: 0,
            cleStockage: `demo/${r.id}/${nom}`,
            sha256: "0".repeat(64),
            deposeeParId: web ? null : accueil,
          })),
        },
        commentaires: {
          create: r.comments.map((c) => ({ auteurId: idDe(c.who), texte: c.t, createdAt: dates.instant(c.d, c.h) })),
        },
        historique: {
          create: r.histo.map((h) => {
            const estAffectation = h.t.startsWith("Affectée à ");
            return {
              libelle: h.t,
              survenuLe: estAffectation && affecteeLe ? affecteeLe : dates.instant(h.d, h.h),
              acteurId: h.who === "Client" || h.who === "Système" ? null : idDe(h.who),
              acteurLibelle: h.who === "Client" || h.who === "Système" ? h.who : null,
            };
          }),
        },
      },
      select: { id: true },
    });
    idsReclamations.set(r.id, cree.id);
  }

  // Réclamations similaires (relation dans les deux sens)
  for (const r of s.recs) {
    const liees = r.similaires.map((n) => idsReclamations.get(n)).filter((x): x is string => !!x);
    if (liees.length) {
      await tx.reclamation.update({
        where: { id: idsReclamations.get(r.id)! },
        data: { similaires: { connect: liees.map((id) => ({ id })) } },
      });
    }
  }

  await tx.compteurNumero.createMany({
    data: [...compteurs].map(([annee, dernier]) => ({ societeId: societe.id, annee, dernier })),
  });
}

async function resume(db: PrismaClient) {
  const societes = await db.societe.findMany({
    orderBy: { ordre: "asc" },
    select: { code: true, nom: true, _count: { select: { reclamations: true, activites: true } } },
  });
  for (const s of societes) {
    console.log(`  ${s.code.padEnd(3)} ${s.nom.padEnd(18)} ${String(s._count.activites)} activités · ${String(s._count.reclamations)} réclamations`);
  }
  const [utilisateurs, actions, evenements] = await Promise.all([db.user.count(), db.action.count(), db.evenement.count()]);
  console.log(`  ${utilisateurs} utilisateurs · ${actions} actions · ${evenements} événements d'historique`);
}

main().catch((erreur: unknown) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exit(1);
});
