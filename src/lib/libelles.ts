/**
 * Libellés français des valeurs stockées en base. Une seule source pour toute l'interface,
 * les exports Excel et la fiche PDF.
 */
import type {
  Canal,
  ModeTransmission,
  Profil,
  Role,
  SousTypeProduit,
  StatutAction,
  TypeReclamation,
} from "@/generated/prisma/enums";

export const STATUTS_RECLAMATION = ["NOUVELLE", "EN_COURS", "EN_RETARD", "TRAITEE"] as const;
export type StatutReclamation = (typeof STATUTS_RECLAMATION)[number];

export const LIBELLE_STATUT: Record<StatutReclamation, string> = {
  NOUVELLE: "Nouvelle",
  EN_COURS: "En cours",
  EN_RETARD: "En retard",
  TRAITEE: "Traitée",
};

/** Ordre des modes dans la maquette (boutons de la fiche et de la saisie accueil). */
export const MODES_TRANSMISSION: ModeTransmission[] = ["VERBAL", "MAIL", "TELEPHONE", "COURRIER", "PLATEFORME_WEB", "AUTRES"];

export const LIBELLE_MODE: Record<ModeTransmission, string> = {
  VERBAL: "Verbal",
  MAIL: "Mail",
  TELEPHONE: "Téléphone",
  COURRIER: "Courrier",
  PLATEFORME_WEB: "Plateforme web",
  AUTRES: "Autres",
};

export const LIBELLE_TYPE: Record<TypeReclamation, string> = {
  PRODUIT: "Produit",
  SERVICE: "Service",
  AUTRE: "Autre",
};

export const LIBELLE_SOUS_TYPE: Record<SousTypeProduit, string> = {
  QUALITE: "qualité",
  PRIX: "prix",
  FONCTIONNALITE: "fonctionnalité",
};

export const LIBELLE_STATUT_ACTION: Record<StatutAction, string> = {
  A_FAIRE: "À faire",
  EN_COURS: "En cours",
  REALISEE: "Réalisée",
};

export const LIBELLE_ROLE: Record<Role, string> = {
  QHSE: "Service QHSE",
  DIRECTION_COMMERCIALE: "Direction Commerciale",
  AGENT_ACCUEIL: "Agent d'accueil",
  RESPONSABLE_TRAITEMENT: "Responsable de traitement",
  DIRECTION_GENERALE: "Direction générale",
};

export const LIBELLE_PROFIL: Record<Profil, string> = {
  PARTICULIER: "Client particulier",
  SOCIETE: "Société",
};

export const LIBELLE_CANAL: Record<Canal, string> = { SMS: "SMS", EMAIL: "E-mail" };

/** « SMS », « e-mail » ou « SMS et e-mail » (en minuscules dans une phrase). */
export function texteCanaux(canaux: readonly Canal[], debutDePhrase = false): string {
  const sms = canaux.includes("SMS");
  const mail = canaux.includes("EMAIL");
  if (sms && mail) return "SMS et e-mail";
  if (mail) return debutDePhrase ? "E-mail" : "e-mail";
  return "SMS";
}

/** « Produit (qualité) », « Service »… */
export function texteType(type: TypeReclamation, sousType: SousTypeProduit | null): string {
  return sousType ? `${LIBELLE_TYPE[type]} (${LIBELLE_SOUS_TYPE[sousType]})` : LIBELLE_TYPE[type];
}

/** Origines proposées à l'accueil (liste de la maquette). */
export const ORIGINES = [
  "Client particulier",
  "Société · Santé",
  "Société · Énergie",
  "Société · BTP et sécurité",
  "Société · Agroalimentaire",
  "Société · Commerce",
  "Société · Restauration",
  "Société · Hôtellerie",
  "Société · Industrie",
  "Interne",
] as const;

/** Secteurs proposés au client « société » sur le portail. */
export const SECTEURS_PORTAIL = ["Santé", "Énergie", "BTP et sécurité", "Agroalimentaire", "Autre"] as const;
