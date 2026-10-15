import type { Metadata } from "next";
import { EcranAVenir, EnTetePage } from "@/components/bo/en-tete-page";
import { exigerSociete } from "@/server/session";

export const metadata: Metadata = { title: "Mes actions" };

export default async function MesActions({ params }: { params: Promise<{ societe: string }> }) {
  const { acteur } = await exigerSociete((await params).societe);
  return (
    <section className="flex max-w-240 flex-col gap-5">
      <EnTetePage titre="Mes actions" sousTitre={`Actions confiées à ${acteur.nom}, de la plus urgente à la moins urgente.`} />
      <EcranAVenir etape={7} contenu="Actions classées par urgence (dépassée, aujourd'hui, J-n) avec le bouton « Marquer comme réalisée »." />
    </section>
  );
}
