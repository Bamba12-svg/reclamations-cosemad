/**
 * Procédure PR06 : conditions de visa et de clôture, étapes de la fiche.
 * Ces fonctions sont la seule source de vérité : l'interface les affiche, le serveur les
 * revérifie avant chaque visa ou clôture.
 */
import type { StatutAction, TypeVisa } from "@/generated/prisma/client";

export interface ReclamationPourCloture {
  responsableId: string | null;
  causes: string | null;
  reponseLe: Date | null;
  clotureLe: Date | null;
  actions: readonly { statut: StatutAction; efficace: boolean | null }[];
  visas: readonly { type: TypeVisa }[];
}

export interface Condition {
  cle: string;
  libelle: string;
  remplie: boolean;
}

const aDesActions = (r: ReclamationPourCloture) => r.actions.length > 0;
const toutesRealisees = (r: ReclamationPourCloture) => aDesActions(r) && r.actions.every((a) => a.statut === "REALISEE");
const toutesEvaluees = (r: ReclamationPourCloture) => aDesActions(r) && r.actions.every((a) => a.efficace !== null);
const causesRenseignees = (r: ReclamationPourCloture) => !!r.causes?.trim();
const vise = (r: ReclamationPourCloture, type: TypeVisa) => r.visas.some((v) => v.type === type);

/** Liste « Avant de clôturer » : 8 conditions, dans l'ordre de la maquette. */
export function conditionsCloture(r: ReclamationPourCloture): Condition[] {
  return [
    { cle: "responsable", libelle: "Responsable de traitement désigné", remplie: !!r.responsableId },
    { cle: "action", libelle: "Au moins une action enregistrée", remplie: aDesActions(r) },
    { cle: "realisees", libelle: "Toutes les actions réalisées", remplie: toutesRealisees(r) },
    { cle: "efficacite", libelle: "Efficacité de chaque action renseignée", remplie: toutesEvaluees(r) },
    { cle: "causes", libelle: "Causes racines renseignées", remplie: causesRenseignees(r) },
    { cle: "reponse", libelle: "Réponse envoyée au client", remplie: !!r.reponseLe },
    { cle: "visaDC", libelle: "Visa de la Direction Commerciale", remplie: vise(r, "DIRECTION_COMMERCIALE") },
    { cle: "visaQHSE", libelle: "Visa du Service QHSE", remplie: vise(r, "QHSE") },
  ];
}

export function conditionsManquantes(r: ReclamationPourCloture): Condition[] {
  return conditionsCloture(r).filter((c) => !c.remplie);
}

export function peutEtreCloturee(r: ReclamationPourCloture): boolean {
  return !r.clotureLe && conditionsManquantes(r).length === 0;
}

/** « 1 élément manque pour clôturer » / « 5 éléments manquent pour clôturer » */
export function texteManquants(n: number): string {
  return n === 1 ? "1 élément manque pour clôturer" : `${n} éléments manquent pour clôturer`;
}

/** Raison pour laquelle un visa n'est pas encore possible (null si possible). Le contrôle du rôle est fait à part. */
export function blocageVisa(r: ReclamationPourCloture, type: TypeVisa): string | null {
  if (r.clotureLe) return "La réclamation est clôturée.";
  if (vise(r, type)) return "Cette fiche est déjà visée.";
  if (type === "DIRECTION_COMMERCIALE") {
    return r.reponseLe ? null : "La réponse au client doit d'abord être envoyée.";
  }
  const pret = toutesRealisees(r) && toutesEvaluees(r) && causesRenseignees(r);
  return pret ? null : "Toutes les actions doivent être réalisées et évaluées, et les causes racines renseignées.";
}

/** Fiche « à viser » : traitement terminé, réponse envoyée, au moins un visa manquant. */
export function estAViser(r: ReclamationPourCloture): boolean {
  return !r.clotureLe && !!r.reponseLe && toutesRealisees(r) && (!vise(r, "DIRECTION_COMMERCIALE") || !vise(r, "QHSE"));
}

export interface EtapeFiche {
  numero: number;
  libelle: string;
  faite: boolean;
  courante: boolean;
}

/** Frise des 6 étapes en haut de la fiche. */
export function etapesFiche(r: ReclamationPourCloture): EtapeFiche[] {
  const faites = [
    true,
    !!r.responsableId,
    toutesRealisees(r),
    !!r.reponseLe,
    causesRenseignees(r) && toutesEvaluees(r),
    !!r.clotureLe,
  ];
  const courante = faites.indexOf(false);
  return ["Réception", "Qualification", "Traitement", "Retour client", "Amélioration continue", "Clôture"].map((libelle, i) => ({
    numero: i + 1,
    libelle,
    faite: faites[i] ?? false,
    courante: i === courante,
  }));
}
