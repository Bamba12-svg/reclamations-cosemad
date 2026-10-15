import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { aujourdhuiIso, formatDate, type JourIso } from "@/lib/dates";
import { LIBELLE_MODE, LIBELLE_STATUT, STATUTS_RECLAMATION, type StatutReclamation } from "@/lib/libelles";
import { db } from "../db";
import { calculerStatut, filtreStatut } from "../domaine/statut";
import { filtreVisibilite, type Acteur } from "../droits/permissions";

/**
 * Tableau de suivi : mêmes 14 colonnes que le tableau Excel du QHSE.
 * Une seule requête sert l'écran, l'export Excel et l'export PDF : les trois montrent
 * exactement les mêmes lignes pour les mêmes filtres.
 */

export const COLONNES_SUIVI = [
  "N°",
  "Date de la réclamation",
  "Nom du réclamant ou société",
  "Mode de transmission",
  "Description",
  "Cause(s)",
  "Action(s) de prise en charge",
  "Responsable",
  "Échéance(s)",
  "Critère(s) de vérification de l'efficacité",
  "Efficacité (oui/non)",
  "Date de clôture",
  "Observations",
  "Statut",
] as const;

const vide = (v: unknown) => (v === "" ? undefined : v);
const schemaFiltres = z.object({
  activite: z.preprocess(vide, z.string().regex(/^[A-Z0-9]{2,8}$/).optional()).catch(undefined),
  statut: z.preprocess(vide, z.enum(STATUTS_RECLAMATION).optional()).catch(undefined),
  type: z.preprocess(vide, z.enum(["PRODUIT", "SERVICE", "AUTRE"]).optional()).catch(undefined),
  mode: z.preprocess(vide, z.enum(["VERBAL", "MAIL", "TELEPHONE", "COURRIER", "PLATEFORME_WEB", "AUTRES"]).optional()).catch(undefined),
  responsable: z.preprocess(vide, z.string().max(40).optional()).catch(undefined),
  recurrent: z.preprocess(vide, z.enum(["oui", "non"]).optional()).catch(undefined),
  q: z.preprocess(vide, z.string().trim().max(100).optional()).catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});
export type FiltresSuivi = z.output<typeof schemaFiltres>;

/** Paramètres d'URL → filtres valides (toute valeur inconnue est ignorée). */
export function lireFiltres(params: Record<string, string | string[] | undefined>): FiltresSuivi {
  const plat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  return schemaFiltres.parse(plat);
}

export function conditionSuivi(acteur: Acteur, societeId: string, f: FiltresSuivi, jour: JourIso): Prisma.ReclamationWhereInput {
  const et: Prisma.ReclamationWhereInput[] = [filtreVisibilite(acteur, societeId)];
  if (f.activite) et.push({ activite: { code: f.activite } });
  if (f.statut) et.push(filtreStatut(f.statut, jour));
  if (f.type) et.push({ type: f.type });
  if (f.mode) et.push({ mode: f.mode });
  if (f.responsable) et.push({ responsableId: f.responsable });
  if (f.recurrent) et.push({ recurrent: f.recurrent === "oui" });
  if (f.q) {
    et.push({
      OR: [
        { numero: { contains: f.q, mode: "insensitive" } },
        { clientNom: { contains: f.q, mode: "insensitive" } },
        { contactNom: { contains: f.q, mode: "insensitive" } },
        { description: { contains: f.q, mode: "insensitive" } },
      ],
    });
  }
  return { AND: et };
}

export interface LigneSuivi {
  numero: string;
  date: string;
  client: string;
  mode: string;
  description: string;
  causes: string;
  actions: string;
  responsable: string;
  echeances: string;
  criteres: string;
  efficacite: string;
  cloture: string;
  observations: string;
  statut: StatutReclamation;
  libelleStatut: string;
  dateReception: Date;
  dateCloture: Date | null;
}

const SELECTION = {
  numero: true,
  recueLe: true,
  clientNom: true,
  mode: true,
  description: true,
  causes: true,
  observations: true,
  clotureLe: true,
  responsableId: true,
  responsable: { select: { nom: true } },
  actions: { orderBy: { ordre: "asc" }, select: { libelle: true, echeance: true, critere: true, efficace: true, statut: true } },
} satisfies Prisma.ReclamationSelect;

type Brute = Prisma.ReclamationGetPayload<{ select: typeof SELECTION }>;

function enLigne(r: Brute, jour: JourIso): LigneSuivi {
  const effs = r.actions.map((a) => a.efficace);
  const statut = calculerStatut(r, jour);
  return {
    numero: r.numero,
    date: formatDate(r.recueLe),
    client: r.clientNom,
    mode: LIBELLE_MODE[r.mode],
    description: r.description,
    causes: r.causes?.trim() || "",
    actions: r.actions.map((a) => a.libelle).join(" ; "),
    responsable: r.responsable?.nom ?? "Non affectée",
    echeances: r.actions.map((a) => formatDate(a.echeance)).join(", "),
    criteres: r.actions.map((a) => a.critere).filter(Boolean).join(" ; "),
    efficacite: effs.length && effs.every((e) => e === true) ? "Oui" : effs.some((e) => e === false) ? "Non" : "",
    cloture: r.clotureLe ? formatDate(r.clotureLe) : "",
    observations: r.observations?.trim() || "",
    statut,
    libelleStatut: LIBELLE_STATUT[statut],
    dateReception: r.recueLe,
    dateCloture: r.clotureLe,
  };
}

export const LIGNES_PAR_PAGE = 50;

/** Lignes du tableau. `tout` : toutes les lignes (exports), sinon une page de 50. */
export async function chargerSuivi(acteur: Acteur, societeId: string, f: FiltresSuivi, options: { tout?: boolean } = {}) {
  const jour = aujourdhuiIso();
  const where = conditionSuivi(acteur, societeId, f, jour);
  const [total, brutes] = await Promise.all([
    db.reclamation.count({ where }),
    db.reclamation.findMany({
      where,
      select: SELECTION,
      orderBy: [{ recueLe: "desc" }, { numero: "desc" }],
      skip: options.tout ? 0 : (f.page - 1) * LIGNES_PAR_PAGE,
      take: options.tout ? 5000 : LIGNES_PAR_PAGE,
    }),
  ]);
  return { total, lignes: brutes.map((r) => enLigne(r, jour)) };
}

/** Onglets : toutes les activités + une par activité, avec leur nombre de réclamations visibles. */
export async function ongletsSuivi(acteur: Acteur, societeId: string) {
  const visibles = filtreVisibilite(acteur, societeId);
  const [activites, parActivite] = await Promise.all([
    db.activite.findMany({ where: { societeId }, orderBy: { ordre: "asc" }, select: { id: true, code: true, nom: true, nomCourt: true } }),
    db.reclamation.groupBy({ by: ["activiteId"], where: visibles, _count: { _all: true } }),
  ]);
  const compte = new Map(parActivite.map((g) => [g.activiteId, g._count._all]));
  const total = parActivite.reduce((n, g) => n + g._count._all, 0);
  return [
    { code: "", libelle: "Toutes les activités", nom: "Toutes les activités", nombre: total },
    ...activites.map((a) => ({ code: a.code, libelle: a.nomCourt, nom: a.nom, nombre: compte.get(a.id) ?? 0 })),
  ];
}

/** Responsables proposés dans le filtre : ceux qui ont au moins une réclamation dans la société. */
export async function responsablesSuivi(societeId: string) {
  return db.user.findMany({
    where: { dossiers: { some: { societeId } } },
    orderBy: { nom: "asc" },
    select: { id: true, nom: true },
  });
}

/** Description lisible des filtres (en-tête de l'export PDF). */
export function texteFiltres(f: FiltresSuivi, responsables: { id: string; nom: string }[]): string {
  const morceaux = [
    f.statut && `Statut : ${LIBELLE_STATUT[f.statut]}`,
    f.type && `Type : ${{ PRODUIT: "Produit", SERVICE: "Service", AUTRE: "Autre" }[f.type]}`,
    f.mode && `Mode : ${LIBELLE_MODE[f.mode]}`,
    f.responsable && `Responsable : ${responsables.find((r) => r.id === f.responsable)?.nom ?? "?"}`,
    f.recurrent && `Récurrent : ${f.recurrent}`,
    f.q && `Recherche : « ${f.q} »`,
  ].filter(Boolean);
  return morceaux.length ? morceaux.join(" · ") : "Aucun filtre";
}

export function celluleSuivi(l: LigneSuivi): string[] {
  return [l.numero, l.date, l.client, l.mode, l.description, l.causes, l.actions, l.responsable, l.echeances, l.criteres, l.efficacite, l.cloture, l.observations, l.libelleStatut];
}
