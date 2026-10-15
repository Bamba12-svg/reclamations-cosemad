import type { Canal } from "@/generated/prisma/client";

/**
 * Interface commune aux fournisseurs d'envoi. Le choix du fournisseur SMS (Orange, Free,
 * Twilio…) et de l'adresse d'expédition des e-mails est en attente : il suffira d'ajouter ici
 * une implémentation de FournisseurMessage et de la déclarer dans FOURNISSEURS.
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

const FOURNISSEURS: Partial<Record<Canal, FournisseurMessage>> = {
  // SMS: orangeSms,   ← à brancher quand le fournisseur sera choisi
  // EMAIL: smtp,
};

export function fournisseurPour(canal: Canal): FournisseurMessage | undefined {
  return FOURNISSEURS[canal];
}

export type ModeMessagerie = "demo" | "production";

export function modeMessagerie(): ModeMessagerie {
  return process.env.MESSAGERIE_MODE === "production" ? "production" : "demo";
}
