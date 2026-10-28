import "server-only";
import type { Canal, Message, Prisma, PrismaClient } from "@/generated/prisma/client";
import { fournisseurPour, modeMessagerie } from "./fournisseurs";

/**
 * Envoi des SMS et e-mails, en deux temps (modèle « boîte d'envoi ») :
 *  1. preparerMessage() enregistre le message DANS la transaction de l'opération métier
 *     (dépôt, réponse…) : pas de message sans réclamation, ni de réclamation sans trace du message ;
 *  2. expedier() l'envoie APRÈS la validation de la transaction, car un appel réseau au
 *     fournisseur ne doit ni bloquer ni annuler l'enregistrement en base.
 * En mode démo (MESSAGERIE_MODE=demo, par défaut), le message est enregistré avec le statut DEMO :
 * il s'affiche dans l'application mais n'est envoyé à personne.
 */

export interface NouveauMessage {
  societeId: string;
  reclamationId?: string | null;
  canal: Canal;
  destinataire: string; // E.164 pour un SMS, adresse pour un e-mail
  objet?: string | null; // e-mail uniquement
  corps: string;
}

type ClientMessages = Pick<Prisma.TransactionClient, "message">;

export async function preparerMessage(client: ClientMessages, m: NouveauMessage): Promise<Message> {
  const demo = modeMessagerie() === "demo";
  return client.message.create({
    data: {
      societeId: m.societeId,
      reclamationId: m.reclamationId ?? null,
      canal: m.canal,
      destinataire: m.destinataire,
      objet: m.canal === "EMAIL" ? (m.objet ?? null) : null,
      corps: m.corps,
      statut: demo ? "DEMO" : "EN_ATTENTE",
      fournisseur: demo ? "demo" : fournisseurPour(m.canal)?.nom ?? "aucun",
      envoyeLe: demo ? new Date() : null,
    },
  });
}

/** Envoie les messages en attente. Un échec est enregistré sur le message, jamais propagé. */
export async function expedier(db: PrismaClient, messageIds: readonly string[]): Promise<void> {
  if (modeMessagerie() === "demo" || messageIds.length === 0) return;
  const messages = await db.message.findMany({
    where: { id: { in: [...messageIds] }, statut: "EN_ATTENTE" },
    include: { societe: { select: { code: true, parametres: { select: { emailReponse: true } } } } },
  });
  for (const m of messages) {
    const fournisseur = fournisseurPour(m.canal);
    try {
      if (!fournisseur) throw new Error(`Aucun fournisseur ${m.canal === "SMS" ? "SMS" : "e-mail"} n'est configuré.`);
      const { idExterne } = await fournisseur.envoyer({
        destinataire: m.destinataire,
        objet: m.objet,
        corps: m.corps,
        societeCode: m.societe.code,
        repondreA: m.societe.parametres?.emailReponse,
      });
      await db.message.update({ where: { id: m.id }, data: { statut: "ENVOYE", envoyeLe: new Date(), idExterne: idExterne ?? null } });
    } catch (erreur) {
      const texte = erreur instanceof Error ? erreur.message : String(erreur);
      console.error(`[messagerie] échec ${m.canal} ${m.id} : ${texte}`);
      await db.message.update({ where: { id: m.id }, data: { statut: "ECHEC", erreur: texte.slice(0, 500) } });
    }
  }
}
