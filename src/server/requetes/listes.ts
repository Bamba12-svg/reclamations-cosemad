import "server-only";
import { aujourdhuiIso, ecartJours, formatDate, jourIso } from "@/lib/dates";
import type { StatutReclamation } from "@/lib/libelles";
import { db } from "../db";
import { estAViser } from "../domaine/cloture";
import { calculerStatut } from "../domaine/statut";
import { filtreVisibilite, type Acteur } from "../droits/permissions";

export interface ActionAFaire {
  id: string;
  numero: string;
  client: string;
  libelle: string;
  critere: string;
  echeance: string; // 15/10/2026
  ecart: number; // jours jusqu'à l'échéance (négatif : dépassée)
}

/**
 * « Mes actions » : actions confiées à l'utilisateur, non réalisées, sur les réclamations ouvertes
 * qu'il voit dans la société — même règle que le compteur du menu — de la plus urgente à la moins urgente.
 */
export async function mesActions(acteur: Acteur, societeId: string, maintenant = new Date()): Promise<ActionAFaire[]> {
  const aujourdhui = aujourdhuiIso(maintenant);
  const actions = await db.action.findMany({
    where: {
      responsableId: acteur.id,
      statut: { not: "REALISEE" },
      reclamation: { AND: [filtreVisibilite(acteur, societeId), { clotureLe: null }] },
    },
    orderBy: [{ echeance: "asc" }, { reclamation: { numero: "asc" } }, { ordre: "asc" }],
    select: { id: true, libelle: true, critere: true, echeance: true, reclamation: { select: { numero: true, clientNom: true } } },
  });
  return actions.map((a) => ({
    id: a.id,
    numero: a.reclamation.numero,
    client: a.reclamation.clientNom,
    libelle: a.libelle,
    critere: a.critere,
    echeance: formatDate(a.echeance),
    ecart: ecartJours(aujourdhui, jourIso(a.echeance)),
  }));
}

export interface FicheAViser {
  numero: string;
  client: string;
  activite: string;
  description: string;
  statut: StatutReclamation;
  viseeDC: boolean;
  viseeQHSE: boolean;
}

/** « À viser » : traitement terminé, réponse envoyée, au moins un visa manquant (règle estAViser). */
export async function fichesAViser(acteur: Acteur, societeId: string, maintenant = new Date()): Promise<FicheAViser[]> {
  const aujourdhui = aujourdhuiIso(maintenant);
  const candidates = await db.reclamation.findMany({
    where: { AND: [filtreVisibilite(acteur, societeId), { clotureLe: null, reponseLe: { not: null } }] },
    orderBy: { reponseLe: "asc" },
    select: {
      numero: true,
      clientNom: true,
      description: true,
      responsableId: true,
      causes: true,
      reponseLe: true,
      clotureLe: true,
      activite: { select: { nom: true } },
      actions: { select: { statut: true, efficace: true, echeance: true } },
      visas: { select: { type: true } },
    },
  });
  return candidates.filter(estAViser).map((r) => ({
    numero: r.numero,
    client: r.clientNom,
    activite: r.activite.nom,
    description: r.description,
    statut: calculerStatut(r, aujourdhui),
    viseeDC: r.visas.some((v) => v.type === "DIRECTION_COMMERCIALE"),
    viseeQHSE: r.visas.some((v) => v.type === "QHSE"),
  }));
}
