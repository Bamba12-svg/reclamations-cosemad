/**
 * Validation du portail client — messages repris mot pour mot de la maquette.
 * Chaque étape est validée dans le navigateur ; le dépôt complet est revalidé côté serveur.
 */
import { z } from "zod";
import { SECTEURS_PORTAIL } from "@/lib/libelles";
import { canaux, emailFacultatif, identifiant, sousTypeProduit, telephoneSenegal, typeReclamation } from "./communs";

// ───────── Étape 1 : Vous ─────────
const baseVous = z.object({
  profil: z.enum(["PARTICULIER", "SOCIETE"]),
  nom: z.string().trim().max(120),
  secteur: z.enum(SECTEURS_PORTAIL).nullable().default(null),
  secteurAutre: z.string().trim().max(80).default(""),
  contactNom: z.string().trim().max(120).default(""),
  contactFonction: z.string().trim().max(120).default(""),
  telephone: telephoneSenegal,
  email: emailFacultatif,
  canaux,
});

type Vous = z.output<typeof baseVous>;

function verifierVous(v: Vous, ctx: z.RefinementCtx) {
  const societe = v.profil === "SOCIETE";
  if (v.nom.length < 2) {
    ctx.addIssue({ code: "custom", path: ["nom"], message: societe ? "Indiquez le nom de la société." : "Indiquez votre nom et prénom." });
  }
  if (societe) {
    if (!v.secteur) ctx.addIssue({ code: "custom", path: ["secteur"], message: "Choisissez le secteur d'activité." });
    else if (v.secteur === "Autre" && v.secteurAutre.length < 2) {
      ctx.addIssue({ code: "custom", path: ["secteur"], message: "Précisez votre secteur d'activité." });
    }
    if (v.contactNom.length < 2) ctx.addIssue({ code: "custom", path: ["contactNom"], message: "Indiquez la personne à recontacter." });
  }
  if (v.canaux.includes("EMAIL") && !v.email) {
    ctx.addIssue({ code: "custom", path: ["email"], message: "Indiquez votre e-mail pour recevoir la réponse par e-mail." });
  }
}

export const schemaEtapeVous = baseVous.superRefine(verifierVous);

// ───────── Étape 2 : Votre réclamation (assistant en 5 questions) ─────────
export const schemaQuestionActivite = z.object({
  activiteCode: z.string({ error: "Choisissez l'activité concernée." }).min(1, { error: "Choisissez l'activité concernée." }),
});

export const schemaQuestionType = z
  .object({ type: typeReclamation, sousType: sousTypeProduit.nullable().default(null) })
  .superRefine((v, ctx) => {
    if (v.type === "PRODUIT" && !v.sousType) {
      ctx.addIssue({ code: "custom", path: ["type"], message: "Précisez : qualité, prix ou fonctionnement." });
    }
  });

export const schemaQuestionDescription = z.object({
  description: z
    .string()
    .trim()
    .min(15, { error: "Décrivez le problème en au moins 15 caractères." })
    .max(1000, { error: "1 000 caractères au maximum." }),
});

export const schemaQuestionPremiereFois = z.object({
  premiereFois: z.boolean({ error: "Choisissez une réponse." }),
});
// Question 5 (photo ou document) : facultative, contrôlée à la réception des fichiers.

// ───────── Étape 3 : Vérification ─────────
export const schemaConsentement = z.object({
  consentement: z.literal(true, { error: "Cochez cette case pour envoyer votre réclamation." }),
});

/** Dépôt complet, revalidé côté serveur (les fichiers sont contrôlés à part). */
export const schemaDepotPortail = baseVous
  .extend({
    societe: z.string().min(1).max(40), // slug de la société choisie
    activiteCode: identifiant,
    type: typeReclamation,
    sousType: sousTypeProduit.nullable().default(null),
    description: schemaQuestionDescription.shape.description,
    premiereFois: z.boolean({ error: "Choisissez une réponse." }),
    consentement: z.literal(true, { error: "Cochez cette case pour envoyer votre réclamation." }),
  })
  .superRefine((v, ctx) => {
    verifierVous(v, ctx);
    if (v.type === "PRODUIT" && !v.sousType) {
      ctx.addIssue({ code: "custom", path: ["type"], message: "Précisez : qualité, prix ou fonctionnement." });
    }
  });

export type DepotPortail = z.output<typeof schemaDepotPortail>;

// ───────── Suivi ─────────
export const schemaSuivi = z.object({
  numero: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,5}-\d{4}-\d{4,}$/, { error: "Saisissez le numéro de réclamation et votre téléphone à 9 chiffres." }),
  telephone: telephoneSenegal,
});
