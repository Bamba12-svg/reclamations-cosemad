import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SuiviReclamation } from "@/components/portail/suivi";
import { EXEMPLES_SUIVI, modeDemo } from "@/server/demo";
import { societePortail } from "@/server/portail";

export const metadata: Metadata = { title: "Suivre ma réclamation" };

/** P4 — Suivi : numéro + téléphone. */
export default async function PageSuivi({ params, searchParams }: { params: Promise<{ societe: string }>; searchParams: Promise<{ numero?: string }> }) {
  const [societe, { numero }] = await Promise.all([societePortail((await params).societe), searchParams]);
  if (!societe) notFound();
  const exemple = EXEMPLES_SUIVI[societe.code] ?? null;
  return <SuiviReclamation numeroInitial={(numero ?? "").slice(0, 20).toUpperCase()} exemple={modeDemo() ? exemple : null} prefixe={societe.code} />;
}
