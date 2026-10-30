/** Validation des formulaires du back-office — revalidés côté serveur dans chaque action. */
import { z } from "zod";
import { estJourIso } from "@/lib/dates";
import { ORIGINES } from "@/lib/libelles";
import { variablesInconnues } from "@/lib/modeles";
import {
  emailFacultatif,
  heure,
  identifiant,
  jour,
  modeTransmission,
  sousTypeProduit,
  telephoneSenegal,
} from "./communs";

// ───────── Nouvelle réclamation (accueil) ─────────
export const schemaNouvelleReclamation = z
  .object({
    mode: modeTransmission,
    origine: z.enum(ORIGINES, { error: "Choisissez l'origine de la réclamation." }),
    dateReception: jour,
    heureReception: heure,
    responsableId: identifiant.nullable().default(null),
    nom: z.string().trim().min(2, { error: "Indiquez le nom du client ou de la société." }).max(120),
    telephone: telephoneSenegal,
    email: emailFacultatif,
    activiteId: z.string({ error: "Choisissez l'activité concernée." }).min(1, { error: "Choisissez l'activité concernée." }),
    type: z.enum(["PRODUIT", "SERVICE", "AUTRE"], { error: "Choisissez le type." }),
    sousType: sousTypeProduit.nullable().default(null),
    description: z.string().trim().min(15, { error: "Décrivez le problème en au moins 15 caractères." }).max(1000),
  })
  .superRefine((v, ctx) => {
    if (v.type === "PRODUIT" && !v.sousType) {
      ctx.addIssue({ code: "custom", path: ["type"], message: "Précisez qualité, prix ou fonctionnalité." });
    }
  });

// ───────── Fiche ─────────
export const schemaAction = z.object({
  libelle: z.string().trim().min(1, { error: "Décrivez l'action à mener." }).max(300),
  responsableId: identifiant,
  echeance: z.string().refine(estJourIso, { error: "Indiquez l'échéance de l'action." }),
  statut: z.enum(["A_FAIRE", "EN_COURS", "REALISEE"]).default("A_FAIRE"),
  critere: z.string().trim().max(300).default(""),
});

export const schemaReponse = z.object({
  texte: z.string().trim().min(20, { error: "La réponse doit comporter au moins 20 caractères." }).max(600, { error: "600 caractères au maximum." }),
  canaux: z.array(z.enum(["SMS", "EMAIL"])).min(1, { error: "Choisissez SMS, e-mail ou les deux." }),
});

export const schemaCauses = z.object({ causes: z.string().trim().max(5000) });
export const schemaObservations = z.object({ observations: z.string().trim().max(2000) });
export const schemaCommentaire = z.object({ texte: z.string().trim().min(1).max(2000, { error: "2 000 caractères au maximum." }) });

// ───────── Paramètres (QHSE) ─────────
const modeleSansVariableInconnue = (s: z.ZodString) =>
  s.refine((t) => variablesInconnues(t).length === 0, {
    error: (iss) => `Variable inconnue : {${variablesInconnues(String(iss.input))[0] ?? ""}}. Variables possibles : {numero}, {nom}, {date}, {delai}.`,
  });

export const schemaDelais = z.object({
  delaiQualificationH: z.coerce.number().int().min(1).max(720),
  delaiReponseJO: z.coerce.number().int().min(1).max(60),
  delaiClotureJ: z.coerce.number().int().min(1).max(365),
});

export const schemaModeles = z.object({
  modeleSms: modeleSansVariableInconnue(z.string().trim().min(10).max(160, { error: "Le SMS ne doit pas dépasser 160 caractères." })),
  modeleEmailObjet: modeleSansVariableInconnue(z.string().trim().min(3).max(150)),
  modeleEmail: modeleSansVariableInconnue(z.string().trim().min(10).max(3000)),
});

/** Serveur SMTP : un nom d'hôte public (pas d'adresse IP ni de nom local), ports chiffrés uniquement. */
const HOTE = /^(?=.{4,253}$)(?!-)[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63})+$/;

export const schemaMessagerie = z
  .object({
    emailEnvoi: emailFacultatif.default(null),
    motDePasse: z.string().max(200, { error: "Mot de passe trop long." }).default(""), // vide : inchangé
    nomExpediteur: z
      .string()
      .trim()
      .max(120)
      .refine((v) => !/["<>\r\n]/.test(v), { error: "Évitez les guillemets et les chevrons." })
      .default(""),
    hote: z
      .string()
      .trim()
      .toLowerCase()
      .refine((v) => HOTE.test(v) && !/^[0-9.]+$/.test(v) && !v.endsWith(".local") && v !== "localhost", { error: "Indiquez le nom du serveur, par exemple mail.infomaniak.com." })
      .default("mail.infomaniak.com"),
    port: z.coerce.number().refine((p) => p === 465 || p === 587, { error: "Port 465 (SSL) ou 587 (STARTTLS)." }).default(465),
    emailReponse: emailFacultatif.default(null),
  });

export const schemaUtilisateur = z.object({
  nom: z.string().trim().min(2).max(120),
  email: z.email({ error: "Adresse e-mail invalide." }).trim().toLowerCase(),
  fonction: z.string().trim().max(120).default(""),
  role: z.enum(["QHSE", "DIRECTION_COMMERCIALE", "AGENT_ACCUEIL", "RESPONSABLE_TRAITEMENT", "DIRECTION_GENERALE"]),
  toutesSocietes: z.boolean(),
  societeIds: z.array(identifiant).default([]),
});

export const schemaMotDePasse = z
  .string()
  .min(10, { error: "10 caractères au minimum." })
  .max(128)
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), { error: "Au moins une lettre et un chiffre." });
