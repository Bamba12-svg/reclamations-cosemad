"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { TypeVisa } from "@/generated/prisma/client";
import { TAILLE_MAX_OCTETS } from "@/server/stockage/controle";
import {
  affecter,
  ajouterAction,
  ajouterPieces,
  cloturer,
  commenter,
  enregistrerCauses,
  marquerRecurrent,
  modifierAction,
  repondre,
  viser,
  type ContexteRequete,
  type ModificationAction,
  type Resultat,
} from "@/server/fiche/operations";
import { exigerActeur } from "@/server/session";
import type { Acteur } from "@/server/droits/permissions";

/**
 * Actions serveur de la fiche. Les paramètres venant du navigateur ne sont jamais crus :
 * chaque opération recharge la réclamation, revérifie les droits et valide la saisie (zod).
 */

async function contexte(): Promise<ContexteRequete> {
  const h = await headers();
  return { ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null, userAgent: h.get("user-agent") };
}

async function lancer(slug: string, operation: (acteur: Acteur, ctx: ContexteRequete) => Promise<Resultat>): Promise<Resultat> {
  const acteur = await exigerActeur(); // hors du try : la redirection vers la connexion doit se propager
  try {
    const resultat = await operation(acteur, await contexte());
    // Statut, compteurs du menu et notifications dépendent de la fiche : toute la zone société est rafraîchie.
    if (resultat.ok) revalidatePath(`/bo/${slug}`, "layout");
    return resultat;
  } catch (e) {
    console.error("[fiche]", e);
    return { ok: false, erreur: "L'opération n'a pas pu être enregistrée. Réessayez dans un instant." };
  }
}

const num = (numero: string) => String(numero).toUpperCase();

export async function actionAffecter(slug: string, numero: string, responsableId: string | null) {
  return lancer(slug, (a, c) => affecter(a, num(numero), responsableId ? String(responsableId) : null, c));
}

export async function actionRecurrent(slug: string, numero: string, recurrent: boolean) {
  return lancer(slug, (a, c) => marquerRecurrent(a, num(numero), recurrent === true, c));
}

export async function actionAjouterAction(slug: string, numero: string, saisie: unknown) {
  return lancer(slug, (a, c) => ajouterAction(a, num(numero), saisie, c));
}

export async function actionModifierAction(slug: string, numero: string, actionId: string, modification: ModificationAction) {
  return lancer(slug, (a, c) => modifierAction(a, num(numero), String(actionId), modification, c));
}

export async function actionRepondre(slug: string, numero: string, saisie: unknown) {
  return lancer(slug, (a, c) => repondre(a, num(numero), saisie, c));
}

export async function actionCauses(slug: string, numero: string, causes: string) {
  return lancer(slug, (a, c) => enregistrerCauses(a, num(numero), { causes }, c));
}

export async function actionViser(slug: string, numero: string, type: TypeVisa) {
  if (type !== "QHSE" && type !== "DIRECTION_COMMERCIALE") return { ok: false, erreur: "Visa inconnu." } satisfies Resultat;
  return lancer(slug, (a, c) => viser(a, num(numero), type, c));
}

export async function actionCloturer(slug: string, numero: string) {
  return lancer(slug, (a, c) => cloturer(a, num(numero), c));
}

export async function actionCommenter(slug: string, numero: string, texte: string) {
  return lancer(slug, (a, c) => commenter(a, num(numero), { texte }, c));
}

export async function actionAjouterPieces(slug: string, numero: string, donnees: FormData) {
  const fichiers = donnees.getAll("fichiers").filter((f): f is File => f instanceof File && f.size > 0);
  if (fichiers.some((f) => f.size > TAILLE_MAX_OCTETS)) return { ok: false, erreur: "Chaque fichier doit faire 10 Mo au maximum." } satisfies Resultat;
  const lus = await Promise.all(fichiers.map(async (f) => ({ nom: f.name, octets: new Uint8Array(await f.arrayBuffer()) })));
  return lancer(slug, (a, c) => ajouterPieces(a, num(numero), lus, c));
}
