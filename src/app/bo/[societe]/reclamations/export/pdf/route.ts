import type { NextRequest } from "next/server";
import { formatDate } from "@/lib/dates";
import { preparerExport, reponseFichier } from "@/server/exports/commun";
import { pdfSuivi } from "@/server/exports/pdf-suivi";

export async function GET(requete: NextRequest, { params }: { params: Promise<{ societe: string }> }) {
  const exp = await preparerExport((await params).societe, requete.nextUrl.searchParams, "pdf");
  if (!exp) return new Response("Accès refusé", { status: 403 });
  const contenu = await pdfSuivi({
    lignes: exp.lignes,
    societe: { nom: exp.societe.nom, logo: exp.societe.logo },
    perimetre: exp.perimetre,
    filtres: exp.filtres,
    edition: formatDate(new Date()),
  });
  return reponseFichier(contenu, `${exp.nomFichier}.pdf`, "application/pdf");
}
