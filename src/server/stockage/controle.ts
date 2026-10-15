/**
 * Contrôle des fichiers téléversés (portail client et back-office).
 * Le type est déterminé par la SIGNATURE BINAIRE du fichier, jamais par son nom ni par le type
 * annoncé par le navigateur : un « photo.jpg » qui contient autre chose est refusé.
 */

export const TAILLE_MAX_OCTETS = 10 * 1024 * 1024; // 10 Mo par fichier (maquette)
export const MAX_PIECES_PAR_DEPOT = 3; // portail client et saisie accueil
export const MAX_PIECES_PAR_RECLAMATION = 20; // ajouts ultérieurs dans la fiche

export interface TypeAccepte {
  mime: "image/jpeg" | "image/png" | "application/pdf";
  extension: "jpg" | "png" | "pdf";
}

const commencePar = (octets: Uint8Array, signature: readonly number[]) => signature.every((b, i) => octets[i] === b);

export function detecterType(octets: Uint8Array): TypeAccepte | null {
  if (commencePar(octets, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", extension: "jpg" };
  if (commencePar(octets, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", extension: "png" };
  if (commencePar(octets, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: "application/pdf", extension: "pdf" }; // %PDF-
  return null;
}

/** Nom affiché seulement (le fichier est stocké sous une clé aléatoire) : sans chemin ni caractère de contrôle. */
export function nettoyerNom(nom: string, extension: TypeAccepte["extension"]): string {
  const base = nom
    .split(/[\\/]/)
    .pop()!
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.[^.]*$/, "");
  const sur = (base || "fichier").slice(0, 120);
  return `${sur}.${extension}`;
}

export type ResultatControle =
  | { ok: true; type: TypeAccepte; nom: string; taille: number }
  | { ok: false; erreur: string };

export function controlerFichier(nom: string, octets: Uint8Array): ResultatControle {
  if (octets.byteLength === 0) return { ok: false, erreur: `« ${nom} » est vide.` };
  if (octets.byteLength > TAILLE_MAX_OCTETS) return { ok: false, erreur: `« ${nom} » dépasse 10 Mo.` };
  const type = detecterType(octets);
  if (!type) return { ok: false, erreur: "Seuls les photos (JPG, PNG) et les PDF sont acceptés." };
  return { ok: true, type, nom: nettoyerNom(nom, type.extension), taille: octets.byteLength };
}
