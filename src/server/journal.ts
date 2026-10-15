import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Journal d'audit : une ligne par opération (création, affectation, visa, clôture, connexion,
 * modification des paramètres…). Écrit dans la MÊME transaction que l'opération : si l'une
 * échoue, l'autre est annulée. Le journal n'est jamais modifié ni effacé par l'application.
 */
export interface EntreeJournal {
  action: string; // « reclamation.cloturer », « auth.connexion », « parametres.modifier »…
  entite: string; // « Reclamation », « User », « ParametresSociete »…
  entiteId?: string | null;
  userId?: string | null; // null : client du portail ou système
  societeId?: string | null;
  details?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
}

type ClientJournal = Pick<Prisma.TransactionClient, "journalAudit">;

export async function journaliser(client: ClientJournal, e: EntreeJournal): Promise<void> {
  await client.journalAudit.create({
    data: {
      action: e.action,
      entite: e.entite,
      entiteId: e.entiteId ?? null,
      userId: e.userId ?? null,
      societeId: e.societeId ?? null,
      details: e.details,
      ip: e.ip ?? null,
      userAgent: e.userAgent?.slice(0, 300) ?? null,
    },
  });
}

/**
 * Historique lisible de la fiche (« Affectée à Cheikh Sy (CM Oxygène médical) »).
 * acteur : un utilisateur, ou « Client » / « Système ».
 */
export async function ajouterEvenement(
  client: Pick<Prisma.TransactionClient, "evenement">,
  reclamationId: string,
  libelle: string,
  acteur: { userId: string } | "Client" | "Système",
  survenuLe: Date = new Date(),
): Promise<void> {
  await client.evenement.create({
    data: {
      reclamationId,
      libelle,
      survenuLe,
      acteurId: typeof acteur === "string" ? null : acteur.userId,
      acteurLibelle: typeof acteur === "string" ? acteur : null,
    },
  });
}
