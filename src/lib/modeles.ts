/**
 * Modèles de messages (SMS et e-mail) réglés par le QHSE.
 * Variables autorisées : {numero} {nom} {date} {delai}.
 */

export const VARIABLES_MODELE = ["numero", "nom", "date", "delai"] as const;
export type VariableModele = (typeof VARIABLES_MODELE)[number];
export type ValeursModele = Record<VariableModele, string | number>;

export function remplirModele(modele: string, valeurs: ValeursModele): string {
  return modele.replace(/\{(\w+)\}/g, (brut, cle: string) =>
    (VARIABLES_MODELE as readonly string[]).includes(cle) ? String(valeurs[cle as VariableModele]) : brut,
  );
}

export function variablesInconnues(modele: string): string[] {
  const trouvees = [...modele.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
  return [...new Set(trouvees.filter((v) => !(VARIABLES_MODELE as readonly string[]).includes(v)))];
}

// ───────── Longueur réelle d'un SMS ─────────
// Un SMS fait 160 caractères seulement si tous ses caractères appartiennent à l'alphabet GSM 03.38.
// Un seul caractère hors alphabet (ç, â, ê, î, ô, û, œ, « », ’…) fait passer tout le message en
// Unicode : 70 caractères par SMS. « reçue » suffit à tripler le coût d'un message de 160 caractères.

const GSM_BASE =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENSION = "^{}\\[~]|€\f";

export interface AnalyseSms {
  encodage: "GSM-7" | "Unicode";
  caracteres: number; // unités comptées par l'opérateur
  parSms: number; // 160 ou 70 (153 ou 67 par partie au-delà d'un SMS)
  nombreSms: number;
  horsAlphabet: string[]; // caractères qui forcent l'Unicode
}

export function analyserSms(texte: string): AnalyseSms {
  const caracteres = [...texte];
  const horsAlphabet = [...new Set(caracteres.filter((c) => !GSM_BASE.includes(c) && !GSM_EXTENSION.includes(c)))];
  if (horsAlphabet.length === 0) {
    const unites = caracteres.reduce((n, c) => n + (GSM_EXTENSION.includes(c) ? 2 : 1), 0);
    return { encodage: "GSM-7", caracteres: unites, parSms: 160, nombreSms: unites <= 160 ? 1 : Math.ceil(unites / 153), horsAlphabet };
  }
  // En Unicode, les caractères hors du plan de base (émojis) comptent double.
  const unites = caracteres.reduce((n, c) => n + (c.codePointAt(0)! > 0xffff ? 2 : 1), 0);
  return { encodage: "Unicode", caracteres: unites, parSms: 70, nombreSms: unites <= 70 ? 1 : Math.ceil(unites / 67), horsAlphabet };
}
