import nodemailer, { type Transporter } from "nodemailer";
import type { FournisseurMessage } from "./fournisseurs";

/**
 * Envoi des e-mails par SMTP (Infomaniak, Microsoft 365, Google Workspace… : seuls les paramètres changent).
 *
 * Chaque filiale écrit à ses clients depuis SA boîte : les variables suffixées par le code de la société
 * (CM, SON, FLS) priment sur les variables communes. Exemple dans le .env du serveur :
 *
 *   SMTP_HOTE="mail.infomaniak.com"   SMTP_PORT="465"      (465 = SSL, 587 = STARTTLS ; communs)
 *   SMTP_UTILISATEUR_CM="prenom.nom@carrefourmedical.sn"   SMTP_MOT_DE_PASSE_CM="…"
 *   EMAIL_EXPEDITEUR_CM="Carrefour Médical – Réclamations <prenom.nom@carrefourmedical.sn>"
 *   (idem _SON et _FLS)
 *
 * Sans compte propre à une filiale, la boîte commune (SMTP_UTILISATEUR, EMAIL_EXPEDITEUR) est utilisée.
 * L'adresse qui reçoit les réponses des clients se règle par filiale dans Paramètres → Modèles SMS et e-mail.
 */
export interface ConfigurationSmtp {
  cle: string; // compte utilisé : « commun » ou le code de la société
  hote: string;
  port: number;
  securise: boolean;
  utilisateur: string;
  motDePasse: string;
  expediteur: string;
  reponse: string | undefined;
}

const variable = (nom: string, code?: string): string | undefined => {
  const propre = code ? process.env[`${nom}_${code}`]?.trim() : undefined;
  return propre || process.env[nom]?.trim() || undefined;
};

export function configurationSmtp(code?: string): ConfigurationSmtp | null {
  const c = code?.toUpperCase();
  const hote = variable("SMTP_HOTE", c);
  if (!hote) return null;
  const port = Number(variable("SMTP_PORT", c) ?? 587);
  // Un compte propre à la filiale s'emploie avec SON mot de passe et SON expéditeur, jamais ceux de la boîte commune.
  const compteFiliale = !!(c && process.env[`SMTP_UTILISATEUR_${c}`]?.trim());
  const lire = (nom: string) => (compteFiliale ? process.env[`${nom}_${c}`]?.trim() || undefined : process.env[nom]?.trim() || undefined);
  const utilisateur = lire("SMTP_UTILISATEUR") ?? "";
  return {
    cle: compteFiliale ? c! : "commun",
    hote,
    port,
    securise: port === 465,
    utilisateur,
    motDePasse: lire("SMTP_MOT_DE_PASSE") ?? "",
    expediteur: lire("EMAIL_EXPEDITEUR") ?? utilisateur,
    reponse: lire("EMAIL_REPONSE"),
  };
}

const transports = new Map<string, Transporter>();

function transportPour(c: ConfigurationSmtp): Transporter {
  const cle = `${c.cle}|${c.hote}|${c.port}|${c.utilisateur}`;
  let t = transports.get(cle);
  if (!t) {
    t = nodemailer.createTransport({
      host: c.hote,
      port: c.port,
      secure: c.securise,
      requireTLS: !c.securise, // port 587 : chiffrement obligatoire, jamais d'envoi en clair
      auth: c.utilisateur ? { user: c.utilisateur, pass: c.motDePasse } : undefined,
      connectionTimeout: 15_000,
      socketTimeout: 30_000,
    });
    transports.set(cle, t);
  }
  return t;
}

export function fournisseurSmtp(): FournisseurMessage | null {
  // Actif dès qu'un serveur est renseigné (commun ou propre à une filiale).
  const actif = Object.keys(process.env).some((k) => (k === "SMTP_HOTE" || k.startsWith("SMTP_HOTE_")) && process.env[k]?.trim());
  if (!actif) return null;
  return {
    nom: "smtp",
    canal: "EMAIL",
    async envoyer(m) {
      const c = configurationSmtp(m.societeCode);
      if (!c) throw new Error(`Aucun serveur SMTP n'est configuré pour ${m.societeCode ?? "cette société"}.`);
      if (!c.expediteur) throw new Error(`Aucune adresse d'expédition n'est configurée pour ${m.societeCode ?? "cette société"}.`);
      // Texte brut uniquement : aucun HTML construit à partir de données saisies par des tiers.
      const info = await transportPour(c).sendMail({
        from: c.expediteur,
        to: m.destinataire,
        replyTo: m.repondreA || c.reponse,
        subject: m.objet ?? "Votre réclamation",
        text: m.corps,
      });
      return { idExterne: info.messageId };
    },
  };
}

/** Vérifie la connexion et l'authentification au serveur SMTP d'une filiale (ou commun), sans envoyer de message. */
export async function verifierSmtp(code?: string): Promise<void> {
  const c = configurationSmtp(code);
  if (!c) throw new Error("SMTP_HOTE n'est pas renseigné.");
  await transportPour(c).verify();
}
