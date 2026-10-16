import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LONGUEUR_MIN_MOT_DE_PASSE } from "@/server/compte";
import { db } from "@/server/db";
import { acteurCourant, slugParDefaut } from "@/server/session";
import { FormulaireMotDePasse } from "./formulaire";

export const metadata: Metadata = { title: "Choisir votre mot de passe" };

/** Première connexion (ou mot de passe réinitialisé par le QHSE) : remplacement obligatoire du mot de passe provisoire. */
export default async function PageMotDePasse() {
  const acteur = await acteurCourant();
  if (!acteur) redirect("/bo/connexion");
  const slug = await slugParDefaut(acteur);
  if (!acteur.doitChangerMotDePasse) redirect(slug ? `/bo/${slug}` : "/bo");
  const [user, societe] = await Promise.all([
    db.user.findUnique({ where: { id: acteur.id }, select: { email: true } }),
    slug ? db.societe.findUnique({ where: { slug }, select: { nom: true, logo: true } }) : null,
  ]);
  return <FormulaireMotDePasse nom={acteur.nom} email={user?.email ?? ""} societe={societe} longueurMin={LONGUEUR_MIN_MOT_DE_PASSE} />;
}
