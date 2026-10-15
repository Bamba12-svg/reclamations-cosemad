/**
 * Statut d'une réclamation — jamais stocké, toujours calculé (règle de la maquette) :
 *   Traitée    : la réclamation est clôturée (8 conditions remplies, visas compris) ;
 *   En retard  : sinon, au moins une action non réalisée a dépassé son échéance ;
 *   En cours   : sinon, un responsable de traitement est désigné ;
 *   Nouvelle   : sinon.
 * « En retard » dépend du jour : le stocker obligerait à le recalculer chaque nuit.
 * calculerStatut (en mémoire) et filtreStatut (requête SQL) doivent rester équivalents :
 * un test d'intégration les compare sur toute la base.
 */
import type { Prisma, StatutAction } from "@/generated/prisma/client";
import { debutDuJour, jourIso, type JourIso } from "@/lib/dates";
import type { StatutReclamation } from "@/lib/libelles";

export interface ActionPourStatut {
  statut: StatutAction;
  echeance: Date; // colonne @db.Date (minuit UTC)
}

export interface ReclamationPourStatut {
  clotureLe: Date | null;
  responsableId: string | null;
  actions: readonly ActionPourStatut[];
}

export function actionEnRetard(a: ActionPourStatut, aujourdhui: JourIso): boolean {
  return a.statut !== "REALISEE" && jourIso(a.echeance) < aujourdhui;
}

export function calculerStatut(r: ReclamationPourStatut, aujourdhui: JourIso): StatutReclamation {
  if (r.clotureLe) return "TRAITEE";
  if (r.actions.some((a) => actionEnRetard(a, aujourdhui))) return "EN_RETARD";
  if (r.responsableId) return "EN_COURS";
  return "NOUVELLE";
}

/** Condition Prisma équivalente à calculerStatut, pour filtrer et compter en base. */
export function filtreStatut(statut: StatutReclamation, aujourdhui: JourIso): Prisma.ReclamationWhereInput {
  const actionsEnRetard: Prisma.ActionWhereInput = { statut: { not: "REALISEE" }, echeance: { lt: debutDuJour(aujourdhui) } };
  switch (statut) {
    case "TRAITEE":
      return { clotureLe: { not: null } };
    case "EN_RETARD":
      return { clotureLe: null, actions: { some: actionsEnRetard } };
    case "EN_COURS":
      return { clotureLe: null, responsableId: { not: null }, actions: { none: actionsEnRetard } };
    case "NOUVELLE":
      return { clotureLe: null, responsableId: null, actions: { none: actionsEnRetard } };
  }
}

/** Étapes affichées au client sur le portail. Le statut « En retard » n'y apparaît jamais. */
export interface EtapeClient {
  cle: "RECUE" | "ANALYSE" | "REPONSE" | "CLOTURE";
  libelle: string;
  faite: boolean;
  date: Date | null;
}

export function etapesClient(r: {
  recueLe: Date;
  responsableId: string | null;
  affecteeLe: Date | null;
  reponseLe: Date | null;
  clotureLe: Date | null;
}): EtapeClient[] {
  return [
    { cle: "RECUE", libelle: "Reçue", faite: true, date: r.recueLe },
    { cle: "ANALYSE", libelle: "En cours d'analyse", faite: !!r.responsableId, date: r.responsableId ? r.affecteeLe : null },
    { cle: "REPONSE", libelle: "Réponse envoyée", faite: !!r.reponseLe, date: r.reponseLe },
    { cle: "CLOTURE", libelle: "Clôturée", faite: !!r.clotureLe, date: r.clotureLe },
  ];
}
