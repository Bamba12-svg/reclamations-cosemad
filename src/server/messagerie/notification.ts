import "server-only";
import type { Message, ModeTransmission, Prisma, SousTypeProduit, TypeReclamation } from "@/generated/prisma/client";
import { formatDateHeure } from "@/lib/dates";
import { LIBELLE_MODE, texteType } from "@/lib/libelles";
import { formaterTelephone } from "@/lib/telephone";
import { preparerMessage } from "./index";

/**
 * Alerte interne : chaque nouvelle réclamation (portail ou accueil) est envoyée par e-mail à l'adresse
 * de la filiale pour les réclamations (Paramètres → Messagerie), ou à défaut à sa boîte d'envoi.
 * Texte brut : la description du client n'est jamais interprétée comme du HTML.
 */
export interface NouvelleReclamation {
  societe: { id: string; nom: string; slug: string };
  parametres: { emailReponse: string | null; smtpUtilisateur: string | null } | null;
  reclamationId: string;
  numero: string;
  recueLe: Date;
  mode: ModeTransmission;
  activite: string;
  type: TypeReclamation;
  sousType: SousTypeProduit | null;
  client: { nom: string; telephone: string; email: string | null };
  description: string;
  piecesJointes: number;
}

export function adresseReclamations(p: NouvelleReclamation["parametres"]): string | null {
  return p?.emailReponse || p?.smtpUtilisateur || null;
}

/** Adresse publique de l'application, pour le lien vers la fiche. */
export function urlPublique(): string {
  const brut = process.env.URL_PUBLIQUE?.trim() || `https://${process.env.PORTAIL_DOMAINE?.trim() || "reclamations.cosemad.sn"}`;
  return brut.replace(/\/+$/, "");
}

export async function alerterNouvelleReclamation(tx: Pick<Prisma.TransactionClient, "message">, r: NouvelleReclamation): Promise<Message | null> {
  const destinataire = adresseReclamations(r.parametres);
  if (!destinataire) return null;
  const lignes = [
    `Nouvelle réclamation reçue pour ${r.societe.nom}.`,
    "",
    `Numéro : ${r.numero}`,
    `Reçue le : ${formatDateHeure(r.recueLe)} (${LIBELLE_MODE[r.mode]})`,
    `Activité : ${r.activite}`,
    `Type : ${texteType(r.type, r.sousType)}`,
    `Client : ${r.client.nom} · ${formaterTelephone(r.client.telephone)}${r.client.email ? ` · ${r.client.email}` : ""}`,
    r.piecesJointes ? `Pièces jointes : ${r.piecesJointes}` : null,
    "",
    "Description :",
    r.description,
    "",
    `Ouvrir la fiche : ${urlPublique()}/bo/${r.societe.slug}/reclamations/${r.numero}`,
    "",
    "Message automatique de la plateforme réclamations. Répondez au client depuis la fiche, pour que la réponse soit tracée.",
  ].filter((l) => l !== null);
  return preparerMessage(tx, {
    societeId: r.societe.id,
    reclamationId: r.reclamationId,
    canal: "EMAIL",
    destinataire,
    objet: `Nouvelle réclamation ${r.numero} · ${r.activite}`,
    corps: lignes.join("\n"),
    interne: true,
  });
}
