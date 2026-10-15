/**
 * Limitation des tentatives (connexion, dépôt public, suivi) : fenêtre glissante en mémoire.
 * Suffisant pour une seule instance Node (hébergement Infomaniak) ; à déplacer en base ou dans
 * un cache partagé si l'application tourne un jour sur plusieurs instances.
 */
const tentatives = new Map<string, number[]>();

export interface Limite {
  maximum: number;
  fenetreMs: number;
}

export function estBloque(cle: string, limite: Limite, maintenant = Date.now()): { bloque: boolean; reessayerDansMs: number } {
  const recentes = (tentatives.get(cle) ?? []).filter((t) => maintenant - t < limite.fenetreMs);
  tentatives.set(cle, recentes);
  if (recentes.length < limite.maximum) return { bloque: false, reessayerDansMs: 0 };
  return { bloque: true, reessayerDansMs: limite.fenetreMs - (maintenant - recentes[0]!) };
}

export function enregistrerTentative(cle: string, maintenant = Date.now()): void {
  const liste = tentatives.get(cle) ?? [];
  liste.push(maintenant);
  tentatives.set(cle, liste);
  if (tentatives.size > 10_000) nettoyer(maintenant);
}

export function reinitialiser(cle: string): void {
  tentatives.delete(cle);
}

function nettoyer(maintenant: number) {
  for (const [cle, liste] of tentatives) {
    if (liste.every((t) => maintenant - t > 60 * 60_000)) tentatives.delete(cle);
  }
}

export const LIMITE_CONNEXION_COMPTE: Limite = { maximum: 5, fenetreMs: 15 * 60_000 };
export const LIMITE_CONNEXION_IP: Limite = { maximum: 30, fenetreMs: 15 * 60_000 };
