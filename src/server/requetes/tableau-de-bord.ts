import "server-only";
import { z } from "zod";
import { ajouterJours, aujourdhuiIso, debutDuJour, ecartJours, jourIso } from "@/lib/dates";
import type { StatutReclamation } from "@/lib/libelles";
import { db } from "../db";
import { alertesDelai } from "../domaine/delais";
import { calculerStatut } from "../domaine/statut";
import { filtreVisibilite, type Acteur } from "../droits/permissions";
import { delaisSociete, joursFeries } from "./contexte-societe";

/**
 * Tableau de bord : mêmes calculs que la maquette.
 *  - Les indicateurs, la courbe et les répartitions portent sur les réclamations REÇUES pendant la période.
 *  - « À traiter en priorité » porte sur toutes les réclamations ouvertes (quelle que soit leur date).
 * Toujours limité à ce que l'utilisateur a le droit de voir.
 */

export const PERIODES = [
  { valeur: "7", jours: 7, libelle: "Cette semaine (7 derniers jours)", court: "7 derniers jours" },
  { valeur: "30", jours: 30, libelle: "30 derniers jours", court: "30 derniers jours" },
  { valeur: "90", jours: 90, libelle: "3 derniers mois", court: "3 derniers mois" },
  { valeur: "365", jours: 365, libelle: "12 derniers mois", court: "12 derniers mois" },
] as const;

const schemaFiltres = z.object({
  periode: z.enum(["7", "30", "90", "365"]).catch("365"),
  activite: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^[A-Z0-9]{2,8}$/).optional()).catch(undefined),
});
export type FiltresTableauDeBord = z.output<typeof schemaFiltres>;

export function lireFiltresTableauDeBord(params: Record<string, string | string[] | undefined>): FiltresTableauDeBord {
  const plat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  return schemaFiltres.parse(plat);
}

const MOIS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

export interface TableauDeBord {
  activites: { code: string; nom: string }[];
  recues: number;
  parStatut: Record<StatutReclamation, number>;
  delaiMoyen: number | null; // jours calendaires, réception → clôture
  objectifCloture: number;
  efficacite: { pourcentage: number; evaluees: number };
  courbe: { titre: string; points: { cle: string; libelle: string; nombre: number }[] };
  parActivite: { code: string; nom: string; nombre: number; enRetard: number }[];
  parType: { libelle: string; nombre: number; pourcentage: number }[];
  priorites: {
    numero: string;
    client: string;
    description: string;
    statut: StatutReclamation;
    age: number;
    alerte: string | null;
  }[];
}

export async function tableauDeBord(acteur: Acteur, societeId: string, f: FiltresTableauDeBord, maintenant = new Date()): Promise<TableauDeBord> {
  const periode = PERIODES.find((p) => p.valeur === f.periode)!;
  const aujourdhui = aujourdhuiIso(maintenant);
  const debut = ajouterJours(aujourdhui, -periode.jours);

  const [activites, delais, feries] = await Promise.all([
    db.activite.findMany({ where: { societeId, actif: true }, orderBy: { ordre: "asc" }, select: { id: true, code: true, nomCourt: true } }),
    delaisSociete(societeId),
    joursFeries(),
  ]);
  const activite = f.activite ? activites.find((a) => a.code === f.activite) : undefined;
  const visibles = { AND: [filtreVisibilite(acteur, societeId), activite ? { activiteId: activite.id } : {}] };
  const select = {
    numero: true,
    clientNom: true,
    description: true,
    recueLe: true,
    clotureLe: true,
    responsableId: true,
    reponseLe: true,
    activiteId: true,
    type: true,
    sousType: true,
    actions: { select: { statut: true, echeance: true, efficace: true } },
  } as const;

  const [recues, ouvertes] = await Promise.all([
    db.reclamation.findMany({ where: { AND: [visibles, { recueLe: { gte: debutDuJour(debut) } }] }, select }),
    db.reclamation.findMany({ where: { AND: [visibles, { clotureLe: null }] }, orderBy: { recueLe: "asc" }, select }),
  ]);

  // ── Indicateurs ──
  const statuts = recues.map((r) => calculerStatut(r, aujourdhui));
  const parStatut = { NOUVELLE: 0, EN_COURS: 0, EN_RETARD: 0, TRAITEE: 0 } satisfies Record<StatutReclamation, number>;
  for (const s of statuts) parStatut[s]++;
  const cloturees = recues.filter((r) => r.clotureLe);
  const delaiMoyen = cloturees.length
    ? cloturees.reduce((somme, r) => somme + ecartJours(jourIso(r.recueLe), jourIso(r.clotureLe!)), 0) / cloturees.length
    : null;
  const evaluations = recues.flatMap((r) => r.actions.filter((a) => a.efficace !== null).map((a) => a.efficace === true));
  const efficacite = {
    pourcentage: evaluations.length ? Math.round((evaluations.filter(Boolean).length / evaluations.length) * 100) : 0,
    evaluees: evaluations.length,
  };

  // ── Courbe : par jour jusqu'à 30 jours, par mois au-delà ──
  const parJour = periode.jours <= 30;
  const points: TableauDeBord["courbe"]["points"] = [];
  if (parJour) {
    for (let i = periode.jours - 1; i >= 0; i--) {
      const jour = ajouterJours(aujourdhui, -i);
      points.push({ cle: jour, libelle: `${jour.slice(8)}/${jour.slice(5, 7)}`, nombre: 0 });
    }
  } else {
    let annee = Number(debut.slice(0, 4));
    let mois = Number(debut.slice(5, 7));
    const fin = aujourdhui.slice(0, 7);
    for (let g = 0; g < 24; g++) {
      const cle = `${annee}-${String(mois).padStart(2, "0")}`;
      points.push({ cle, libelle: MOIS[mois - 1]! + (periode.jours > 90 ? ` ${String(annee).slice(2)}` : ""), nombre: 0 });
      if (cle === fin) break;
      if (++mois > 12) {
        mois = 1;
        annee++;
      }
    }
  }
  for (const r of recues) {
    const cle = parJour ? jourIso(r.recueLe) : jourIso(r.recueLe).slice(0, 7);
    const point = points.find((p) => p.cle === cle);
    if (point) point.nombre++;
  }

  // ── Répartitions ──
  const parActivite = activites.map((a) => {
    const ici = recues.map((r, i) => ({ r, statut: statuts[i] })).filter((x) => x.r.activiteId === a.id);
    return { code: a.code, nom: a.nomCourt, nombre: ici.length, enRetard: ici.filter((x) => x.statut === "EN_RETARD").length };
  });
  const TYPES = [
    { libelle: "Produit · qualité", test: (r: (typeof recues)[number]) => r.type === "PRODUIT" && r.sousType === "QUALITE" },
    { libelle: "Produit · prix", test: (r: (typeof recues)[number]) => r.type === "PRODUIT" && r.sousType === "PRIX" },
    { libelle: "Produit · fonctionnalité", test: (r: (typeof recues)[number]) => r.type === "PRODUIT" && r.sousType === "FONCTIONNALITE" },
    { libelle: "Service", test: (r: (typeof recues)[number]) => r.type === "SERVICE" },
    { libelle: "Autre", test: (r: (typeof recues)[number]) => r.type === "AUTRE" },
  ];
  const parType = TYPES.map((t) => {
    const nombre = recues.filter(t.test).length;
    return { libelle: t.libelle, nombre, pourcentage: recues.length ? Math.round((nombre / recues.length) * 100) : 0 };
  });

  // ── À traiter en priorité : en retard, puis délai dépassé, puis nouvelles, puis le reste ; les plus anciennes d'abord ──
  const priorites = ouvertes
    .map((r) => {
      const statut = calculerStatut(r, aujourdhui);
      const alertes = alertesDelai(r, delais, maintenant, feries);
      const rang = statut === "EN_RETARD" ? 0 : alertes.length ? 1 : statut === "NOUVELLE" ? 2 : 3;
      return { r, statut, alertes, rang };
    })
    .sort((a, b) => a.rang - b.rang || a.r.recueLe.getTime() - b.r.recueLe.getTime())
    .slice(0, 7)
    .map(({ r, statut, alertes }) => ({
      numero: r.numero,
      client: r.clientNom,
      description: r.description,
      statut,
      age: ecartJours(jourIso(r.recueLe), aujourdhui),
      alerte: alertes.length ? alertes.map((a) => a.message).join(" · ") : null,
    }));

  return {
    activites: activites.map((a) => ({ code: a.code, nom: a.nomCourt })),
    recues: recues.length,
    parStatut,
    delaiMoyen,
    objectifCloture: delais.clotureJ,
    efficacite,
    courbe: { titre: parJour ? "Réclamations reçues par jour" : "Réclamations reçues par mois", points },
    parActivite,
    parType,
    priorites,
  };
}
