"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { signIn } from "@/auth";
import { db } from "@/server/db";
import { COMPTE_DEMO, modeDemo } from "@/server/demo";
import { aLaPermission } from "@/server/droits/permissions";
import {
  activerUtilisateur,
  ajouterJourFerie,
  changerRole,
  creerActivite,
  creerUtilisateur,
  enregistrerDelais,
  enregistrerMessagerie,
  enregistrerModeles,
  modifierActivite,
  reinitialiserMotDePasse,
  supprimerJourFerie,
  testerMessagerie,
  type ContexteParametres,
  type ResultatParametres,
} from "@/server/parametres";
import type { Acteur } from "@/server/droits/permissions";
import { exigerSociete } from "@/server/session";
import { aujourdhuiDakar, chargerDemonstration } from "../../../../../prisma/seed/demonstration";

async function lancer(
  slug: string,
  operation: (acteur: Acteur, societeId: string, ctx: ContexteParametres) => Promise<ResultatParametres>,
): Promise<ResultatParametres> {
  const { acteur, societe } = await exigerSociete(slug);
  const h = await headers();
  const ctx = { ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null, userAgent: h.get("user-agent") };
  try {
    const r = await operation(acteur, societe.id, ctx);
    if (r.ok) revalidatePath(`/bo/${slug}`, "layout");
    return r;
  } catch (e) {
    console.error("[parametres]", e);
    return { ok: false, erreur: "L'enregistrement a échoué. Réessayez dans un instant." };
  }
}

export const actionDelais = async (slug: string, saisie: unknown) => lancer(slug, (a, s, c) => enregistrerDelais(a, s, saisie, c));
export const actionMessagerie = async (slug: string, saisie: unknown) => lancer(slug, (a, s, c) => enregistrerMessagerie(a, s, saisie, c));
export const actionTesterMessagerie = async (slug: string) => lancer(slug, (a, s, c) => testerMessagerie(a, s, c));
export const actionModeles = async (slug: string, saisie: unknown) => lancer(slug, (a, s, c) => enregistrerModeles(a, s, saisie, c));
export const actionAjouterFerie = async (slug: string, saisie: unknown) => lancer(slug, (a, s, c) => ajouterJourFerie(a, s, saisie, c));
export const actionSupprimerFerie = async (slug: string, jour: string) => lancer(slug, (a, s, c) => supprimerJourFerie(a, s, String(jour), c));
export const actionCreerUtilisateur = async (slug: string, saisie: unknown) => lancer(slug, (a, s, c) => creerUtilisateur(a, s, saisie, c));
export const actionRole = async (slug: string, userId: string, role: string) => lancer(slug, (a, s, c) => changerRole(a, s, String(userId), role, c));
export const actionActiver = async (slug: string, userId: string, actif: boolean) => lancer(slug, (a, s, c) => activerUtilisateur(a, s, String(userId), actif === true, c));
export const actionMotDePasse = async (slug: string, userId: string) => lancer(slug, (a, s, c) => reinitialiserMotDePasse(a, s, String(userId), c));
export const actionModifierActivite = async (slug: string, activiteId: string, saisie: unknown) => lancer(slug, (a, s, c) => modifierActivite(a, s, String(activiteId), saisie, c));
export const actionCreerActivite = async (slug: string, saisie: unknown) => lancer(slug, (a, s, c) => creerActivite(a, s, saisie, c));

/**
 * Mode démonstration : recharge les données des maquettes (dates du jour), puis reconnecte le
 * compte de démonstration — les anciens identifiants n'existent plus après le rechargement.
 */
export async function actionReinitialiserDemo(slug: string): Promise<ResultatParametres> {
  const { acteur } = await exigerSociete(slug);
  if (!modeDemo()) return { ok: false, erreur: "Réservé au mode démonstration." };
  if (!aLaPermission(acteur, "parametres.gerer")) return { ok: false, erreur: "Réservé au Service QHSE." };
  await chargerDemonstration(db, aujourdhuiDakar());
  const fatou = await db.user.findUniqueOrThrow({ where: { email: COMPTE_DEMO.email }, select: { id: true } });
  await signIn("demo", { userId: fatou.id, redirectTo: `/bo/${slug}/parametres?reinitialise=1` });
  return { ok: true, message: "Données de démonstration réinitialisées" };
}
