/**
 * Dates « métier ». Dakar est à UTC+0 toute l'année, sans heure d'été : un jour calendaire
 * à Dakar est exactement un jour UTC. On manipule donc les jours sous forme de chaînes
 * ISO « AAAA-MM-JJ », comparables directement et insensibles au fuseau du serveur.
 */

export type JourIso = string; // « AAAA-MM-JJ »

const JOUR_MS = 86_400_000;

export function jourIso(d: Date): JourIso {
  return d.toISOString().slice(0, 10);
}

export function aujourdhuiIso(maintenant: Date = new Date()): JourIso {
  return jourIso(maintenant);
}

/** Minuit (UTC = Dakar) du jour donné, au format attendu par les colonnes @db.Date. */
export function debutDuJour(jour: JourIso): Date {
  return new Date(`${jour}T00:00:00.000Z`);
}

export function ajouterJours(jour: JourIso, n: number): JourIso {
  return jourIso(new Date(debutDuJour(jour).getTime() + n * JOUR_MS));
}

/** Nombre de jours calendaires de a à b (positif si b est après a). */
export function ecartJours(a: JourIso, b: JourIso): number {
  return Math.round((debutDuJour(b).getTime() - debutDuJour(a).getTime()) / JOUR_MS);
}

/** 0 = dimanche … 6 = samedi */
export function jourDeSemaine(jour: JourIso): number {
  return debutDuJour(jour).getUTCDay();
}

export function estJourIso(valeur: string): valeur is JourIso {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return false;
  const d = new Date(`${valeur}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && jourIso(d) === valeur;
}

/** 15/10/2026 */
export function formatDate(d: Date | JourIso): string {
  const iso = typeof d === "string" ? d : jourIso(d);
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}

/** 08:31 (heure de Dakar) */
export function formatHeure(d: Date): string {
  return d.toISOString().slice(11, 16);
}

/** 15/10/2026 à 08:31 */
export function formatDateHeure(d: Date): string {
  return `${formatDate(d)} à ${formatHeure(d)}`;
}

/** Instant à partir d'un jour et d'une heure saisis (« 2026-10-15 », « 08:31 »), heure de Dakar. */
export function instantDakar(jour: JourIso, heure: string): Date {
  return new Date(`${jour}T${heure}:00.000Z`);
}
