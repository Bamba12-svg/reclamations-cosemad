import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { db } from "./db";
import { chargerActeur } from "./droits/acteur";
import { aLaPermission, peutAccederSociete, type Acteur, type Permission } from "./droits/permissions";

export const COOKIE_SOCIETE = "cosemad_societe";

/** Utilisateur connecté (relu en base une fois par requête), ou null. */
export const acteurCourant = cache(async (): Promise<Acteur | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return chargerActeur(db, session.user.id);
});

/** Exige une session valide et un compte actif ; sinon renvoie vers la connexion. */
export async function exigerActeur(): Promise<Acteur> {
  const acteur = await acteurCourant();
  if (!acteur) redirect("/bo/connexion");
  return acteur;
}

export const societesAccessibles = cache(async (acteur: Acteur) =>
  db.societe.findMany({
    where: acteur.toutesSocietes ? {} : { id: { in: [...acteur.societeIds] } },
    orderBy: { ordre: "asc" },
    select: { id: true, code: true, slug: true, nom: true, domaine: true, logo: true },
  }),
);

/** Société de l'URL (/bo/[societe]/…), après contrôle d'accès. */
export const exigerSociete = cache(async (slug: string) => {
  const acteur = await exigerActeur();
  const societe = await db.societe.findUnique({
    where: { slug },
    select: { id: true, code: true, slug: true, nom: true, domaine: true, logo: true, telStandard: true },
  });
  if (!societe) notFound();
  if (!peutAccederSociete(acteur, societe.id)) {
    const [premiere] = await societesAccessibles(acteur);
    if (premiere) redirect(`/bo/${premiere.slug}`);
    notFound();
  }
  return { acteur, societe };
});

/** Pour les pages réservées (ex. Paramètres) : renvoie false si la permission manque. */
export function autorise(acteur: Acteur, permission: Permission): boolean {
  return aLaPermission(acteur, permission);
}

/** Société mémorisée (dernier choix), sinon la première accessible. */
export async function slugParDefaut(acteur: Acteur): Promise<string | null> {
  const memorise = (await cookies()).get(COOKIE_SOCIETE)?.value;
  const accessibles = await societesAccessibles(acteur);
  return (accessibles.find((s) => s.slug === memorise) ?? accessibles[0])?.slug ?? null;
}
