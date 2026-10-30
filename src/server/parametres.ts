import "server-only";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Prisma, Role } from "@/generated/prisma/client";
import { aujourdhuiIso, estJourIso, formatDate, formatDateHeure } from "@/lib/dates";
import { LIBELLE_ROLE } from "@/lib/libelles";
import { emailFacultatif, erreursParChamp } from "@/lib/validation/communs";
import { schemaDelais, schemaMessagerie, schemaModeles } from "@/lib/validation/backoffice";
import { modeDemo } from "./demo";
import { chiffrer, dechiffrer } from "./messagerie/chiffrement";
import { configurationPourSociete, configurationSmtp, fournisseurSmtp, verifierSmtp } from "./messagerie/smtp";
import { db } from "./db";
import { AccesRefuse, aLaPermission, peutAccederSociete, type Acteur } from "./droits/permissions";
import { journaliser } from "./journal";

/**
 * Paramètres (Service QHSE uniquement) : activités et équipes, utilisateurs et rôles, délais cibles,
 * jours fériés, modèles SMS et e-mail. Chaque modification est revalidée ici et inscrite au journal.
 */

export type ResultatParametres = { ok: true; message: string; motDePasse?: string } | { ok: false; erreur: string; champs?: Record<string, string> };

export interface ContexteParametres {
  ip: string | null;
  userAgent: string | null;
}

class Refus extends Error {}

/** Rôles qui voient tout le groupe ; seul le responsable de traitement est rattaché à une société. */
export const ROLES_GROUPE: readonly Role[] = ["QHSE", "DIRECTION_COMMERCIALE", "AGENT_ACCUEIL", "DIRECTION_GENERALE"];

function exigerQhse(acteur: Acteur, societeId: string) {
  if (!aLaPermission(acteur, "parametres.gerer") || !peutAccederSociete(acteur, societeId)) {
    throw new AccesRefuse("Les paramètres sont réservés au Service QHSE.");
  }
}

async function executer(acteur: Acteur, societeId: string, ctx: ContexteParametres, corps: (tx: Prisma.TransactionClient) => Promise<{ message: string; action: string; entite: string; entiteId?: string; details?: Prisma.InputJsonValue; motDePasse?: string }>): Promise<ResultatParametres> {
  try {
    exigerQhse(acteur, societeId);
    const r = await db.$transaction(async (tx) => {
      const sortie = await corps(tx);
      await journaliser(tx, {
        action: sortie.action,
        entite: sortie.entite,
        entiteId: sortie.entiteId ?? null,
        userId: acteur.id,
        societeId,
        details: sortie.details,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return sortie;
    });
    return { ok: true, message: r.message, ...(r.motDePasse ? { motDePasse: r.motDePasse } : {}) };
  } catch (e) {
    if (e instanceof AccesRefuse || e instanceof Refus) return { ok: false, erreur: e.message };
    if (e instanceof z.ZodError) {
      const champs = erreursParChamp(e);
      return { ok: false, erreur: Object.values(champs)[0] ?? "Saisie invalide.", champs };
    }
    throw e;
  }
}

// ───────────────────────── Lecture ─────────────────────────

export async function donneesParametres(societeId: string) {
  const aujourdhui = aujourdhuiIso();
  const [societe, activites, utilisateurs, parametres, feries, ouvertes] = await Promise.all([
    db.societe.findUniqueOrThrow({ where: { id: societeId }, select: { nom: true, code: true } }),
    db.activite.findMany({
      where: { societeId },
      orderBy: { ordre: "asc" },
      select: {
        id: true,
        code: true,
        nom: true,
        nomCourt: true,
        description: true,
        icone: true,
        actif: true,
        responsableId: true,
        responsable: { select: { nom: true } },
        equipes: { orderBy: { ordre: "asc" }, select: { id: true, nom: true, membres: { select: { user: { select: { id: true, nom: true, actif: true } } } } } },
        _count: { select: { reclamations: true } },
      },
    }),
    db.user.findMany({
      where: { OR: [{ toutesSocietes: true }, { acces: { some: { societeId } } }] },
      orderBy: [{ actif: "desc" }, { nom: "asc" }],
      select: { id: true, nom: true, email: true, fonction: true, role: true, actif: true, toutesSocietes: true, derniereConnexion: true, motDePasseHash: true },
    }),
    db.parametresSociete.findUnique({ where: { societeId } }),
    db.jourFerie.findMany({ where: { date: { gte: new Date(`${aujourdhui.slice(0, 4)}-01-01T00:00:00Z`) } }, orderBy: { date: "asc" } }),
    db.reclamation.groupBy({ by: ["activiteId"], where: { societeId, clotureLe: null }, _count: true }),
  ]);
  const icones = [...new Set((await db.activite.findMany({ select: { icone: true } })).map((a) => a.icone).filter(Boolean))];
  return {
    societe,
    activites: activites.map((a) => ({
      id: a.id,
      code: a.code,
      nom: a.nom,
      nomCourt: a.nomCourt,
      description: a.description,
      icone: a.icone,
      actif: a.actif,
      responsableId: a.responsableId,
      responsable: a.responsable?.nom ?? null,
      total: a._count.reclamations,
      ouvertes: ouvertes.find((o) => o.activiteId === a.id)?._count ?? 0,
      equipes: a.equipes.map((e) => ({ id: e.id, nom: e.nom, membres: e.membres.map((m) => m.user).sort((x, y) => x.nom.localeCompare(y.nom, "fr")) })),
    })),
    utilisateurs: utilisateurs.map((u) => ({
      id: u.id,
      nom: u.nom,
      email: u.email,
      fonction: u.fonction ?? "",
      role: u.role,
      actif: u.actif,
      groupe: u.toutesSocietes,
      connexion: u.derniereConnexion ? formatDateHeure(u.derniereConnexion) : null,
      sansMotDePasse: !u.motDePasseHash,
    })),
    delais: {
      delaiQualificationH: parametres?.delaiQualificationH ?? 24,
      delaiReponseJO: parametres?.delaiReponseJO ?? 5,
      delaiClotureJ: parametres?.delaiClotureJ ?? 15,
    },
    modeles: {
      modeleSms: parametres?.modeleSms ?? "",
      modeleEmailObjet: parametres?.modeleEmailObjet ?? "",
      modeleEmail: parametres?.modeleEmail ?? "",
    },
    messagerie: etatMessagerie(societe.code, societe.nom, parametres),
    feries: feries.map((f) => ({ date: f.date.toISOString().slice(0, 10), affichage: formatDate(f.date), libelle: f.libelle })),
    icones,
  };
}
export type DonneesParametres = Awaited<ReturnType<typeof donneesParametres>>;

// ───────────────────────── Délais, jours fériés, modèles ─────────────────────────

// ───────────────────────── Messagerie (boîte d'envoi de la filiale) ─────────────────────────

type ParametresMessagerie = { smtpHote: string | null; smtpPort: number | null; smtpUtilisateur: string | null; smtpMotDePasse: string | null; emailNomExpediteur: string | null; emailReponse: string | null } | null;

/** Ce que l'écran affiche : jamais le mot de passe, seulement s'il est enregistré et lisible. */
function etatMessagerie(code: string, nomSociete: string, p: ParametresMessagerie) {
  const motDePasseLisible = !!p?.smtpMotDePasse && dechiffrer(p.smtpMotDePasse) !== null;
  const source: "parametres" | "serveur" | "aucune" = p?.smtpUtilisateur && motDePasseLisible ? "parametres" : configurationSmtp(code) ? "serveur" : "aucune";
  return {
    emailEnvoi: p?.smtpUtilisateur ?? "",
    nomExpediteur: p?.emailNomExpediteur ?? `${nomSociete} – Réclamations`,
    hote: p?.smtpHote ?? "mail.infomaniak.com",
    port: p?.smtpPort ?? 465,
    emailReponse: p?.emailReponse ?? "",
    motDePasseEnregistre: !!p?.smtpMotDePasse,
    motDePasseIllisible: !!p?.smtpMotDePasse && !motDePasseLisible,
    source,
    bloqueeDemo: demoPublique(),
  };
}

/** Démonstration publique : aucune boîte réelle ne doit pouvoir être branchée ni testée par un visiteur. */
const demoPublique = () => modeDemo() && process.env.DEMO_EN_LIGNE === "1";

export function enregistrerMessagerie(acteur: Acteur, societeId: string, saisie: unknown, ctx: ContexteParametres) {
  return executer(acteur, societeId, ctx, async (tx) => {
    if (demoPublique()) throw new Refus("La messagerie ne se configure pas sur la démonstration publique.");
    const m = schemaMessagerie.parse(saisie);
    const actuel = await tx.parametresSociete.findUnique({ where: { societeId }, select: { smtpMotDePasse: true, smtpUtilisateur: true } });
    if (m.emailEnvoi && !m.motDePasse && !(actuel?.smtpMotDePasse && actuel.smtpUtilisateur === m.emailEnvoi)) {
      throw new Refus("Saisissez le mot de passe de cette boîte.");
    }
    const donnees = m.emailEnvoi
      ? {
          smtpUtilisateur: m.emailEnvoi,
          smtpHote: m.hote,
          smtpPort: m.port,
          emailNomExpediteur: m.nomExpediteur || null,
          ...(m.motDePasse ? { smtpMotDePasse: chiffrer(m.motDePasse) } : {}),
          emailReponse: m.emailReponse,
        }
      : // Adresse vidée : la boîte est retirée (les e-mails repassent par la configuration du serveur, s'il y en a une).
        { smtpUtilisateur: null, smtpHote: null, smtpPort: null, smtpMotDePasse: null, emailNomExpediteur: null, emailReponse: m.emailReponse };
    await tx.parametresSociete.upsert({
      where: { societeId },
      update: { ...donnees, updatedById: acteur.id },
      create: { societeId, ...VALEURS_PAR_DEFAUT_MODELES, ...donnees, updatedById: acteur.id },
    });
    // Le journal ne contient jamais le mot de passe, seulement le fait qu'il a changé.
    const details = { emailEnvoi: m.emailEnvoi, hote: m.hote, port: m.port, nomExpediteur: m.nomExpediteur, emailReponse: m.emailReponse, motDePasseModifie: !!m.motDePasse };
    return { message: m.emailEnvoi ? "Messagerie enregistrée" : "Boîte d'envoi retirée", action: "parametres.messagerie", entite: "ParametresSociete", entiteId: societeId, details };
  });
}

/** Envoie un e-mail d'essai depuis la boîte de la filiale vers l'adresse du QHSE connecté. */
export async function testerMessagerie(acteur: Acteur, societeId: string, ctx: ContexteParametres, adresse = ""): Promise<ResultatParametres> {
  try {
    exigerQhse(acteur, societeId);
    if (demoPublique()) return { ok: false, erreur: "L'envoi d'essai est désactivé sur la démonstration publique." };
    const choisie = emailFacultatif.safeParse(adresse);
    if (!choisie.success) return { ok: false, erreur: "Adresse de test invalide.", champs: { adresseTest: "Adresse de test invalide." } };
    const [societe, p, moi] = await Promise.all([
      db.societe.findUniqueOrThrow({ where: { id: societeId }, select: { code: true, nom: true } }),
      db.parametresSociete.findUnique({ where: { societeId }, select: { smtpHote: true, smtpPort: true, smtpUtilisateur: true, smtpMotDePasse: true, emailNomExpediteur: true, emailReponse: true } }),
      db.user.findUniqueOrThrow({ where: { id: acteur.id }, select: { email: true } }),
    ]);
    const c = configurationPourSociete(societe.code, p);
    if (!c) return { ok: false, erreur: "Aucune boîte d'envoi n'est configurée pour cette société." };
    let resultat: ResultatParametres;
    try {
      await verifierSmtp(undefined, c);
      await fournisseurSmtp().envoyer({
        destinataire: choisie.data ?? moi.email,
        objet: `Test — messagerie de ${societe.nom}`,
        corps: `Bonjour,\n\nCet e-mail confirme que la plateforme de réclamations peut écrire aux clients de ${societe.nom} depuis la boîte ${c.utilisateur}.\n\nPlateforme réclamations — Groupe COSEMAD`,
        smtp: c,
        repondreA: p?.emailReponse,
      });
      resultat = { ok: true, message: `E-mail d'essai envoyé à ${choisie.data ?? moi.email}` };
    } catch (e) {
      resultat = { ok: false, erreur: `Envoi refusé par le serveur de messagerie : ${messageSmtp(e)}` };
    }
    await journaliser(db, { action: "parametres.messagerie.test", entite: "ParametresSociete", entiteId: societeId, userId: acteur.id, societeId, details: { ok: resultat.ok, destinataire: choisie.data ?? moi.email }, ip: ctx.ip, userAgent: ctx.userAgent });
    return resultat;
  } catch (e) {
    if (e instanceof AccesRefuse) return { ok: false, erreur: e.message };
    throw e;
  }
}

/** Erreur SMTP lisible, sans jamais reprendre d'identifiant ni de mot de passe. */
function messageSmtp(e: unknown): string {
  const err = e as { code?: string; responseCode?: number; message?: string };
  if (err.code === "EAUTH" || err.responseCode === 535) return "adresse ou mot de passe incorrect.";
  if (err.code === "ETIMEDOUT" || err.code === "ECONNECTION" || err.code === "ESOCKET" || err.code === "ECONNREFUSED") return "serveur injoignable (nom du serveur ou port à vérifier).";
  if (err.code === "EDNS" || err.code === "ENOTFOUND") return "serveur introuvable (vérifiez son nom).";
  return (err.message ?? "erreur inconnue").slice(0, 200);
}

const VALEURS_PAR_DEFAUT_MODELES = { modeleSms: "Votre réclamation {numero} est bien reçue.", modeleEmailObjet: "Réclamation {numero}", modeleEmail: "Bonjour {nom}, votre réclamation {numero} est bien reçue." };

export function enregistrerDelais(acteur: Acteur, societeId: string, saisie: unknown, ctx: ContexteParametres) {
  return executer(acteur, societeId, ctx, async (tx) => {
    const d = schemaDelais.parse(saisie);
    await tx.parametresSociete.upsert({ where: { societeId }, update: { ...d, updatedById: acteur.id }, create: { societeId, ...d, ...VALEURS_PAR_DEFAUT_MODELES, updatedById: acteur.id } });
    return { message: "Délais cibles enregistrés", action: "parametres.delais", entite: "ParametresSociete", entiteId: societeId, details: d };
  });
}

export function enregistrerModeles(acteur: Acteur, societeId: string, saisie: unknown, ctx: ContexteParametres) {
  return executer(acteur, societeId, ctx, async (tx) => {
    const m = schemaModeles.parse(saisie);
    await tx.parametresSociete.upsert({ where: { societeId }, update: { ...m, updatedById: acteur.id }, create: { societeId, ...m, updatedById: acteur.id } });
    return { message: "Modèles de messages enregistrés", action: "parametres.modeles", entite: "ParametresSociete", entiteId: societeId, details: m };
  });
}

const schemaFerie = z.object({
  date: z.string().refine(estJourIso, { error: "Date invalide." }),
  libelle: z.string().trim().min(2, { error: "Indiquez le nom du jour férié." }).max(80),
});

/** Les jours fériés valent pour tout le groupe (calcul des jours ouvrés). */
export function ajouterJourFerie(acteur: Acteur, societeId: string, saisie: unknown, ctx: ContexteParametres) {
  return executer(acteur, societeId, ctx, async (tx) => {
    const f = schemaFerie.parse(saisie);
    const date = new Date(`${f.date}T00:00:00Z`);
    if (await tx.jourFerie.findUnique({ where: { date } })) throw new Refus("Ce jour est déjà enregistré comme férié.");
    await tx.jourFerie.create({ data: { date, libelle: f.libelle } });
    return { message: `Jour férié ajouté : ${f.libelle} (${formatDate(f.date)})`, action: "parametres.ferie.ajouter", entite: "JourFerie", entiteId: f.date, details: f };
  });
}

export function supprimerJourFerie(acteur: Acteur, societeId: string, jour: string, ctx: ContexteParametres) {
  return executer(acteur, societeId, ctx, async (tx) => {
    if (!estJourIso(jour)) throw new Refus("Date invalide.");
    const { count } = await tx.jourFerie.deleteMany({ where: { date: new Date(`${jour}T00:00:00Z`) } });
    if (!count) throw new Refus("Ce jour férié n'existe plus.");
    return { message: "Jour férié retiré", action: "parametres.ferie.supprimer", entite: "JourFerie", entiteId: jour };
  });
}

// ───────────────────────── Utilisateurs et rôles ─────────────────────────

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // sans 0/O, 1/l/I

/** Mot de passe provisoire lisible : « Kp7m-Qx4t-Wz9a » (au moins une lettre et un chiffre). */
export function motDePasseProvisoire(): string {
  for (;;) {
    const brut = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    if (/\d/.test(brut) && /[a-zA-Z]/.test(brut)) return `${brut.slice(0, 4)}-${brut.slice(4, 8)}-${brut.slice(8)}`;
  }
}

const schemaNouvelUtilisateur = z.object({
  nom: z.string().trim().min(2, { error: "Indiquez le nom complet." }).max(120),
  email: z.email({ error: "Adresse e-mail invalide." }).trim().toLowerCase().max(254),
  fonction: z.string().trim().max(120).default(""),
  role: z.enum(["QHSE", "DIRECTION_COMMERCIALE", "AGENT_ACCUEIL", "RESPONSABLE_TRAITEMENT", "DIRECTION_GENERALE"], { error: "Choisissez un rôle." }),
});
const role = schemaNouvelUtilisateur.shape.role;

/** Rattachement aux sociétés selon le rôle : tout le groupe, ou la société en cours pour un responsable de traitement. */
async function rattacher(tx: Prisma.TransactionClient, userId: string, r: Role, societeId: string) {
  const groupe = ROLES_GROUPE.includes(r);
  await tx.user.update({ where: { id: userId }, data: { toutesSocietes: groupe } });
  if (!groupe) await tx.accesSociete.upsert({ where: { userId_societeId: { userId, societeId } }, update: {}, create: { userId, societeId } });
}

async function verifierDernierQhse(tx: Prisma.TransactionClient, userId: string) {
  const autres = await tx.user.count({ where: { role: "QHSE", actif: true, id: { not: userId } } });
  if (autres === 0) throw new Refus("Il doit toujours rester au moins un compte Service QHSE actif.");
}

export function creerUtilisateur(acteur: Acteur, societeId: string, saisie: unknown, ctx: ContexteParametres) {
  return executer(acteur, societeId, ctx, async (tx) => {
    const u = schemaNouvelUtilisateur.parse(saisie);
    if (await tx.user.findUnique({ where: { email: u.email } })) throw new Refus("Cette adresse e-mail est déjà utilisée.");
    const motDePasse = motDePasseProvisoire();
    const cree = await tx.user.create({
      data: { nom: u.nom, email: u.email, fonction: u.fonction || null, role: u.role, motDePasseHash: await bcrypt.hash(motDePasse, 10), doitChangerMotDePasse: true },
    });
    await rattacher(tx, cree.id, u.role, societeId);
    return {
      message: `Compte créé pour ${u.nom}`,
      motDePasse,
      action: "utilisateur.creer",
      entite: "User",
      entiteId: cree.id,
      details: { email: u.email, role: u.role },
    };
  });
}

export function changerRole(acteur: Acteur, societeId: string, userId: string, saisie: unknown, ctx: ContexteParametres) {
  return executer(acteur, societeId, ctx, async (tx) => {
    const nouveau = role.parse(saisie);
    const u = await tx.user.findUnique({ where: { id: userId }, select: { id: true, nom: true, role: true } });
    if (!u) throw new Refus("Utilisateur introuvable.");
    if (u.role === nouveau) return { message: "Aucun changement", action: "utilisateur.role", entite: "User", entiteId: u.id };
    if (u.id === acteur.id) throw new Refus("Vous ne pouvez pas changer votre propre rôle.");
    if (u.role === "QHSE") await verifierDernierQhse(tx, u.id);
    await tx.user.update({ where: { id: u.id }, data: { role: nouveau } });
    await rattacher(tx, u.id, nouveau, societeId);
    return {
      message: `${u.nom} : ${LIBELLE_ROLE[nouveau]}`,
      action: "utilisateur.role",
      entite: "User",
      entiteId: u.id,
      details: { avant: u.role, apres: nouveau },
    };
  });
}

export function activerUtilisateur(acteur: Acteur, societeId: string, userId: string, actif: boolean, ctx: ContexteParametres) {
  return executer(acteur, societeId, ctx, async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId }, select: { id: true, nom: true, role: true, actif: true } });
    if (!u) throw new Refus("Utilisateur introuvable.");
    if (!actif && u.id === acteur.id) throw new Refus("Vous ne pouvez pas désactiver votre propre compte.");
    if (!actif && u.role === "QHSE") await verifierDernierQhse(tx, u.id);
    await tx.user.update({ where: { id: u.id }, data: { actif } });
    // Désactivation immédiate : le compte est relu à chaque requête, la session en cours tombe aussitôt.
    return {
      message: actif ? `Compte de ${u.nom} réactivé` : `Compte de ${u.nom} désactivé`,
      action: actif ? "utilisateur.activer" : "utilisateur.desactiver",
      entite: "User",
      entiteId: u.id,
    };
  });
}

export function reinitialiserMotDePasse(acteur: Acteur, societeId: string, userId: string, ctx: ContexteParametres) {
  return executer(acteur, societeId, ctx, async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId }, select: { id: true, nom: true, actif: true } });
    if (!u) throw new Refus("Utilisateur introuvable.");
    if (!u.actif) throw new Refus("Réactivez d'abord ce compte.");
    const motDePasse = motDePasseProvisoire();
    await tx.user.update({ where: { id: u.id }, data: { motDePasseHash: await bcrypt.hash(motDePasse, 10), doitChangerMotDePasse: true } });
    return { message: `Nouveau mot de passe pour ${u.nom}`, motDePasse, action: "utilisateur.mot-de-passe", entite: "User", entiteId: u.id };
  });
}

// ───────────────────────── Activités et équipes ─────────────────────────

const schemaActivite = z.object({
  nom: z.string().trim().min(2, { error: "Indiquez le nom de l'activité." }).max(80),
  nomCourt: z.string().trim().min(2, { error: "Indiquez le nom court (affiché sur le portail)." }).max(40),
  description: z.string().trim().max(300).default(""),
  responsableId: z.string().max(40).nullable(),
  actif: z.boolean(),
  equipes: z
    .array(
      z.object({
        id: z.string().max(40).nullable(), // null : nouvelle équipe
        nom: z.string().trim().min(2, { error: "Chaque équipe doit avoir un nom." }).max(80),
        membres: z.array(z.string().max(40)).max(50),
      }),
    )
    .max(20),
});

const schemaNouvelleActivite = schemaActivite.pick({ nom: true, nomCourt: true, description: true }).extend({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, { error: "Code de 2 à 8 lettres ou chiffres, par exemple OXY." }),
  icone: z.string().max(600).default(""),
});

/** Personnes pouvant diriger une activité ou faire partie d'une équipe : responsables de traitement actifs de la société. */
async function personnesDeLaSociete(tx: Prisma.TransactionClient, societeId: string) {
  const liste = await tx.user.findMany({
    where: { actif: true, role: "RESPONSABLE_TRAITEMENT", acces: { some: { societeId } } },
    select: { id: true },
  });
  return new Set(liste.map((u) => u.id));
}

export async function personnesActivites(societeId: string) {
  return db.user.findMany({
    where: { actif: true, role: "RESPONSABLE_TRAITEMENT", acces: { some: { societeId } } },
    orderBy: { nom: "asc" },
    select: { id: true, nom: true },
  });
}

export function modifierActivite(acteur: Acteur, societeId: string, activiteId: string, saisie: unknown, ctx: ContexteParametres) {
  return executer(acteur, societeId, ctx, async (tx) => {
    const a = schemaActivite.parse(saisie);
    const existante = await tx.activite.findFirst({ where: { id: activiteId, societeId }, select: { id: true, nom: true, equipes: { select: { id: true } } } });
    if (!existante) throw new Refus("Activité introuvable.");
    const autorises = await personnesDeLaSociete(tx, societeId);
    if (a.responsableId && !autorises.has(a.responsableId)) throw new Refus("Le responsable doit être un responsable de traitement actif de la société.");
    for (const e of a.equipes) {
      if (e.membres.some((m) => !autorises.has(m))) throw new Refus(`Équipe « ${e.nom} » : seuls les responsables de traitement actifs de la société peuvent en faire partie.`);
      if (e.id && !existante.equipes.some((x) => x.id === e.id)) throw new Refus("Équipe introuvable. Rechargez la page.");
    }

    await tx.activite.update({
      where: { id: activiteId },
      data: { nom: a.nom, nomCourt: a.nomCourt, description: a.description, responsableId: a.responsableId, actif: a.actif },
    });
    const gardees = new Set(a.equipes.map((e) => e.id).filter(Boolean));
    await tx.equipe.deleteMany({ where: { activiteId, id: { notIn: [...gardees] as string[] } } });
    for (const [ordre, e] of a.equipes.entries()) {
      const equipe = e.id
        ? await tx.equipe.update({ where: { id: e.id }, data: { nom: e.nom, ordre: ordre + 1 } })
        : await tx.equipe.create({ data: { activiteId, nom: e.nom, ordre: ordre + 1 } });
      await tx.membreEquipe.deleteMany({ where: { equipeId: equipe.id } });
      if (e.membres.length) await tx.membreEquipe.createMany({ data: [...new Set(e.membres)].map((userId) => ({ equipeId: equipe.id, userId })) });
    }
    return { message: `Activité « ${a.nom} » enregistrée`, action: "activite.modifier", entite: "Activite", entiteId: activiteId, details: a };
  });
}

export function creerActivite(acteur: Acteur, societeId: string, saisie: unknown, ctx: ContexteParametres) {
  return executer(acteur, societeId, ctx, async (tx) => {
    const a = schemaNouvelleActivite.parse(saisie);
    if (await tx.activite.findUnique({ where: { societeId_code: { societeId, code: a.code } } })) throw new Refus(`Le code ${a.code} est déjà utilisé.`);
    const ordre = ((await tx.activite.aggregate({ where: { societeId }, _max: { ordre: true } }))._max.ordre ?? 0) + 1;
    const creee = await tx.activite.create({ data: { societeId, ...a, ordre } });
    return { message: `Activité « ${a.nom} » créée`, action: "activite.creer", entite: "Activite", entiteId: creee.id, details: a };
  });
}
