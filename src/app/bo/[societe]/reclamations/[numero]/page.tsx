import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { chargerFiche } from "@/server/fiche/lecture";
import { exigerSociete } from "@/server/session";
import { Fiche } from "./fiche";

export async function generateMetadata({ params }: { params: Promise<{ numero: string }> }): Promise<Metadata> {
  return { title: decodeURIComponent((await params).numero).toUpperCase() };
}

export default async function FicheReclamation({ params }: { params: Promise<{ societe: string; numero: string }> }) {
  const { societe: slug, numero } = await params;
  const { acteur, societe } = await exigerSociete(slug);
  // Hors périmètre ou autre société : même réponse qu'un numéro inexistant.
  const vue = await chargerFiche(acteur, societe.id, decodeURIComponent(numero).toUpperCase());
  if (!vue) notFound();
  return <Fiche vue={vue} slug={slug} />;
}
