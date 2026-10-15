import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EcranAVenir, EnTetePage } from "@/components/bo/en-tete-page";
import { db } from "@/server/db";
import { peutVoir } from "@/server/droits/permissions";
import { exigerSociete } from "@/server/session";

export async function generateMetadata({ params }: { params: Promise<{ numero: string }> }): Promise<Metadata> {
  return { title: decodeURIComponent((await params).numero) };
}

export default async function FicheReclamation({ params }: { params: Promise<{ societe: string; numero: string }> }) {
  const { societe: slug, numero } = await params;
  const { acteur, societe } = await exigerSociete(slug);
  const r = await db.reclamation.findUnique({
    where: { numero: decodeURIComponent(numero).toUpperCase() },
    select: { numero: true, societeId: true, activiteId: true, responsableId: true, clotureLe: true, clientNom: true, actions: { select: { responsableId: true } } },
  });
  // Hors périmètre ou autre société : même réponse qu'un numéro inexistant.
  if (!r || r.societeId !== societe.id || !peutVoir(acteur, r)) notFound();
  return (
    <section className="flex flex-col gap-5">
      <EnTetePage titre={r.numero} sousTitre={r.clientNom} />
      <EcranAVenir etape={6} contenu="Les 6 sections de la fiche, « Avant de clôturer », pièces jointes, commentaires internes, historique et export PR06-ENR-01." />
    </section>
  );
}
