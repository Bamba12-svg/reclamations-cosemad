import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { chargerFiche } from "@/server/fiche/lecture";
import { exigerSociete } from "@/server/session";
import { Fiche, type Confirmation } from "./fiche";

export async function generateMetadata({ params }: { params: Promise<{ numero: string }> }): Promise<Metadata> {
  return { title: decodeURIComponent((await params).numero).toUpperCase() };
}

export default async function FicheReclamation({
  params,
  searchParams,
}: {
  params: Promise<{ societe: string; numero: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { societe: slug, numero: brut } = await params;
  const numero = decodeURIComponent(brut).toUpperCase();
  const { acteur, societe } = await exigerSociete(slug);
  // Hors périmètre ou autre société : même réponse qu'un numéro inexistant.
  const vue = await chargerFiche(acteur, societe.id, numero);
  if (!vue) notFound();
  const confirmation = (await searchParams).nouvelle === "1" ? await confirmationSaisie(numero) : null;
  return <Fiche vue={vue} slug={slug} confirmation={confirmation} />;
}

/** Juste après une saisie à l'accueil : SMS et e-mail de confirmation envoyés au client (bandeau de la maquette). */
async function confirmationSaisie(numero: string): Promise<Confirmation | null> {
  const messages = await db.message.findMany({
    where: { reclamation: { numero }, createdAt: { gte: new Date(Date.now() - 15 * 60_000) } },
    orderBy: { createdAt: "asc" },
    select: { canal: true, destinataire: true, corps: true },
  });
  const sms = messages.find((m) => m.canal === "SMS");
  if (!sms) return null;
  const mail = messages.find((m) => m.canal === "EMAIL");
  return { sms: sms.corps, email: mail?.corps ?? null, adresse: mail?.destinataire ?? null };
}
