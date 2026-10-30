import type { Canal } from "@/generated/prisma/client";
import { fournisseurSmtp, type ConfigurationSmtp } from "./smtp";

/**
 * Interface commune aux fournisseurs d'envoi.
 *  - E-mail : serveur SMTP (smtp.ts), une boîte par filiale saisie dans Paramètres → Messagerie (ou .env).
 *  - SMS : fournisseur à choisir (Orange, Free, agrégateur…) — il suffira d'ajouter ici une
 *    implémentation de FournisseurMessage pour le canal SMS.
 */
export interface MessageAEnvoyer {
  destinataire: string;
  objet: string | null;
  corps: string;
  societeCode?: string; // CM, SON, FLS : choisit la boîte d'envoi de la filiale
  repondreA?: string | null; // adresse qui reçoit les réponses du client (Paramètres de la société)
  smtp?: ConfigurationSmtp | null; // boîte d'envoi résolue (Paramètres, sinon .env)
}

export interface FournisseurMessage {
  nom: string;
  canal: Canal;
  envoyer(message: MessageAEnvoyer): Promise<{ idExterne?: string }>;
}

export function fournisseurPour(canal: Canal): FournisseurMessage | undefined {
  if (canal === "EMAIL") return fournisseurSmtp();
  return undefined; // SMS : fournisseur à brancher
}

export type ModeMessagerie = "demo" | "production";

export function modeMessagerie(): ModeMessagerie {
  return process.env.MESSAGERIE_MODE === "production" ? "production" : "demo";
}
