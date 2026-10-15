import { z } from "zod";
import { estJourIso } from "@/lib/dates";
import { chiffresNationaux } from "@/lib/telephone";

/** Téléphone sénégalais saisi librement (« 77 412 35 08 », « +221… ») → E.164 « +221774123508 ». */
export const telephoneSenegal = z
  .string({ error: "Indiquez un numéro de téléphone." })
  .transform((v) => chiffresNationaux(v))
  .refine((v) => v.length === 9, { error: "Le numéro doit comporter 9 chiffres, par exemple 77 000 00 00." })
  .refine((v) => /^[37]/.test(v), { error: "Ce numéro n'est pas un numéro sénégalais valide." })
  .transform((v) => `+221${v}`);

/** E-mail facultatif : chaîne vide → null. */
export const emailFacultatif = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .transform((v) => (v === "" ? null : v))
  .pipe(z.email({ error: "Cette adresse e-mail n'est pas valide." }).nullable());

export const jour = z.string().refine(estJourIso, { error: "Date invalide." });
export const heure = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Heure invalide." });
export const identifiant = z.string().min(1).max(40);

export const canaux = z.array(z.enum(["SMS", "EMAIL"])).min(1, { error: "Choisissez au moins un moyen de recevoir la réponse." });
export const typeReclamation = z.enum(["PRODUIT", "SERVICE", "AUTRE"], { error: "Choisissez une réponse." });
export const sousTypeProduit = z.enum(["QUALITE", "PRIX", "FONCTIONNALITE"]);
export const modeTransmission = z.enum(["VERBAL", "MAIL", "TELEPHONE", "COURRIER", "PLATEFORME_WEB", "AUTRES"]);

/** Erreurs zod → { champ: premier message }, pour l'affichage sous chaque champ. */
export function erreursParChamp(erreur: z.ZodError): Record<string, string> {
  const sortie: Record<string, string> = {};
  for (const issue of erreur.issues) {
    const cle = issue.path.join(".") || "_";
    sortie[cle] ??= issue.message;
  }
  return sortie;
}
