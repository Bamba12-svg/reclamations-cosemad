import type { Metadata } from "next";
import { EcranAVenir, EnTetePage } from "@/components/bo/en-tete-page";
import { exigerSociete } from "@/server/session";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function TableauDeBord({ params }: { params: Promise<{ societe: string }> }) {
  const { acteur, societe } = await exigerSociete((await params).societe);
  return (
    <section className="flex flex-col gap-6">
      {/* Correction de la maquette : elle annonce « du Groupe » alors qu'elle n'affiche qu'une société. */}
      <EnTetePage titre="Tableau de bord" sousTitre={`Bonjour ${acteur.nom}. Voici l'état des réclamations de ${societe.nom}.`} />
      <EcranAVenir
        etape={8}
        contenu="Indicateurs (reçues, en cours, en retard, traitées, délai moyen, actions efficaces), courbe mensuelle, répartitions et liste « À traiter en priorité »."
      />
    </section>
  );
}
