import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeuillePr06 } from "@/components/bo/feuille-pr06";
import { donneesPr06 } from "@/server/fiche/pr06";
import { exigerSociete } from "@/server/session";
import { BarreApercu } from "./barre";

export async function generateMetadata({ params }: { params: Promise<{ numero: string }> }): Promise<Metadata> {
  return { title: `Fiche PR06-ENR-01 · ${decodeURIComponent((await params).numero).toUpperCase()}` };
}

export default async function ApercuPr06({ params }: { params: Promise<{ societe: string; numero: string }> }) {
  const { societe: slug, numero: brut } = await params;
  const { acteur, societe } = await exigerSociete(slug);
  const d = await donneesPr06(acteur, societe.id, decodeURIComponent(brut).toUpperCase());
  if (!d) notFound();
  const fiche = `/bo/${slug}/reclamations/${d.numero}`;
  return (
    <section className="flex flex-col items-center gap-5">
      <BarreApercu retour={fiche} numero={d.numero} pdf={`${fiche}/pr06/pdf`} />
      {/* La feuille garde sa largeur A4 : sur petit écran, on la fait défiler horizontalement. */}
      <div data-print-wrap="" className="flex w-full justify-center overflow-x-auto pb-4" tabIndex={0} aria-label="Aperçu de la fiche (défilement horizontal sur petit écran)">
        <FeuillePr06 d={d} />
      </div>
    </section>
  );
}
