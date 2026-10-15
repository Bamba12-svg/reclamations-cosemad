import "server-only";
import type { Canal, ModeTransmission, StatutAction, TypeVisa } from "@/generated/prisma/client";
import { aujourdhuiIso, ecartJours, formatDate, formatHeure, jourIso } from "@/lib/dates";
import { texteCanaux, texteType, type StatutReclamation } from "@/lib/libelles";
import { formaterTelephone } from "@/lib/telephone";
import { db } from "../db";
import { blocageVisa, conditionsCloture, etapesFiche, type Condition, type EtapeFiche } from "../domaine/cloture";
import { actionEnRetard, calculerStatut } from "../domaine/statut";
import { modeDemo } from "../demo";
import {
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
import { modeleReponse } from "./operations";
import { responsablesPossibles, type ResponsablePossible } from "./responsables";

/** Tout ce que l'écran « Fiche réclamation » affiche, déjà mis en forme (sérialisable). */
export interface VueFiche {
  numero: string;
  statut: StatutReclamation;
  ageTexte: string;
  cloturee: string | null; // « 12/10/2026 »
  etapes: EtapeFiche[];
  conditions: Condition[];
  manquantes: number;

  activite: { nom: string; icone: string; responsable: string | null; equipes: string };
  client: { nom: string; contact: string | null; telephone: string; email: string | null; origine: string };
  recue: { date: string; heure: string };
  mode: ModeTransmission;
  type: string;
  description: string;
  recurrent: boolean;
  similaires: { numero: string; date: string; description: string; statut: StatutReclamation }[];
  similairesTexte: string;

  responsableId: string | null;
  responsables: ResponsablePossible[];
  actions: VueAction[];
  responsableParDefaut: string | null;

  reponse: { texte: string; date: string; canaux: string } | null;
  canauxProposes: Canal[];
  emailClient: boolean;
  modeleReponse: string;

  causes: string;

  visas: Record<"dc" | "qhse", VueVisa>;

  pieces: { id: string; nom: string; ext: string; image: boolean }[];
  commentaires: { id: string; auteur: string; initiales: string; quand: string; texte: string }[];
  historique: { id: string; libelle: string; quand: string; qui: string }[];

  droits: { qualifier: boolean; traiter: boolean; repondre: boolean; cloturer: boolean; pieces: boolean; commenter: boolean };
}

export interface VueAction {
  id: string;
  n: number;
  libelle: string;
  responsableId: string;
  echeance: string; // AAAA-MM-JJ
  statut: StatutAction;
  critere: string;
  efficace: boolean | null;
  enRetard: boolean;
  modifiable: "tout" | "statut" | "rien";
}

export interface VueVisa {
  vise: { nom: string; fonction: string; quand: string } | null;
  signataire: string; // personne attendue (« Ibrahima Fall »)
  peutViser: boolean;
  raison: string | null; // pourquoi le bouton « Viser » est désactivé
  simuler: { userId: string; nom: string } | null; // mode démo : passer au profil du signataire
}

const FONCTION_VISA: Record<TypeVisa, string> = { DIRECTION_COMMERCIALE: "Direction Commerciale", QHSE: "Service QHSE" };

export function initiales(nom: string): string {
  return nom
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((m) => m[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const quand = (d: Date) => `${formatDate(d)} · ${formatHeure(d)}`;

/** Charge la fiche si elle existe, appartient à la société et est visible par l'acteur ; sinon null. */
export async function chargerFiche(acteur: Acteur, societeId: string, numero: string): Promise<VueFiche | null> {
  const r = await db.reclamation.findUnique({
    where: { numero },
    select: {
      id: true,
      numero: true,
      societeId: true,
      activiteId: true,
      responsableId: true,
      recueLe: true,
      mode: true,
      origine: true,
      clientNom: true,
      contactNom: true,
      contactFonction: true,
      telephone: true,
      email: true,
      canauxReponse: true,
      type: true,
      sousType: true,
      description: true,
      recurrent: true,
      causes: true,
      reponse: true,
      reponseLe: true,
      reponseCanaux: true,
      clotureLe: true,
      activite: {
        select: {
          nom: true,
          icone: true,
          responsable: { select: { nom: true } },
          equipes: { orderBy: { ordre: "asc" }, select: { nom: true } },
        },
      },
      responsable: { select: { id: true, nom: true } },
      actions: {
        orderBy: { ordre: "asc" },
        select: { id: true, libelle: true, responsableId: true, echeance: true, statut: true, critere: true, efficace: true, responsable: { select: { id: true, nom: true } } },
      },
      visas: { select: { type: true, viseLe: true, user: { select: { nom: true } } } },
      similaires: { select: SELECT_SIMILAIRE },
      similaireDe: { select: SELECT_SIMILAIRE },
      pieces: { orderBy: { createdAt: "asc" }, select: { id: true, nomOriginal: true, typeMime: true } },
      commentaires: { orderBy: { createdAt: "asc" }, select: { id: true, texte: true, createdAt: true, auteur: { select: { nom: true } } } },
      historique: {
        orderBy: [{ survenuLe: "desc" }, { id: "desc" }],
        select: { id: true, libelle: true, survenuLe: true, acteurLibelle: true, acteur: { select: { nom: true } } },
      },
    },
  });
  if (!r || r.societeId !== societeId || !peutVoir(acteur, r)) return null;

  const maintenant = new Date();
  const aujourdhui = aujourdhuiIso(maintenant);
  const age = ecartJours(jourIso(r.recueLe), aujourdhui);
  const pourCloture = { ...r, visas: r.visas.map((v) => ({ type: v.type })) };
  const conditions = conditionsCloture(pourCloture);

  const [possibles, signataires] = await Promise.all([responsablesPossibles(db, r.activiteId), signatairesAttendus(acteur)]);
  // Une personne désactivée depuis reste affichée sur les fiches qui lui étaient confiées.
  const responsables = [...possibles];
  for (const u of [r.responsable, ...r.actions.map((a) => a.responsable)]) {
    if (u && !responsables.some((p) => p.id === u.id)) responsables.push({ id: u.id, nom: u.nom, libelle: u.nom });
  }

  // Similaires : la relation est enregistrée dans un sens ou dans l'autre ; seulement celles que l'acteur peut voir.
  const similaires = [...r.similaires, ...r.similaireDe]
    .filter((s, i, liste) => liste.findIndex((x) => x.id === s.id) === i && peutVoir(acteur, s))
    .sort((a, b) => b.recueLe.getTime() - a.recueLe.getTime());
  // « en 6 mois » (texte de la maquette) : écart compté en mois calendaires, d'avril à octobre = 6 mois.
  const mois = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();
  const recentes = similaires.every((s) => Math.abs(mois(r.recueLe) - mois(s.recueLe)) <= 6);

  const vue = (type: TypeVisa, cle: "dc" | "qhse"): VueVisa => {
    const visa = r.visas.find((v) => v.type === type);
    const roleOk = peutViser(acteur, r, type);
    const blocage = blocageVisa(pourCloture, type);
    const signataire = signataires[cle];
    return {
      vise: visa ? { nom: visa.user.nom, fonction: FONCTION_VISA[type], quand: `${formatDate(visa.viseLe)} à ${formatHeure(visa.viseLe)}` } : null,
      signataire: signataire?.nom ?? FONCTION_VISA[type],
      peutViser: roleOk && !blocage,
      raison: !roleOk ? (type === "QHSE" ? "Réservé au Service QHSE." : "Réservé à la Direction Commerciale.") : blocage,
      simuler:
        modeDemo() && !r.clotureLe && !visa && acteur.role !== type && signataire
          ? signataire
          : null,
    };
  };

  const canauxProposes = r.canauxReponse.filter((c) => c === "SMS" || !!r.email);

  return {
    numero: r.numero,
    statut: calculerStatut(r, aujourdhui),
    ageTexte: age <= 0 ? "Reçue aujourd'hui" : age === 1 ? "Reçue hier" : `Reçue il y a ${age} jours`,
    cloturee: r.clotureLe ? formatDate(r.clotureLe) : null,
    etapes: etapesFiche(pourCloture),
    conditions,
    manquantes: conditions.filter((c) => !c.remplie).length,

    activite: {
      nom: r.activite.nom,
      icone: r.activite.icone,
      responsable: r.activite.responsable?.nom ?? null,
      equipes: r.activite.equipes.map((e) => e.nom).join(", "),
    },
    client: {
      nom: r.clientNom,
      contact: r.contactNom ? r.contactNom + (r.contactFonction ? ` (${r.contactFonction})` : "") : null,
      telephone: formaterTelephone(r.telephone),
      email: r.email,
      origine: r.origine,
    },
    recue: { date: formatDate(r.recueLe), heure: formatHeure(r.recueLe) },
    mode: r.mode,
    type: texteType(r.type, r.sousType),
    description: r.description,
    recurrent: r.recurrent,
    similaires: similaires.map((s) => ({ numero: s.numero, date: formatDate(s.recueLe), description: s.description, statut: calculerStatut(s, aujourdhui) })),
    similairesTexte:
      (similaires.length === 1 ? "1 réclamation similaire" : `${similaires.length} réclamations similaires`) + (recentes ? " en 6 mois" : ""),

    responsableId: r.responsableId,
    responsables,
    responsableParDefaut: r.responsableId ?? possibles[0]?.id ?? null,
    actions: r.actions.map((a, i) => ({
      id: a.id,
      n: i + 1,
      libelle: a.libelle,
      responsableId: a.responsableId,
      echeance: jourIso(a.echeance),
      statut: a.statut,
      critere: a.critere,
      efficace: a.efficace,
      enRetard: actionEnRetard(a, aujourdhui),
      modifiable: peutModifierAction(acteur, r, a, "tout") ? "tout" : peutModifierAction(acteur, r, a, "statut") ? "statut" : "rien",
    })),

    reponse: r.reponse && r.reponseLe ? { texte: r.reponse, date: formatDate(r.reponseLe), canaux: texteCanaux(r.reponseCanaux) } : null,
    canauxProposes: canauxProposes.length ? canauxProposes : ["SMS"],
    emailClient: !!r.email,
    modeleReponse: modeleReponse(r.numero, r.actions[0]?.libelle ?? null),

    causes: r.causes ?? "",

    visas: { dc: vue("DIRECTION_COMMERCIALE", "dc"), qhse: vue("QHSE", "qhse") },

    pieces: r.pieces.map((p) => ({ id: p.id, nom: p.nomOriginal, ext: (p.nomOriginal.split(".").pop() ?? "").toUpperCase(), image: p.typeMime.startsWith("image/") })),
    commentaires: r.commentaires.map((c) => ({ id: c.id, auteur: c.auteur.nom, initiales: initiales(c.auteur.nom), quand: quand(c.createdAt), texte: c.texte })),
    historique: r.historique.map((h) => ({ id: h.id, libelle: h.libelle, quand: quand(h.survenuLe), qui: h.acteur?.nom ?? h.acteurLibelle ?? "Système" })),

    droits: {
      qualifier: peutQualifier(acteur, r),
      traiter: peutTraiter(acteur, r),
      repondre: peutRepondre(acteur, r),
      cloturer: peutCloturer(acteur, r),
      pieces: peutAjouterPiece(acteur, r),
      commenter: peutCommenter(acteur, r),
    },
  };
}

const SELECT_SIMILAIRE = {
  id: true,
  numero: true,
  recueLe: true,
  description: true,
  societeId: true,
  activiteId: true,
  responsableId: true,
  clotureLe: true,
  actions: { select: { responsableId: true, statut: true, echeance: true } },
} as const;

/** Personnes attendues pour chaque visa (l'utilisateur lui-même s'il a ce rôle). */
async function signatairesAttendus(acteur: Acteur): Promise<Record<"dc" | "qhse", { userId: string; nom: string } | null>> {
  const premier = async (role: "DIRECTION_COMMERCIALE" | "QHSE") => {
    if (acteur.role === role) return { userId: acteur.id, nom: acteur.nom };
    const u = await db.user.findFirst({ where: { role, actif: true }, orderBy: { nom: "asc" }, select: { id: true, nom: true } });
    return u ? { userId: u.id, nom: u.nom } : null;
  };
  const [dc, qhse] = await Promise.all([premier("DIRECTION_COMMERCIALE"), premier("QHSE")]);
  return { dc, qhse };
}
