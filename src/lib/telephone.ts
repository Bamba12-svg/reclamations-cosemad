/**
 * Numéros sénégalais : 9 chiffres nationaux (mobiles 7x, fixes 3x), stockés en E.164 (+221XXXXXXXXX).
 */

/** Garde uniquement les chiffres nationaux : « +221 77 412 35 08 » → « 774123508 ». */
export function chiffresNationaux(saisie: string): string {
  return saisie.replace(/\D/g, "").replace(/^(00)?221(?=\d{9}$)/, "");
}

export function estTelephoneSenegal(saisie: string): boolean {
  return /^[37]\d{8}$/.test(chiffresNationaux(saisie));
}

export function versE164(saisie: string): string {
  const n = chiffresNationaux(saisie);
  if (!/^[37]\d{8}$/.test(n)) throw new Error("Numéro sénégalais invalide");
  return `+221${n}`;
}

/** Mise en forme pendant la frappe : « 774123508 » → « 77 412 35 08 » (comme la maquette). */
export function formaterSaisie(saisie: string): string {
  const d = chiffresNationaux(saisie).slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
}

/** Affichage : « +221774123508 » → « +221 77 412 35 08 ». */
export function formaterTelephone(e164: string): string {
  const n = chiffresNationaux(e164);
  return n.length === 9 ? `+221 ${formaterSaisie(n)}` : e164;
}
