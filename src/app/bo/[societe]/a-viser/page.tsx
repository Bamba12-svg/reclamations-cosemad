import type { Metadata } from "next";
import { EcranAVenir, EnTetePage } from "@/components/bo/en-tete-page";
import { exigerSociete } from "@/server/session";

export const metadata: Metadata = { title: "À viser" };

export default async function AViser({ params }: { params: Promise<{ societe: string }> }) {
  await exigerSociete((await params).societe);
  return (
    <section className="flex max-w-240 flex-col gap-5">
      <EnTetePage
        titre="À viser"
        sousTitre="Fiches dont le traitement est terminé et la réponse envoyée. Elles attendent le visa de la Direction Commerciale et du Service QHSE."
      />
      <EcranAVenir etape={7} contenu="Liste des fiches en attente de visa, avec l'état de chaque visa." />
    </section>
  );
}
