import { ajouterJours, jourDeSemaine, type JourIso } from "@/lib/dates";

/** Jours non ouvrés : samedi, dimanche et jours fériés saisis par le QHSE. */
export function estJourOuvre(jour: JourIso, feries: ReadonlySet<JourIso>): boolean {
  const j = jourDeSemaine(jour);
  return j !== 0 && j !== 6 && !feries.has(jour);
}

/**
 * Jours ouvrés écoulés après `debut`, jusqu'à `fin` inclus (même règle que la maquette :
 * une réclamation reçue un vendredi a 1 jour ouvré écoulé le lundi suivant).
 */
export function joursOuvresEcoules(debut: JourIso, fin: JourIso, feries: ReadonlySet<JourIso> = new Set()): number {
  let n = 0;
  for (let j = ajouterJours(debut, 1); j <= fin; j = ajouterJours(j, 1)) {
    if (estJourOuvre(j, feries)) n++;
  }
  return n;
}

/** Date limite : `n` jours ouvrés après `debut`. */
export function ajouterJoursOuvres(debut: JourIso, n: number, feries: ReadonlySet<JourIso> = new Set()): JourIso {
  let j = debut;
  let restants = n;
  while (restants > 0) {
    j = ajouterJours(j, 1);
    if (estJourOuvre(j, feries)) restants--;
  }
  return j;
}
