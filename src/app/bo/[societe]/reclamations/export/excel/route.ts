import type { NextRequest } from "next/server";
import { classeurSuivi } from "@/server/exports/excel-suivi";
import { preparerExport, reponseFichier } from "@/server/exports/commun";

export async function GET(requete: NextRequest, { params }: { params: Promise<{ societe: string }> }) {
  const exp = await preparerExport((await params).societe, requete.nextUrl.searchParams, "excel");
  if (!exp) return new Response("Accès refusé", { status: 403 });
  const contenu = await classeurSuivi(exp.lignes, `Suivi des réclamations · ${exp.societe.nom} · ${exp.perimetre}`);
  return reponseFichier(contenu, `${exp.nomFichier}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
