/**
 * Droits d'accès — fonctions pures, appelées par CHAQUE action serveur avant toute lecture
 * ou écriture. L'interface masque les boutons interdits, mais seul ce contrôle fait foi.
 *
 * Deux niveaux :
 *  1. le rôle autorise un type d'opération (matrice PERMISSIONS) ;
 *  2. le périmètre limite les réclamations concernées :
 *     - QHSE, Direction Commerciale, Agent d'accueil, Direction générale : toutes les sociétés ;
 *     - Responsable de traitement : sa société, et seulement les réclamations de ses activités
 *       (responsable ou membre d'équipe), celles dont il est responsable ou sur lesquelles il a une action.
 */
import type { Prisma, Role } from "@/generated/prisma/client";

export const PERMISSIONS = [
  "reclamation.lire",
  "reclamation.creer", // saisie accueil (téléphone, oral, courrier, mail)
  "reclamation.qualifier", // désigner le responsable, marquer « récurrent », lier des similaires
  "reclamation.traiter", // actions, causes racines, observations
  "reclamation.repondre", // réponse au client (SMS / e-mail)
  "reclamation.viser.dc",
  "reclamation.viser.qhse",
  "reclamation.cloturer",
  "reclamation.exporter",
  "piece.ajouter",
  "commentaire.ajouter",
  "parametres.gerer",
  "messages.consulter",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const TOUT = new Set<Permission>(PERMISSIONS);

const MATRICE: Record<Role, ReadonlySet<Permission>> = {
  QHSE: TOUT,
  DIRECTION_COMMERCIALE: new Set<Permission>(["reclamation.lire", "reclamation.viser.dc", "reclamation.exporter", "commentaire.ajouter"]),
  AGENT_ACCUEIL: new Set<Permission>(["reclamation.lire", "reclamation.creer", "reclamation.exporter", "piece.ajouter", "commentaire.ajouter"]),
  RESPONSABLE_TRAITEMENT: new Set<Permission>([
    "reclamation.lire",
    "reclamation.traiter",
    "reclamation.repondre",
    "reclamation.exporter",
    "piece.ajouter",
    "commentaire.ajouter",
  ]),
  DIRECTION_GENERALE: new Set<Permission>(["reclamation.lire", "reclamation.exporter"]), // lecture seule
};

/** Utilisateur connecté, tel que chargé à chaque requête (étape 3). */
export interface Acteur {
  id: string;
  nom: string;
  role: Role;
  toutesSocietes: boolean;
  societeIds: readonly string[]; // sociétés accessibles si toutesSocietes = false
  activiteIds: readonly string[]; // activités dont il est responsable ou membre d'équipe (visibilité)
  activitesDirigeesIds: readonly string[]; // activités dont il est le responsable (gestion des actions)
}

export class AccesRefuse extends Error {
  constructor(message = "Vous n'avez pas les droits pour cette opération.") {
    super(message);
    this.name = "AccesRefuse";
  }
}

export function aLaPermission(acteur: Pick<Acteur, "role">, permission: Permission): boolean {
  return MATRICE[acteur.role].has(permission);
}

export function exigerPermission(acteur: Pick<Acteur, "role">, permission: Permission): void {
  if (!aLaPermission(acteur, permission)) throw new AccesRefuse();
}

export function peutAccederSociete(acteur: Acteur, societeId: string): boolean {
  return acteur.toutesSocietes || acteur.societeIds.includes(societeId);
}

const restreintAuxActivites = (a: Acteur) => a.role === "RESPONSABLE_TRAITEMENT";

/** Condition Prisma : réclamations visibles par l'acteur dans une société. À combiner à toute requête. */
export function filtreVisibilite(acteur: Acteur, societeId: string): Prisma.ReclamationWhereInput {
  if (!peutAccederSociete(acteur, societeId) || !aLaPermission(acteur, "reclamation.lire")) {
    return { id: { in: [] } }; // aucune
  }
  if (!restreintAuxActivites(acteur)) return { societeId };
  return {
    societeId,
    OR: [
      { activiteId: { in: [...acteur.activiteIds] } },
      { responsableId: acteur.id },
      { actions: { some: { responsableId: acteur.id } } },
    ],
  };
}

export interface ReclamationPourDroits {
  societeId: string;
  activiteId: string;
  responsableId: string | null;
  clotureLe: Date | null;
  actions: readonly { responsableId: string }[];
}

/** Même règle que filtreVisibilite, sur une réclamation déjà chargée. */
export function peutVoir(acteur: Acteur, r: ReclamationPourDroits): boolean {
  if (!peutAccederSociete(acteur, r.societeId) || !aLaPermission(acteur, "reclamation.lire")) return false;
  if (!restreintAuxActivites(acteur)) return true;
  return (
    acteur.activiteIds.includes(r.activiteId) ||
    r.responsableId === acteur.id ||
    r.actions.some((a) => a.responsableId === acteur.id)
  );
}

/** Contrôle complet avant une modification : visibilité + permission + fiche non clôturée. */
export function exigerSurReclamation(acteur: Acteur, r: ReclamationPourDroits, permission: Permission): void {
  if (!peutVoir(acteur, r)) throw new AccesRefuse("Réclamation introuvable ou hors de votre périmètre.");
  exigerPermission(acteur, permission);
  if (r.clotureLe && permission !== "reclamation.lire" && permission !== "reclamation.exporter" && permission !== "commentaire.ajouter") {
    throw new AccesRefuse("La réclamation est clôturée : la fiche est en lecture seule.");
  }
}

/**
 * Modifier une action : le QHSE, le responsable de la réclamation et le responsable de l'activité
 * peuvent tout modifier ; la personne à qui l'action est confiée peut changer son statut
 * (« Marquer comme réalisée »).
 */
export function peutModifierAction(
  acteur: Acteur,
  r: ReclamationPourDroits,
  action: { responsableId: string },
  champ: "tout" | "statut",
): boolean {
  if (!peutVoir(acteur, r) || r.clotureLe) return false;
  if (acteur.role === "QHSE") return true;
  if (!aLaPermission(acteur, "reclamation.traiter")) return false;
  if (r.responsableId === acteur.id || acteur.activitesDirigeesIds.includes(r.activiteId)) return true;
  return champ === "statut" && action.responsableId === acteur.id;
}
