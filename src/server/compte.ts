import "server-only";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { journaliser } from "./journal";

/**
 * Changement obligatoire du mot de passe provisoire (créé ou réinitialisé par le Service QHSE).
 * Tant qu'il n'est pas fait, le compte n'accède qu'à l'écran « Choisissez votre mot de passe ».
 */

export const LONGUEUR_MIN_MOT_DE_PASSE = 10;

export const schemaNouveauMotDePasse = z
  .object({
    motDePasse: z
      .string()
      .min(LONGUEUR_MIN_MOT_DE_PASSE, `Au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`)
      .max(200, "200 caractères au maximum.")
      .refine((v) => /\p{L}/u.test(v) && /\d/.test(v), "Utilisez au moins une lettre et un chiffre."),
    confirmation: z.string(),
  })
  .refine((d) => d.motDePasse === d.confirmation, { path: ["confirmation"], message: "Les deux mots de passe ne sont pas identiques." });

export type ResultatChangement = { ok: true } | { ok: false; erreur: string; champs?: { motDePasse?: string; confirmation?: string } };

export async function changerMotDePasseProvisoire(
  db: PrismaClient,
  userId: string,
  saisie: { motDePasse: string; confirmation: string },
  ctx: { ip: string | null; userAgent: string | null },
): Promise<ResultatChangement> {
  const lu = schemaNouveauMotDePasse.safeParse(saisie);
  if (!lu.success) {
    const champs: { motDePasse?: string; confirmation?: string } = {};
    for (const i of lu.error.issues) {
      const champ = i.path[0];
      if ((champ === "motDePasse" || champ === "confirmation") && !champs[champ]) champs[champ] = i.message;
    }
    return { ok: false, erreur: "Corrigez les champs signalés.", champs };
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { actif: true, motDePasseHash: true, doitChangerMotDePasse: true } });
  if (!user?.actif || !user.motDePasseHash) return { ok: false, erreur: "Session expirée. Reconnectez-vous." };
  if (!user.doitChangerMotDePasse) return { ok: false, erreur: "Votre mot de passe a déjà été choisi." };
  if (await bcrypt.compare(lu.data.motDePasse, user.motDePasseHash)) {
    const message = "Choisissez un mot de passe différent du mot de passe provisoire.";
    return { ok: false, erreur: message, champs: { motDePasse: message } };
  }

  const hash = await bcrypt.hash(lu.data.motDePasse, 12);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { motDePasseHash: hash, doitChangerMotDePasse: false } });
    await journaliser(tx, { action: "auth.mot-de-passe-choisi", entite: "User", entiteId: userId, userId, ...ctx });
  });
  return { ok: true };
}
