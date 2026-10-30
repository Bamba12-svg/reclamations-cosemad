import { createHash } from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { dechiffrer } from "./chiffrement";
import type { FournisseurMessage } from "./fournisseurs";

/**
 * Envoi des e-mails par SMTP (Infomaniak, Microsoft 365, Google Workspace… : seuls les paramètres changent).
 *
 * Chaque filiale écrit à ses clients depuis SA boîte. Deux sources, dans cet ordre :
 *  1. Paramètres → Messagerie (saisie par le Service QHSE, mot de passe chiffré en base) ;
 *  2. à défaut, le .env du serveur : variables suffixées par le code de la société (CM, SON, FLS),
 *     puis variables communes. Exemple :
 *
 *   SMTP_HOTE="mail.infomaniak.com"   SMTP_PORT="465"      (465 = SSL, 587 = STARTTLS ; communs)
 *   SMTP_UTILISATEUR_CM="prenom.nom@carrefourmedical.sn"   SMTP_MOT_DE_PASSE_CM="…"
 *   EMAIL_EXPEDITEUR_CM="Carrefour Médical – Réclamations <prenom.nom@carrefourmedical.sn>"
 *   (idem _SON et _FLS)
 *
 * L'adresse qui reçoit les réponses des clients se règle par filiale dans Paramètres → Messagerie.
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

/** Boîte d'envoi saisie dans Paramètres → Messagerie (null si incomplète ou mot de passe illisible). */
export interface ParametresBoite {
  smtpHote: string | null;
  smtpPort: number | null;
  smtpUtilisateur: string | null;
  smtpMotDePasse: string | null; // chiffré
  emailNomExpediteur: string | null;
  emailsReclamations?: string[];
}

export function configurationDepuisParametres(p: ParametresBoite | null | undefined, cle: string): ConfigurationSmtp | null {
  if (!p?.smtpUtilisateur || !p.smtpMotDePasse || !p.smtpHote) return null;
  const motDePasse = dechiffrer(p.smtpMotDePasse);
  if (motDePasse === null) return null;
  const port = p.smtpPort ?? 465;
  const nom = p.emailNomExpediteur?.replace(/["<>\r\n]/g, "").trim();
  return {
    cle,
    hote: p.smtpHote,
    port,
    securise: port === 465,
    utilisateur: p.smtpUtilisateur,
    motDePasse,
    expediteur: nom ? `"${nom}" <${p.smtpUtilisateur}>` : p.smtpUtilisateur,
    reponse: p.emailsReclamations?.length ? p.emailsReclamations.join(", ") : undefined,
  };
}

/** Configuration d'envoi d'une société : Paramètres d'abord, sinon .env. */
export function configurationPourSociete(code: string, p: ParametresBoite | null | undefined): ConfigurationSmtp | null {
  return configurationDepuisParametres(p, `parametres:${code}`) ?? configurationSmtp(code);
}

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
  // Le mot de passe fait partie de la clé (sous forme d'empreinte) : après un changement dans les
  // Paramètres, une nouvelle connexion est ouverte au lieu de réutiliser l'ancien mot de passe.
  const empreinte = createHash("sha256").update(c.motDePasse).digest("hex").slice(0, 16);
  const cle = `${c.cle}|${c.hote}|${c.port}|${c.utilisateur}|${empreinte}`;
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
    // Une seule connexion par boîte : l'ancienne (ancien mot de passe ou ancien serveur) est fermée.
    for (const [k, ancien] of transports) {
      if (k.startsWith(`${c.cle}|`)) {
        ancien.close();
        transports.delete(k);
      }
    }
    transports.set(cle, t);
  }
  return t;
}

export function fournisseurSmtp(): FournisseurMessage {
  return {
    nom: "smtp",
    canal: "EMAIL",
    async envoyer(m) {
      const c = m.smtp ?? configurationSmtp(m.societeCode);
      if (!c) throw new Error("Aucune boîte d'envoi n'est configurée pour cette société (Paramètres → Messagerie).");
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

/** Vérifie la connexion et l'authentification au serveur SMTP, sans envoyer de message. */
export async function verifierSmtp(code?: string, c: ConfigurationSmtp | null = configurationSmtp(code)): Promise<void> {
  if (!c) throw new Error("SMTP_HOTE n'est pas renseigné.");
  await transportPour(c).verify();
}
