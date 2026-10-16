import type { Canal } from "@/generated/prisma/client";
import { fournisseurSmtp } from "./smtp";

/**
 * Interface commune aux fournisseurs d'envoi.
 *  - E-mail : serveur SMTP de COSEMAD (smtp.ts), actif dès que SMTP_HOTE est renseigné dans .env.
 *  - SMS : fournisseur à choisir (Orange, Free, agrégateur…) — il suffira d'ajouter ici une
 *    implémentation de FournisseurMessage pour le canal SMS.
 */
export interface MessageAEnvoyer {
  destinataire: string;
  objet: string | null;
  corps: string;
}

export interface FournisseurMessage {
  nom: string;
  canal: Canal;
  envoyer(message: MessageAEnvoyer): Promise<{ idExterne?: string }>;
}

export function fournisseurPour(canal: Canal): FournisseurMessage | undefined {
  if (canal === "EMAIL") return fournisseurSmtp() ?? undefined;
  return undefined; // SMS : fournisseur à brancher
}

export type ModeMessagerie = "demo" | "production";

export function modeMessagerie(): ModeMessagerie {
  return process.env.MESSAGERIE_MODE === "production" ? "production" : "demo";
}
