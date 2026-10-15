import { db } from "@/server/db";
import { aLaPermission } from "@/server/droits/permissions";
import { donneesPr06 } from "@/server/fiche/pr06";
import { reponseFichier } from "@/server/exports/commun";
import { pdfPr06 } from "@/server/exports/pdf-pr06";
import { journaliser } from "@/server/journal";
import { exigerSociete } from "@/server/session";

/** Téléchargement du PDF de la fiche PR06-ENR-01 (mêmes droits que la consultation de la fiche). */
export async function GET(_requete: Request, { params }: { params: Promise<{ societe: string; numero: string }> }) {
  const { societe: slug, numero: brut } = await params;
  const { acteur, societe } = await exigerSociete(slug);
  if (!aLaPermission(acteur, "reclamation.exporter")) return new Response("Accès refusé.", { status: 403 });
  const d = await donneesPr06(acteur, societe.id, decodeURIComponent(brut).toUpperCase());
  if (!d) return new Response("Réclamation introuvable.", { status: 404 });
  const pdf = await pdfPr06(d);
  await journaliser(db, { action: "reclamation.exporter_pr06", entite: "Reclamation", userId: acteur.id, societeId: societe.id, details: { numero: d.numero } });
  return reponseFichier(pdf, `PR06-ENR-01_${d.numero}.pdf`, "application/pdf");
}
