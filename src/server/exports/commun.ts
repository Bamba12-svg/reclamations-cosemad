import "server-only";
import { aujourdhuiIso } from "@/lib/dates";
import { db } from "../db";
import { aLaPermission } from "../droits/permissions";
import { journaliser } from "../journal";
import { chargerSuivi, lireFiltres, responsablesSuivi, texteFiltres } from "../requetes/suivi";
import { exigerSociete } from "../session";

/** Données communes aux exports Excel et PDF (mêmes droits, mêmes filtres que l'écran). */
export async function preparerExport(slug: string, recherche: URLSearchParams, format: "excel" | "pdf") {
  const { acteur, societe } = await exigerSociete(slug);
  if (!aLaPermission(acteur, "reclamation.exporter")) return null;
  const filtres = lireFiltres(Object.fromEntries(recherche));
  const [{ lignes }, responsables, activite] = await Promise.all([
    chargerSuivi(acteur, societe.id, filtres, { tout: true }),
    responsablesSuivi(societe.id),
    filtres.activite ? db.activite.findFirst({ where: { societeId: societe.id, code: filtres.activite }, select: { nom: true } }) : null,
  ]);
  await journaliser(db, {
    action: "reclamation.exporter",
    entite: "Reclamation",
    userId: acteur.id,
    societeId: societe.id,
    details: { format, lignes: lignes.length, filtres: { ...filtres } },
  });
  const perimetre = activite?.nom ?? "Toutes les activités";
  const jour = aujourdhuiIso();
  const nomFichier = `suivi-reclamations-${societe.code.toLowerCase()}-${filtres.activite?.toLowerCase() ?? "toutes-activites"}-${jour}`;
  return { societe, lignes, perimetre, filtres: texteFiltres(filtres, responsables), nomFichier };
}

export function reponseFichier(contenu: Buffer, nomFichier: string, type: string): Response {
  return new Response(new Uint8Array(contenu), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
      "Content-Length": String(contenu.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
