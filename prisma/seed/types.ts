/**
 * Forme du fichier donnees-maquette.json : données produites par le moteur des maquettes
 * validées (Portail client et Back-office), extraites telles quelles pour que la démonstration
 * affiche exactement les mêmes réclamations, chiffres et personnes que les maquettes.
 * Dates au format AAAA-MM-JJ, heures HH:MM, relatives au « jour de la maquette » (champ today).
 */

export type ModeMaquette = "Verbal" | "Mail" | "Téléphone" | "Courrier" | "Plateforme web" | "Autres";
export type StatutActionMaquette = "À faire" | "En cours" | "Réalisée";

export interface VisaMaquette {
  nom: string;
  fonction: string;
  date: string;
  heure: string;
}

export interface ActionMaquette {
  action: string;
  resp: string;
  echeance: string;
  statut: StatutActionMaquette;
  critere: string;
  efficace: boolean | null;
}

export interface EvenementMaquette {
  d: string;
  h: string;
  t: string;
  who: string;
}

export interface CommentaireMaquette {
  who: string;
  d: string;
  h: string;
  t: string;
}

export interface ReclamationMaquette {
  id: string;
  fil: string;
  date: string;
  heure: string;
  client: string;
  tel: string;
  email: string;
  mode: ModeMaquette;
  profil: "particulier" | "societe";
  secteur: string;
  contact: string;
  origine: string;
  type: "Produit" | "Service" | "Autre";
  sous: "" | "qualité" | "prix" | "fonctionnalité";
  desc: string;
  recurrent: boolean;
  similaires: string[];
  resp: string;
  actions: ActionMaquette[];
  causes: string;
  reponse: { date: string; detail: string; canaux?: string } | null;
  visaDC: VisaMaquette | null;
  visaQHSE: VisaMaquette | null;
  cloture: string | null;
  obs: string;
  pieces: string[];
  canaux: ("sms" | "email")[];
  histo: EvenementMaquette[];
  comments: CommentaireMaquette[];
}

export interface DivisionMaquette {
  code: string;
  nom: string;
  court: string;
  resp: string;
  icon: string;
  desc: string;
  equipes: { nom: string; membres: string[] }[];
}

export interface SocieteMaquette {
  code: "CM" | "SON" | "FLS";
  nom: string;
  domaine: string;
  accroche: string;
  mailDomain: string;
  telStd: string;
  divisions: DivisionMaquette[];
  defaults: { delais: { qual: number; rep: number; clo: number }; sms: string; mail: string };
  recs: ReclamationMaquette[];
}

export interface DonneesMaquette {
  today: string;
  groupe: { id: string; droit: string; nom: string; role: string; fonction?: string; email: string }[];
  societes: Record<"CM" | "SON" | "FLS", SocieteMaquette>;
}
