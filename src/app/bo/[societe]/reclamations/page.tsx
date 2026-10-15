import type { Metadata } from "next";
import { EcranAVenir, EnTetePage } from "@/components/bo/en-tete-page";
import { exigerSociete } from "@/server/session";

export const metadata: Metadata = { title: "Tableau de suivi" };

export default async function TableauDeSuivi({ params, searchParams }: { params: Promise<{ societe: string }>; searchParams: Promise<{ q?: string }> }) {
  await exigerSociete((await params).societe);
  const q = (await searchParams).q?.trim();
  return (
    <section className="flex flex-col gap-5">
      <EnTetePage titre="Tableau de suivi des réclamations" sousTitre="Même structure que le tableau Excel. Cliquez sur une ligne pour ouvrir la fiche." />
      {q && <p className="m-0 text-encre-3">Recherche : « {q} »</p>}
      <EcranAVenir etape={5} contenu="Les 14 colonnes du tableau Excel, onglets par activité, filtres (statut, type, mode, responsable, récurrent), recherche, export Excel et PDF." />
    </section>
  );
}
