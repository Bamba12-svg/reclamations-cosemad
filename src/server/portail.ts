import "server-only";
import { cache } from "react";
import { formatDate, formatDateHeure } from "@/lib/dates";
import { remplirModele } from "@/lib/modeles";
import { texteCanaux } from "@/lib/libelles";
import type { DepotPortail } from "@/lib/validation/portail";
import type { Canal } from "@/generated/prisma/client";
import { db } from "./db";
import { etapesClient } from "./domaine/statut";
import { prochainNumero } from "./domaine/numerotation";
import { ajouterEvenement, journaliser } from "./journal";
import { expedier, preparerMessage } from "./messagerie";
import { controlerFichier, MAX_PIECES_PAR_DEPOT } from "./stockage/controle";
import { empreinteSha256, nouvelleCle, stockage } from "./stockage";
import { delaisSociete } from "./requetes/contexte-societe";

/** Société et activités affichées sur le portail (publiques). */
export const societePortail = cache(async (slug: string) => {
  const societe = await db.societe.findUnique({
    where: { slug },
    select: {
      id: true,
      code: true,
      slug: true,
      nom: true,
      domaine: true,
      logo: true,
      telStandard: true,
      activites: {
        where: { actif: true },
        orderBy: { ordre: "asc" },
        select: { code: true, nom: true, nomCourt: true, description: true, icone: true },
      },
    },
  });
  if (!societe) return null;
  return { ...societe, delais: await delaisSociete(societe.id) };
});

export const societesPortail = cache(() =>
  db.societe.findMany({ orderBy: { ordre: "asc" }, select: { slug: true, nom: true, domaine: true, logo: true } }),
);

// ───────────────────────── Dépôt ─────────────────────────

export interface FichierRecu {
  nom: string;
  octets: Uint8Array;
}

export type ResultatDepot =
  | {
      ok: true;
      numero: string;
      telephone: string;
      canaux: Canal[];
      recueLe: string; // ISO
      messages: { sms: string; email: string | null } | null; // contenu affiché seulement en mode démo
    }
  | { ok: false; erreur: string; champs?: Record<string, string> };

/**
 * Enregistre une réclamation déposée par un client sur le portail :
 * fichiers contrôlés puis stockés, numéro attribué, réclamation + historique + SMS/e-mail de
 * confirmation + journal dans UNE transaction, puis envoi des messages après validation.
 */
export async function deposerReclamation(d: DepotPortail, fichiers: FichierRecu[], contexte: { ip: string | null; userAgent: string | null }): Promise<ResultatDepot> {
  const societe = await societePortail(d.societe);
  if (!societe) return { ok: false, erreur: "Société inconnue." };
  const activite = await db.activite.findFirst({ where: { societeId: societe.id, code: d.activiteCode, actif: true }, select: { id: true, nom: true } });
  if (!activite) return { ok: false, erreur: "Choisissez l'activité concernée.", champs: { activiteCode: "Choisissez l'activité concernée." } };

  // 1. Fichiers : contrôle de chaque fichier (signature, taille), puis stockage sous une clé aléatoire.
  if (fichiers.length > MAX_PIECES_PAR_DEPOT) return { ok: false, erreur: "Vous pouvez joindre 3 fichiers au maximum." };
  const pieces: { nomOriginal: string; typeMime: string; taille: number; cleStockage: string; sha256: string }[] = [];
  for (const f of fichiers) {
    const c = controlerFichier(f.nom, f.octets);
    if (!c.ok) return { ok: false, erreur: c.erreur, champs: { fichiers: c.erreur } };
    pieces.push({ nomOriginal: c.nom, typeMime: c.type.mime, taille: c.taille, cleStockage: nouvelleCle(c.type), sha256: empreinteSha256(f.octets) });
  }
  const enregistres: string[] = [];
  try {
    for (const [i, p] of pieces.entries()) {
      await stockage().enregistrer(p.cleStockage, fichiers[i]!.octets);
      enregistres.push(p.cleStockage);
    }

    const maintenant = new Date();
    const societeClient = d.profil === "SOCIETE";
    const secteur = societeClient ? (d.secteur === "Autre" ? d.secteurAutre : d.secteur) : null;
    const nomPourMessage = societeClient ? d.contactNom || d.nom : d.nom;
    const canaux: Canal[] = d.canaux;
    const parametres = await db.parametresSociete.findUnique({ where: { societeId: societe.id } });

    const resultat = await db.$transaction(async (tx) => {
      const { numero, annee, sequence } = await prochainNumero(tx, societe, maintenant.getUTCFullYear());
      const valeurs = { numero, nom: nomPourMessage, date: formatDate(maintenant), delai: societe.delais.reponseJO };
      const sms = remplirModele(parametres?.modeleSms ?? "{numero}", valeurs);
      const email = d.email && parametres ? remplirModele(parametres.modeleEmail, valeurs) : null;

      const r = await tx.reclamation.create({
        data: {
          numero,
          annee,
          sequence,
          societeId: societe.id,
          activiteId: activite.id,
          recueLe: maintenant,
          mode: "PLATEFORME_WEB",
          origine: societeClient ? `Société · ${secteur}` : "Client particulier",
          profil: d.profil,
          clientNom: d.nom,
          secteur,
          contactNom: societeClient ? d.contactNom : null,
          contactFonction: societeClient && d.contactFonction ? d.contactFonction : null,
          telephone: d.telephone,
          email: d.email,
          canauxReponse: canaux,
          consentementLe: maintenant,
          type: d.type,
          sousType: d.type === "PRODUIT" ? d.sousType : null,
          description: d.description,
          premiereFois: d.premiereFois,
          recurrent: !d.premiereFois, // « Non, c'est déjà arrivé » : signalé comme récurrent (règle de la maquette)
          pieces: { create: pieces.map((p) => ({ ...p, source: "CLIENT" as const })) },
        },
        select: { id: true },
      });
      await ajouterEvenement(tx, r.id, "Réclamation enregistrée (Plateforme web)", "Client", maintenant);
      const messages = [await preparerMessage(tx, { societeId: societe.id, reclamationId: r.id, canal: "SMS", destinataire: d.telephone, corps: sms })];
      if (email && d.email) {
        const objet = remplirModele(parametres?.modeleEmailObjet ?? "Réclamation {numero}", valeurs);
        messages.push(await preparerMessage(tx, { societeId: societe.id, reclamationId: r.id, canal: "EMAIL", destinataire: d.email, objet, corps: email }));
      }
      await ajouterEvenement(tx, r.id, `Confirmation envoyée au client (SMS${email ? " + e-mail" : ""})`, "Système", maintenant);
      await journaliser(tx, {
        action: "reclamation.deposer",
        entite: "Reclamation",
        entiteId: r.id,
        societeId: societe.id,
        details: { numero, canal: "portail", pieces: pieces.length },
        ip: contexte.ip,
        userAgent: contexte.userAgent,
      });
      return { numero, sms, email, messageIds: messages.map((m) => m.id) };
    });

    await expedier(db, resultat.messageIds);
    const demo = process.env.MESSAGERIE_MODE !== "production";
    return {
      ok: true,
      numero: resultat.numero,
      telephone: d.telephone,
      canaux,
      recueLe: maintenant.toISOString(),
      messages: demo ? { sms: resultat.sms, email: resultat.email } : null,
    };
  } catch (erreur) {
    // Rien en base : on retire les fichiers déjà stockés.
    await Promise.all(enregistres.map((cle) => stockage().supprimer(cle).catch(() => undefined)));
    throw erreur;
  }
}

// ───────────────────────── Suivi ─────────────────────────

export interface SuiviClient {
  numero: string;
  activite: string;
  description: string;
  etapes: { libelle: string; faite: boolean; texte: string }[];
  reponse: { date: string; texte: string } | null;
}

/**
 * Suivi public : numéro + téléphone. Ne renvoie QUE ce que le client peut voir : jamais le
 * statut interne (« En retard »), les actions, les commentaires, les pièces ni les noms des collaborateurs.
 */
export async function suivreReclamation(numero: string, telephone: string): Promise<SuiviClient | null> {
  const r = await db.reclamation.findUnique({
    where: { numero },
    select: {
      numero: true,
      telephone: true,
      description: true,
      societeId: true,
      recueLe: true,
      responsableId: true,
      affecteeLe: true,
      reponse: true,
      reponseLe: true,
      reponseCanaux: true,
      clotureLe: true,
      activite: { select: { nom: true } },
    },
  });
  if (!r || r.telephone !== telephone) return null;
  const delais = await delaisSociete(r.societeId);
  const textes = [
    `Le ${formatDateHeure(r.recueLe)}`,
    r.responsableId ? (r.affecteeLe ? `Depuis le ${formatDate(r.affecteeLe)}` : "Un responsable étudie votre demande") : `Prise en charge sous ${delais.qualificationH} h`,
    r.reponseLe ? `Le ${formatDate(r.reponseLe)} par ${texteCanaux(r.reponseCanaux)}` : `Sous ${delais.reponseJO} jours ouvrés`,
    r.clotureLe ? `Le ${formatDate(r.clotureLe)}` : "À venir",
  ];
  return {
    numero: r.numero,
    activite: r.activite.nom,
    description: r.description,
    etapes: etapesClient(r).map((e, i) => ({ libelle: e.libelle, faite: e.faite, texte: textes[i]! })),
    reponse: r.reponse && r.reponseLe ? { date: formatDate(r.reponseLe), texte: r.reponse } : null,
  };
}

