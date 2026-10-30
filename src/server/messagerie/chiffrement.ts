import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Chiffrement des mots de passe des boîtes d'envoi saisis dans les Paramètres (AES-256-GCM).
 * La clé est dérivée de AUTH_SECRET (HKDF, usage dédié) : la base seule ne suffit pas pour relire
 * un mot de passe. Changer AUTH_SECRET rend les mots de passe enregistrés illisibles : il faut alors
 * les ressaisir dans Paramètres → Messagerie.
 */
const VERSION = "v1";

function cle(): Buffer {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32) throw new Error("AUTH_SECRET (32 caractères minimum) est nécessaire pour chiffrer les mots de passe de messagerie.");
  return Buffer.from(hkdfSync("sha256", secret, "cosemad-reclamations", "messagerie-smtp", 32));
}

export function chiffrer(texte: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cle(), iv);
  const donnees = Buffer.concat([c.update(texte, "utf8"), c.final()]);
  return [VERSION, iv.toString("base64"), c.getAuthTag().toString("base64"), donnees.toString("base64")].join(":");
}

/** Renvoie null si la valeur est illisible (clé changée, valeur altérée). */
export function dechiffrer(valeur: string): string | null {
  const [version, iv, tag, donnees] = valeur.split(":");
  if (version !== VERSION || !iv || !tag || !donnees) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", cle(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(donnees, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
