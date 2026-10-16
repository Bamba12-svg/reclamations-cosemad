import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { COMPTE_DEMO, modeDemo } from "@/server/demo";
import { acteurCourant, COOKIE_SOCIETE, slugParDefaut } from "@/server/session";
import { FormulaireConnexion } from "./formulaire";

export const metadata: Metadata = { title: "Connexion" };

export default async function PageConnexion({ searchParams }: { searchParams: Promise<{ societe?: string }> }) {
  const acteur = await acteurCourant();
  if (acteur) {
    if (acteur.doitChangerMotDePasse) redirect("/bo/mot-de-passe");
    const slug = await slugParDefaut(acteur);
    redirect(slug ? `/bo/${slug}` : "/");
  }

  const societes = await db.societe.findMany({
    orderBy: { ordre: "asc" },
    select: { slug: true, nom: true, domaine: true, logo: true },
  });
  const demandee = (await searchParams).societe;
  const memorisee = (await cookies()).get(COOKIE_SOCIETE)?.value;
  const initiale = societes.find((s) => s.slug === demandee) ?? societes.find((s) => s.slug === memorisee) ?? societes[0];

  return (
    <FormulaireConnexion
      societes={societes}
      societeInitiale={initiale?.slug ?? ""}
      compteDemo={modeDemo() ? COMPTE_DEMO : null}
    />
  );
}
