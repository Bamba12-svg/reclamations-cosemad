import "server-only";
import { z } from "zod";
import type { Canal, Prisma, StatutAction, TypeVisa } from "@/generated/prisma/client";
import { formatDate, jourIso } from "@/lib/dates";
import { LIBELLE_STATUT_ACTION, texteCanaux } from "@/lib/libelles";
import { erreursParChamp } from "@/lib/validation/communs";
import { schemaAction, schemaCauses, schemaCommentaire, schemaReponse } from "@/lib/validation/backoffice";
import { db } from "../db";
import { blocageVisa, conditionsManquantes, peutEtreCloturee, texteManquants } from "../domaine/cloture";
import {
  AccesRefuse,
  peutAjouterPiece,
  peutCloturer,
  peutCommenter,
  peutModifierAction,
  peutQualifier,
  peutRepondre,
  peutTraiter,
  peutViser,
  peutVoir,
  type Acteur,
} from "../droits/permissions";
import { ajouterEvenement, journaliser } from "../journal";
import { expedier, preparerMessage } from "../messagerie";
import { empreinteSha256, nouvelleCle, stockage } from "../stockage";
import { controlerFichier, MAX_PIECES_PAR_RECLAMATION, type TypeAccepte } from "../stockage/controle";
import { responsablesPossibles } from "./responsables";

/**
 * Opérations de la fiche réclamation. Chacune :
 *  1. verrouille la ligne de la réclamation (SELECT … FOR UPDATE) : deux personnes qui visent ou
 *     clôturent en même temps ne peuvent pas contourner les conditions de la procédure ;
 *  2. revérifie les droits de l'utilisateur ET les règles PR06, quoi que l'interface affiche ;
 *  3. écrit la modification, l'historique lisible et le journal d'audit dans la même transaction.
 */

export type Resultat = { ok: true; message?: string } | { ok: false; erreur: string; champs?: Record<string, string> };

export interface ContexteRequete {
  ip: string | null;
  userAgent: string | null;
}

/** Refus « métier » dont le message est affiché tel quel à l'utilisateur. */
export class RefusMetier extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefusMetier";
  }
}

const SELECT_OPERATION = {
  id: true,
  numero: true,
  societeId: true,
  activiteId: true,
  responsableId: true,
  recueLe: true,
  clotureLe: true,
  causes: true,
  reponseLe: true,
  clientNom: true,
  telephone: true,
  email: true,
  societe: { select: { nom: true } },
  activite: { select: { nom: true } },
} satisfies Prisma.ReclamationSelect;

const SELECT_ACTION = { id: true, ordre: true, libelle: true, responsableId: true, statut: true, efficace: true, echeance: true, critere: true } satisfies Prisma.ActionSelect;

type ReclamationOperation = Prisma.ReclamationGetPayload<{ select: typeof SELECT_OPERATION }> & {
  actions: Prisma.ActionGetPayload<{ select: typeof SELECT_ACTION }>[];
  visas: { type: TypeVisa }[];
  nombrePieces: number;
};
type Tx = Prisma.TransactionClient;

async function executer(
  acteur: Acteur,
  numero: string,
  corps: (tx: Tx, r: ReclamationOperation) => Promise<string | undefined>,
): Promise<Resultat> {
  try {
    const message = await db.$transaction(async (tx) => {
      const trouvee = await tx.reclamation.findUnique({ where: { numero }, select: { id: true } });
      if (!trouvee) throw new AccesRefuse("Réclamation introuvable ou hors de votre périmètre.");
      await tx.$queryRaw`SELECT 1 FROM "Reclamation" WHERE "id" = ${trouvee.id} FOR UPDATE`;
      // Lectures successives (pas de requêtes parallèles sur la connexion de la transaction).
      const base = await tx.reclamation.findUniqueOrThrow({ where: { id: trouvee.id }, select: SELECT_OPERATION });
      const actions = await tx.action.findMany({ where: { reclamationId: base.id }, orderBy: { ordre: "asc" }, select: SELECT_ACTION });
      const visas = await tx.visa.findMany({ where: { reclamationId: base.id }, select: { type: true } });
      const nombrePieces = await tx.pieceJointe.count({ where: { reclamationId: base.id } });
      const r: ReclamationOperation = { ...base, actions, visas, nombrePieces };
      if (!peutVoir(acteur, r)) throw new AccesRefuse("Réclamation introuvable ou hors de votre périmètre.");
      return corps(tx, r);
    });
    return { ok: true, message };
  } catch (e) {
    return enResultat(e);
  }
}

export function enResultat(e: unknown): Resultat {
  if (e instanceof AccesRefuse || e instanceof RefusMetier) return { ok: false, erreur: e.message };
  if (e instanceof z.ZodError) {
    const champs = erreursParChamp(e);
    return { ok: false, erreur: Object.values(champs)[0] ?? "Saisie invalide.", champs };
  }
  throw e;
}

function exiger(condition: boolean, message = "Vous n'avez pas les droits pour cette opération."): asserts condition {
  if (!condition) throw new AccesRefuse(message);
}

const journal = (tx: Tx, acteur: Acteur, r: ReclamationOperation, ctx: ContexteRequete, action: string, details?: Prisma.InputJsonValue) =>
  journaliser(tx, { action, entite: "Reclamation", entiteId: r.id, userId: acteur.id, societeId: r.societeId, details, ip: ctx.ip, userAgent: ctx.userAgent });

async function personneAutorisee(tx: Tx, r: ReclamationOperation, userId: string) {
  const personne = (await responsablesPossibles(tx, r.activiteId)).find((p) => p.id === userId);
  if (!personne) throw new RefusMetier("Cette personne ne peut pas traiter les réclamations de cette activité.");
  return personne;
}

// ───────────────────────── 2. Qualification ─────────────────────────

export function affecter(acteur: Acteur, numero: string, responsableId: string | null, ctx: ContexteRequete) {
  return executer(acteur, numero, async (tx, r) => {
    exiger(peutQualifier(acteur, r), "Seuls le Service QHSE et le responsable de l'activité désignent le responsable de traitement.");
    if (r.responsableId === responsableId) return undefined;
    const maintenant = new Date();
    if (responsableId === null) {
      await tx.reclamation.update({ where: { id: r.id }, data: { responsableId: null, affecteeLe: null } });
      await ajouterEvenement(tx, r.id, "Affectation retirée", { userId: acteur.id }, maintenant);
      await journal(tx, acteur, r, ctx, "reclamation.affecter", { responsableId: null, avant: r.responsableId });
      return "Affectation retirée";
    }
    const personne = await personneAutorisee(tx, r, responsableId);
    await tx.reclamation.update({ where: { id: r.id }, data: { responsableId, affecteeLe: maintenant } });
    await ajouterEvenement(tx, r.id, `Affectée à ${personne.nom} (${r.activite.nom})`, { userId: acteur.id }, maintenant);
    await journal(tx, acteur, r, ctx, "reclamation.affecter", { responsableId, avant: r.responsableId });
    return `Réclamation affectée à ${personne.nom}`;
  });
}

export function marquerRecurrent(acteur: Acteur, numero: string, recurrent: boolean, ctx: ContexteRequete) {
  return executer(acteur, numero, async (tx, r) => {
    exiger(peutQualifier(acteur, r));
    const actuel = await tx.reclamation.findUniqueOrThrow({ where: { id: r.id }, select: { recurrent: true } });
    if (actuel.recurrent === recurrent) return undefined;
    await tx.reclamation.update({ where: { id: r.id }, data: { recurrent } });
    await ajouterEvenement(tx, r.id, `Problème récurrent : ${recurrent ? "oui" : "non"}`, { userId: acteur.id });
    await journal(tx, acteur, r, ctx, "reclamation.recurrent", { recurrent });
    return undefined;
  });
}

// ───────────────────────── 3. Traitement : actions ─────────────────────────

const MAX_ACTIONS = 20;

export function ajouterAction(acteur: Acteur, numero: string, saisie: unknown, ctx: ContexteRequete) {
  return executer(acteur, numero, async (tx, r) => {
    exiger(peutTraiter(acteur, r));
    const a = schemaAction.parse(saisie);
    if (r.actions.length >= MAX_ACTIONS) throw new RefusMetier(`${MAX_ACTIONS} actions au maximum par réclamation.`);
    if (a.echeance < jourIso(r.recueLe)) throw new RefusMetier("L'échéance ne peut pas précéder la réception de la réclamation.");
    const personne = await personneAutorisee(tx, r, a.responsableId);
    const maintenant = new Date();
    const ordre = (r.actions.at(-1)?.ordre ?? 0) + 1;
    await tx.action.create({
      data: {
        reclamationId: r.id,
        ordre,
        libelle: a.libelle,
        responsableId: a.responsableId,
        echeance: new Date(`${a.echeance}T00:00:00.000Z`),
        statut: a.statut,
        critere: a.critere,
        realiseeLe: a.statut === "REALISEE" ? maintenant : null,
      },
    });
    // Comme la maquette : une première action sans responsable désigné l'affecte à la personne choisie.
    if (!r.responsableId) {
      await tx.reclamation.update({ where: { id: r.id }, data: { responsableId: a.responsableId, affecteeLe: maintenant } });
      await ajouterEvenement(tx, r.id, `Affectée à ${personne.nom} (${r.activite.nom})`, { userId: acteur.id }, maintenant);
    }
    await ajouterEvenement(tx, r.id, `Action ajoutée : ${a.libelle}`, { userId: acteur.id }, maintenant);
    await journal(tx, acteur, r, ctx, "action.ajouter", { libelle: a.libelle, responsableId: a.responsableId, echeance: a.echeance });
    return `Action ajoutée à la fiche ${r.numero}`;
  });
}

const schemaModification = z.discriminatedUnion("champ", [
  z.object({ champ: z.literal("libelle"), valeur: schemaAction.shape.libelle }),
  z.object({ champ: z.literal("critere"), valeur: schemaAction.shape.critere }),
  z.object({ champ: z.literal("responsableId"), valeur: schemaAction.shape.responsableId }),
  z.object({ champ: z.literal("echeance"), valeur: schemaAction.shape.echeance }),
  z.object({ champ: z.literal("statut"), valeur: z.enum(["A_FAIRE", "EN_COURS", "REALISEE"]) }),
  z.object({ champ: z.literal("efficace"), valeur: z.boolean() }),
]);
export type ModificationAction = z.input<typeof schemaModification>;

const statutEnPhrase = (s: StatutAction) => LIBELLE_STATUT_ACTION[s].toLowerCase();

export function modifierAction(acteur: Acteur, numero: string, actionId: string, saisie: unknown, ctx: ContexteRequete) {
  return executer(acteur, numero, async (tx, r) => {
    const m = schemaModification.parse(saisie);
    const index = r.actions.findIndex((a) => a.id === actionId);
    const action = r.actions[index];
    if (!action) throw new RefusMetier("Cette action n'existe plus. Rechargez la page.");
    exiger(
      peutModifierAction(acteur, r, action, m.champ === "statut" ? "statut" : "tout"),
      r.clotureLe ? "La réclamation est clôturée : la fiche est en lecture seule." : "Vous ne pouvez pas modifier cette action.",
    );
    const n = index + 1;
    const qui = { userId: acteur.id };
    const maintenant = new Date();
    let data: Prisma.ActionUpdateInput;
    let evenement: string | null = null;
    let message: string | undefined;

    switch (m.champ) {
      case "libelle":
      case "critere":
        if (action[m.champ] === m.valeur) return undefined;
        data = { [m.champ]: m.valeur };
        break;
      case "responsableId": {
        if (action.responsableId === m.valeur) return undefined;
        const personne = await personneAutorisee(tx, r, m.valeur);
        data = { responsable: { connect: { id: m.valeur } } };
        evenement = `Action ${n} confiée à ${personne.nom}`;
        break;
      }
      case "echeance":
        if (jourIso(action.echeance) === m.valeur) return undefined;
        if (m.valeur < jourIso(r.recueLe)) throw new RefusMetier("L'échéance ne peut pas précéder la réception de la réclamation.");
        data = { echeance: new Date(`${m.valeur}T00:00:00.000Z`) };
        evenement = `Action ${n} : échéance au ${formatDate(m.valeur)}`;
        break;
      case "statut":
        if (action.statut === m.valeur) return undefined;
        // Une action qui n'est plus réalisée doit être réévaluée une fois terminée.
        data = m.valeur === "REALISEE" ? { statut: m.valeur, realiseeLe: maintenant } : { statut: m.valeur, realiseeLe: null, efficace: null };
        evenement = `Action ${n} : ${statutEnPhrase(m.valeur)}`;
        if (m.valeur === "REALISEE") message = `Action ${n} marquée comme réalisée`;
        break;
      case "efficace":
        if (action.statut !== "REALISEE") throw new RefusMetier("L'efficacité s'évalue une fois l'action réalisée.");
        if (action.efficace === m.valeur) return undefined;
        data = { efficace: m.valeur };
        evenement = `Action ${n} jugée ${m.valeur ? "efficace" : "non efficace"}`;
        break;
    }

    await tx.action.update({ where: { id: action.id }, data });
    if (evenement) await ajouterEvenement(tx, r.id, evenement, qui, maintenant);
    await journal(tx, acteur, r, ctx, "action.modifier", { actionId: action.id, champ: m.champ, valeur: m.valeur });
    return message;
  });
}

// ───────────────────────── 4. Retour au client ─────────────────────────

/** Texte proposé par « Partir du modèle » (repris de la maquette). */
export function modeleReponse(numero: string, premiereAction: string | null): string {
  // Les actions sont rédigées à l'infinitif (« Livrer le reliquat ») : « nous avons livrer » serait fautif.
  const fait = premiereAction
    ? `nous avons pris la mesure suivante : ${premiereAction.charAt(0).toLowerCase()}${premiereAction.slice(1).replace(/[.\s]+$/, "")}`
    : "nous avons pris les mesures nécessaires";
  return `Bonjour, suite à votre réclamation ${numero}, ${fait}. Nous vous prions de nous excuser pour la gêne occasionnée.`;
}

export async function repondre(acteur: Acteur, numero: string, saisie: unknown, ctx: ContexteRequete): Promise<Resultat> {
  let messageIds: string[] = [];
  const resultat = await executer(acteur, numero, async (tx, r) => {
    exiger(peutRepondre(acteur, r), "Seuls le responsable de traitement, le responsable de l'activité et le Service QHSE répondent au client.");
    const { texte, canaux } = schemaReponse.parse(saisie);
    if (r.reponseLe) throw new RefusMetier("La réponse a déjà été envoyée au client.");
    if (canaux.includes("EMAIL") && !r.email) throw new RefusMetier("Ce client n'a pas d'adresse e-mail.");
    const choisis: Canal[] = (["SMS", "EMAIL"] as const).filter((c) => canaux.includes(c));
    const maintenant = new Date();
    await tx.reclamation.update({ where: { id: r.id }, data: { reponse: texte, reponseLe: maintenant, reponseCanaux: choisis, reponseParId: acteur.id } });
    const messages = [];
    if (choisis.includes("SMS")) {
      messages.push(await preparerMessage(tx, { societeId: r.societeId, reclamationId: r.id, canal: "SMS", destinataire: r.telephone, corps: texte }));
    }
    if (choisis.includes("EMAIL") && r.email) {
      messages.push(
        await preparerMessage(tx, {
          societeId: r.societeId,
          reclamationId: r.id,
          canal: "EMAIL",
          destinataire: r.email,
          objet: `Réponse à votre réclamation ${r.numero}`,
          corps: `${texte}\n\n${r.societe.nom} · Service réclamations`,
        }),
      );
    }
    messageIds = messages.map((m) => m.id);
    const canauxTexte = texteCanaux(choisis);
    await ajouterEvenement(tx, r.id, `Réponse envoyée au client (${canauxTexte})`, { userId: acteur.id }, maintenant);
    await journal(tx, acteur, r, ctx, "reclamation.repondre", { canaux: choisis, longueur: texte.length });
    return `Réponse envoyée à ${r.clientNom} par ${canauxTexte}`;
  });
  if (resultat.ok) await expedier(db, messageIds);
  return resultat;
}

// ───────────────────────── 5. Amélioration continue ─────────────────────────

export function enregistrerCauses(acteur: Acteur, numero: string, saisie: unknown, ctx: ContexteRequete) {
  return executer(acteur, numero, async (tx, r) => {
    exiger(peutTraiter(acteur, r));
    const { causes } = schemaCauses.parse(saisie);
    const avant = r.causes?.trim() ?? "";
    if (avant === causes) return undefined;
    await tx.reclamation.update({ where: { id: r.id }, data: { causes: causes || null } });
    if (!avant && causes) await ajouterEvenement(tx, r.id, "Causes racines renseignées", { userId: acteur.id });
    await journal(tx, acteur, r, ctx, "reclamation.causes", { longueur: causes.length });
    return undefined;
  });
}

// ───────────────────────── 6. Visas et clôture ─────────────────────────

const LIBELLE_VISA: Record<TypeVisa, string> = { DIRECTION_COMMERCIALE: "la Direction Commerciale", QHSE: "le Service QHSE" };

export function viser(acteur: Acteur, numero: string, type: TypeVisa, ctx: ContexteRequete) {
  return executer(acteur, numero, async (tx, r) => {
    exiger(peutViser(acteur, r, type), type === "QHSE" ? "Réservé au Service QHSE." : "Réservé à la Direction Commerciale.");
    const blocage = blocageVisa(r, type);
    if (blocage) throw new RefusMetier(blocage);
    await tx.visa.create({ data: { reclamationId: r.id, type, userId: acteur.id } });
    await ajouterEvenement(tx, r.id, `Fiche visée par ${LIBELLE_VISA[type]}`, { userId: acteur.id });
    await journal(tx, acteur, r, ctx, "reclamation.viser", { type });
    return `Fiche visée par ${acteur.nom}`;
  });
}

export function cloturer(acteur: Acteur, numero: string, ctx: ContexteRequete) {
  return executer(acteur, numero, async (tx, r) => {
    exiger(peutCloturer(acteur, r), r.clotureLe ? "La réclamation est déjà clôturée." : "Seul le Service QHSE clôture une réclamation.");
    if (!peutEtreCloturee(r)) throw new RefusMetier(`${texteManquants(conditionsManquantes(r).length)}.`);
    const maintenant = new Date();
    await tx.reclamation.update({ where: { id: r.id }, data: { clotureLe: maintenant, clotureParId: acteur.id } });
    await ajouterEvenement(tx, r.id, "Réclamation clôturée", { userId: acteur.id }, maintenant);
    await journal(tx, acteur, r, ctx, "reclamation.cloturer");
    return `Réclamation ${r.numero} clôturée`;
  });
}

// ───────────────────────── Pièces jointes et commentaires ─────────────────────────

export async function ajouterPieces(acteur: Acteur, numero: string, fichiers: { nom: string; octets: Uint8Array }[], ctx: ContexteRequete): Promise<Resultat> {
  if (fichiers.length === 0) return { ok: false, erreur: "Choisissez au moins un fichier." };
  const controles: { nom: string; taille: number; type: TypeAccepte; cle: string; sha256: string; octets: Uint8Array }[] = [];
  for (const f of fichiers) {
    const c = controlerFichier(f.nom, f.octets);
    if (!c.ok) return { ok: false, erreur: c.erreur };
    controles.push({ ...c, cle: nouvelleCle(c.type), sha256: empreinteSha256(f.octets), octets: f.octets });
  }
  // Fichiers écrits avant la transaction (jamais d'appel disque sous verrou), retirés en cas d'échec.
  const enregistres: string[] = [];
  try {
    for (const c of controles) {
      await stockage().enregistrer(c.cle, c.octets);
      enregistres.push(c.cle);
    }
    const resultat = await executer(acteur, numero, async (tx, r) => {
      exiger(peutAjouterPiece(acteur, r), r.clotureLe ? "La réclamation est clôturée : la fiche est en lecture seule." : undefined);
      if (r.nombrePieces + controles.length > MAX_PIECES_PAR_RECLAMATION) {
        throw new RefusMetier(`${MAX_PIECES_PAR_RECLAMATION} pièces jointes au maximum par réclamation.`);
      }
      for (const c of controles) {
        await tx.pieceJointe.create({
          data: { reclamationId: r.id, source: "INTERNE", nomOriginal: c.nom, typeMime: c.type.mime, taille: c.taille, cleStockage: c.cle, sha256: c.sha256, deposeeParId: acteur.id },
        });
        await ajouterEvenement(tx, r.id, `Pièce jointe ajoutée : ${c.nom}`, { userId: acteur.id });
      }
      await journal(tx, acteur, r, ctx, "piece.ajouter", { fichiers: controles.map((c) => ({ nom: c.nom, taille: c.taille, type: c.type.mime })) });
      return controles.length === 1 ? "Pièce jointe ajoutée" : `${controles.length} pièces jointes ajoutées`;
    });
    if (!resultat.ok) await Promise.all(enregistres.map((cle) => stockage().supprimer(cle).catch(() => undefined)));
    return resultat;
  } catch (e) {
    await Promise.all(enregistres.map((cle) => stockage().supprimer(cle).catch(() => undefined)));
    throw e;
  }
}

export function commenter(acteur: Acteur, numero: string, saisie: unknown, ctx: ContexteRequete) {
  return executer(acteur, numero, async (tx, r) => {
    exiger(peutCommenter(acteur, r));
    const { texte } = schemaCommentaire.parse(saisie);
    const c = await tx.commentaire.create({ data: { reclamationId: r.id, auteurId: acteur.id, texte }, select: { id: true } });
    await journal(tx, acteur, r, ctx, "commentaire.ajouter", { commentaireId: c.id });
    return "Commentaire publié";
  });
}
