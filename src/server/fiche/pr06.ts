import "server-only";
import { formatDate, formatHeure } from "@/lib/dates";
import { LIBELLE_STATUT_ACTION } from "@/lib/libelles";
import { formaterTelephone } from "@/lib/telephone";
import { db } from "../db";
import { peutVoir, type Acteur } from "../droits/permissions";

/**
 * Données de la fiche papier PR06-ENR-01 « Fiche traitement des réclamations », déjà mises en forme
 * comme sur le formulaire (cases cochées, dates « 22 / 09 / 2026 »). Une seule source pour l'aperçu
 * à l'écran et pour le PDF téléchargé : les deux sont toujours identiques.
 */
export interface DonneesPr06 {
  numero: string;
  societe: { nom: string; logo: string };
  origine: string;
  filiale: string; // « Carrefour Médical · CM Oxygène médical »
  client: string;
  telephone: string;
  date: string; // « 22 / 09 / 2026 »
  heure: string; // « 08 : 31 »
  modes: { libelle: string; coche: boolean }[];
  types: { libelle: string; coche: boolean }[];
  details: string;
  recurrent: boolean;
  responsable: string;
  actions: { libelle: string; responsable: string; delai: string; statut: string; efficace: string }[];
  lignesVides: number; // le formulaire papier compte au moins 3 lignes d'actions
  reponse: { date: string; detail: string };
  causes: string;
  cloture: string | null; // « 12/10/2026 »
  visas: { dc: VisaPr06 | null; qhse: VisaPr06 | null };
}

export interface VisaPr06 {
  nom: string;
  quand: string; // « 12/10/2026 14:05 »
}

export const REFERENCE_PR06 = { reference: "PR06-ENR-01", version: "00", creation: "18 -08- 2026" } as const;

export async function donneesPr06(acteur: Acteur, societeId: string, numero: string): Promise<DonneesPr06 | null> {
  const r = await db.reclamation.findUnique({
    where: { numero },
    select: {
      numero: true,
      societeId: true,
      activiteId: true,
      responsableId: true,
      clotureLe: true,
      origine: true,
      clientNom: true,
      telephone: true,
      recueLe: true,
      mode: true,
      type: true,
      description: true,
      recurrent: true,
      reponse: true,
      reponseLe: true,
      causes: true,
      societe: { select: { nom: true, logo: true } },
      activite: { select: { nom: true } },
      responsable: { select: { nom: true } },
      actions: { orderBy: { ordre: "asc" }, select: { libelle: true, echeance: true, statut: true, efficace: true, responsableId: true, responsable: { select: { nom: true } } } },
      visas: { select: { type: true, viseLe: true, user: { select: { nom: true } } } },
    },
  });
  if (!r || r.societeId !== societeId || !peutVoir(acteur, r)) return null;

  const visa = (type: "DIRECTION_COMMERCIALE" | "QHSE"): VisaPr06 | null => {
    const v = r.visas.find((x) => x.type === type);
    return v ? { nom: v.user.nom, quand: `${formatDate(v.viseLe)} ${formatHeure(v.viseLe)}` } : null;
  };
  const web = r.mode === "PLATEFORME_WEB";

  return {
    numero: r.numero,
    societe: r.societe,
    origine: r.origine,
    filiale: `${r.societe.nom} · ${r.activite.nom}`,
    client: r.clientNom,
    telephone: formaterTelephone(r.telephone),
    date: formatDate(r.recueLe).split("/").join(" / "),
    heure: formatHeure(r.recueLe).replace(":", " : "),
    // Le formulaire papier n'a pas de case « Plateforme web » : elle est cochée dans « Autres ».
    modes: [
      { libelle: "Verbal", coche: r.mode === "VERBAL" },
      { libelle: "Mail", coche: r.mode === "MAIL" },
      { libelle: "Téléphone", coche: r.mode === "TELEPHONE" },
      { libelle: "Courrier", coche: r.mode === "COURRIER" },
      { libelle: web ? "Autres (plateforme web)" : "Autres", coche: r.mode === "AUTRES" || web },
    ],
    types: [
      { libelle: "Produit (qualité, prix, fonctionnalité)", coche: r.type === "PRODUIT" },
      { libelle: "service", coche: r.type === "SERVICE" },
      { libelle: "autres", coche: r.type === "AUTRE" },
    ],
    details: r.description,
    recurrent: r.recurrent,
    responsable: r.responsable?.nom ?? "",
    actions: r.actions.map((a) => ({
      libelle: a.libelle,
      responsable: a.responsable.nom,
      delai: formatDate(a.echeance),
      statut: LIBELLE_STATUT_ACTION[a.statut],
      efficace: a.efficace === true ? "Oui" : a.efficace === false ? "Non" : "",
    })),
    lignesVides: Math.max(0, 3 - r.actions.length),
    reponse: { date: r.reponseLe ? formatDate(r.reponseLe) : "", detail: r.reponse ?? "" },
    causes: r.causes ?? "",
    cloture: r.clotureLe ? formatDate(r.clotureLe) : null,
    visas: { dc: visa("DIRECTION_COMMERCIALE"), qhse: visa("QHSE") },
  };
}
