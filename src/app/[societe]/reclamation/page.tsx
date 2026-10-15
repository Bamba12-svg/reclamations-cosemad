import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DepotReclamation } from "@/components/portail/depot";
import { societePortail } from "@/server/portail";

export const metadata: Metadata = { title: "Déposer une réclamation" };

/** P2 — Dépôt en 3 étapes (Vous, Votre réclamation en 5 questions, Vérification) puis P3 — Confirmation. */
export default async function PageDepot({ params }: { params: Promise<{ societe: string }> }) {
  const societe = await societePortail((await params).societe);
  if (!societe) notFound();
  return (
    <DepotReclamation
      societe={{ slug: societe.slug, nom: societe.nom }}
      activites={societe.activites}
      delais={{ qualificationH: societe.delais.qualificationH, reponseJO: societe.delais.reponseJO }}
    />
  );
}
