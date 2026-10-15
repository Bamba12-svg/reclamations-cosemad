/**
 * Alertes de délai (cibles réglées par le QHSE pour chaque société) — distinctes du statut
 * « En retard », qui ne dépend que des échéances des actions.
 */
import { ecartJours, jourIso, type JourIso } from "@/lib/dates";
import { joursOuvresEcoules } from "./jours-ouvres";

export interface Delais {
  qualificationH: number; // affectation d'un responsable
  reponseJO: number; // réponse au client, en jours ouvrés
  clotureJ: number; // clôture, en jours calendaires
}

export const DELAIS_PAR_DEFAUT: Delais = { qualificationH: 24, reponseJO: 5, clotureJ: 15 };

export type TypeAlerte = "QUALIFICATION" | "REPONSE" | "CLOTURE";

export interface Alerte {
  type: TypeAlerte;
  message: string;
}

export function alertesDelai(
  r: { recueLe: Date; responsableId: string | null; reponseLe: Date | null; clotureLe: Date | null },
  delais: Delais,
  maintenant: Date,
  feries: ReadonlySet<JourIso> = new Set(),
): Alerte[] {
  if (r.clotureLe) return [];
  const alertes: Alerte[] = [];
  const aujourdhui = jourIso(maintenant);
  const reception = jourIso(r.recueLe);

  const heures = (maintenant.getTime() - r.recueLe.getTime()) / 3_600_000;
  if (!r.responsableId && heures > delais.qualificationH) {
    alertes.push({ type: "QUALIFICATION", message: `Non affectée depuis ${Math.floor(heures)} h (cible ${delais.qualificationH} h)` });
  }

  const ouvres = joursOuvresEcoules(reception, aujourdhui, feries);
  if (!r.reponseLe && ouvres > delais.reponseJO) {
    alertes.push({ type: "REPONSE", message: `Sans réponse depuis ${ouvres} j ouvrés (cible ${delais.reponseJO})` });
  }

  const jours = ecartJours(reception, aujourdhui);
  if (jours > delais.clotureJ) {
    alertes.push({ type: "CLOTURE", message: `Ouverte depuis ${jours} j (cible ${delais.clotureJ})` });
  }
  return alertes;
}

/** Délai de clôture en jours calendaires (indicateur « délai moyen de clôture »). */
export function delaiClotureJours(r: { recueLe: Date; clotureLe: Date }): number {
  return ecartJours(jourIso(r.recueLe), jourIso(r.clotureLe));
}
