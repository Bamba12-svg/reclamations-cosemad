import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EcranAVenir, EnTetePage } from "@/components/bo/en-tete-page";
import { db } from "@/server/db";
import { peutVoir } from "@/server/droits/permissions";
import { exigerSociete } from "@/server/session";

export const metadata: Metadata = { title: "Fiche PR06-ENR-01" };

export default async function FichePr06({ params }: { params: Promise<{ societe: string; numero: string }> }) {
  const { societe: slug, numero: brut } = await params;
  const numero = decodeURIComponent(brut).toUpperCase();
  const { acteur, societe } = await exigerSociete(slug);
  const r = await db.reclamation.findUnique({
    where: { numero },
    select: { numero: true, societeId: true, activiteId: true, responsableId: true, clotureLe: true, actions: { select: { responsableId: true } } },
  });
  if (!r || r.societeId !== societe.id || !peutVoir(acteur, r)) notFound();
  return (
    <section className="flex flex-col gap-5">
      <Link href={`/bo/${slug}/reclamations/${r.numero}`} className="self-start font-medium">
        ← Retour à la fiche {r.numero}
      </Link>
      <EnTetePage titre={`Fiche PR06-ENR-01 · ${r.numero}`} />
      <EcranAVenir etape={9} contenu="Aperçu et export PDF de la fiche « Traitement des réclamations clients » au format du formulaire papier PR06-ENR-01." />
    </section>
  );
}
