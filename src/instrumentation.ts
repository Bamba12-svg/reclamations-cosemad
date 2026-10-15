/**
 * Vérifications au démarrage du serveur (Next.js appelle register() une fois).
 * Une configuration dangereuse en ligne arrête le démarrage plutôt que de tourner silencieusement.
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const enLigne = process.env.NODE_ENV === "production";
  const erreurs: string[] = [];
  const avertissements: string[] = [];

  if (!process.env.DATABASE_URL) erreurs.push("DATABASE_URL manquante.");
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32) (enLigne ? erreurs : avertissements).push("AUTH_SECRET absente ou trop courte (32 caractères minimum).");

  if (process.env.MODE_DEMO === "1" && enLigne) {
    // Le mode démo permet de prendre l'identité de n'importe quel compte sans mot de passe.
    if (process.env.DEMO_EN_LIGNE === "1") avertissements.push("MODE_DEMO=1 en ligne (DEMO_EN_LIGNE=1) : réservé à une démonstration sans données réelles.");
    else erreurs.push("MODE_DEMO=1 en production. Mettez MODE_DEMO=0, ou DEMO_EN_LIGNE=1 pour une démonstration publique sans données réelles.");
  }
  if (enLigne && process.env.MESSAGERIE_MODE !== "production") {
    avertissements.push("MESSAGERIE_MODE n'est pas « production » : les SMS et e-mails sont enregistrés mais pas envoyés.");
  }

  for (const a of avertissements) console.warn(`[configuration] ${a}`);
  if (erreurs.length) {
    for (const e of erreurs) console.error(`[configuration] ${e}`);
    throw new Error(`Configuration invalide : ${erreurs.join(" ")}`);
  }
}
