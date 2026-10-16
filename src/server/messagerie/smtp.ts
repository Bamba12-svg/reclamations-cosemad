import nodemailer, { type Transporter } from "nodemailer";
import type { FournisseurMessage } from "./fournisseurs";

/**
 * Envoi des e-mails par un serveur SMTP (messagerie de COSEMAD : Infomaniak, Microsoft 365,
 * Google Workspace… — seuls les paramètres changent). Configuré par le fichier .env :
 *
 *   SMTP_HOTE="mail.infomaniak.com"   SMTP_PORT="465"   (465 = SSL, 587 = STARTTLS)
 *   SMTP_UTILISATEUR="reclamations@cosemad.sn"   SMTP_MOT_DE_PASSE="…"
 *   EMAIL_EXPEDITEUR="Groupe COSEMAD – Réclamations <reclamations@cosemad.sn>"
 *   EMAIL_REPONSE="qhse@cosemad.sn"   (facultatif : adresse qui reçoit les réponses des clients)
 */
export function configurationSmtp() {
  const hote = process.env.SMTP_HOTE?.trim();
  if (!hote) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  return {
    hote,
    port,
    securise: port === 465,
    utilisateur: process.env.SMTP_UTILISATEUR ?? "",
    motDePasse: process.env.SMTP_MOT_DE_PASSE ?? "",
    expediteur: process.env.EMAIL_EXPEDITEUR?.trim() || process.env.SMTP_UTILISATEUR || "",
    reponse: process.env.EMAIL_REPONSE?.trim() || undefined,
  };
}

let transport: Transporter | null = null;

export function fournisseurSmtp(): FournisseurMessage | null {
  const c = configurationSmtp();
  if (!c) return null;
  transport ??= nodemailer.createTransport({
    host: c.hote,
    port: c.port,
    secure: c.securise,
    requireTLS: !c.securise, // port 587 : chiffrement obligatoire, jamais d'envoi en clair
    auth: c.utilisateur ? { user: c.utilisateur, pass: c.motDePasse } : undefined,
    connectionTimeout: 15_000,
    socketTimeout: 30_000,
  });
  return {
    nom: "smtp",
    canal: "EMAIL",
    async envoyer(m) {
      // Texte brut uniquement : aucun HTML construit à partir de données saisies par des tiers.
      const info = await transport!.sendMail({
        from: c.expediteur,
        to: m.destinataire,
        replyTo: c.reponse,
        subject: m.objet ?? "Votre réclamation",
        text: m.corps,
      });
      return { idExterne: info.messageId };
    },
  };
}

/** Vérifie la connexion et l'authentification au serveur SMTP (sans envoyer de message). */
export async function verifierSmtp(): Promise<void> {
  if (!fournisseurSmtp()) throw new Error("SMTP_HOTE n'est pas renseigné.");
  await transport!.verify();
}
