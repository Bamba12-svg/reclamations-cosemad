import type { Metadata } from "next";
import { EnTetePage } from "@/components/bo/en-tete-page";
import { mesActions } from "@/server/requetes/listes";
import { exigerSociete } from "@/server/session";
import { ListeActions } from "./liste";

export const metadata: Metadata = { title: "Mes actions" };

export default async function MesActions({ params }: { params: Promise<{ societe: string }> }) {
  const { societe: slug } = await params;
  const { acteur, societe } = await exigerSociete(slug);
  const actions = await mesActions(acteur, societe.id);
  return (
    <section className="flex max-w-240 flex-col gap-5">
      <EnTetePage titre="Mes actions" sousTitre={`Actions confiées à ${acteur.nom}, de la plus urgente à la moins urgente.`} />
      <ListeActions actions={actions} slug={slug} />
    </section>
  );
}
