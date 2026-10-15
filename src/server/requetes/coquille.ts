import "server-only";
import { cache } from "react";
import { aujourdhuiIso, formatDate, formatHeure } from "@/lib/dates";
import { db } from "../db";
import { estAViser } from "../domaine/cloture";
import { alertesDelai } from "../domaine/delais";
import { actionEnRetard, calculerStatut } from "../domaine/statut";
import { filtreVisibilite, type Acteur } from "../droits/permissions";
import { delaisSociete, joursFeries } from "./contexte-societe";

export interface Notification {
  priorite: 0 | 1 | 2; // 0 = la plus urgente
  titre: string;
  detail: string;
  numero: string;
}

export interface DonneesCoquille {
  compteurs: { ouvertes: number; mesActions: number; aViser: number };
  notifications: Notification[];
}

/**
 * Compteurs du menu et notifications (mêmes règles que la maquette), calculés sur les
 * réclamations NON clôturées visibles par l'utilisateur dans la société.
 */
export const donneesCoquille = cache(async (acteur: Acteur, societeId: string): Promise<DonneesCoquille> => {
  const maintenant = new Date();
  const aujourdhui = aujourdhuiIso(maintenant);
  const [ouvertes, delais, feries] = await Promise.all([
    db.reclamation.findMany({
      where: { AND: [filtreVisibilite(acteur, societeId), { clotureLe: null }] },
      orderBy: { recueLe: "asc" },
      select: {
        numero: true,
        recueLe: true,
        mode: true,
        clientNom: true,
        clotureLe: true,
        responsableId: true,
        reponseLe: true,
        causes: true,
        activite: { select: { nomCourt: true } },
        actions: { select: { libelle: true, statut: true, echeance: true, efficace: true, responsableId: true }, orderBy: { ordre: "asc" } },
        visas: { select: { type: true } },
      },
    }),
    delaisSociete(societeId),
    joursFeries(),
  ]);

  let mesActions = 0;
  let aViser = 0;
  const notifications: Notification[] = [];

  for (const r of ouvertes) {
    const statut = calculerStatut(r, aujourdhui);
    mesActions += r.actions.filter((a) => a.responsableId === acteur.id && a.statut !== "REALISEE").length;
    if (estAViser(r)) aViser++;

    if (statut === "NOUVELLE" && r.mode === "PLATEFORME_WEB") {
      notifications.push({
        priorite: 1,
        titre: `Nouvelle réclamation en ligne ${r.numero}`,
        detail: `Déposée le ${formatDate(r.recueLe)} à ${formatHeure(r.recueLe)} par ${r.clientNom}`,
        numero: r.numero,
      });
    }
    for (const a of r.actions) {
      if (actionEnRetard(a, aujourdhui)) {
        notifications.push({ priorite: 0, titre: `${r.numero} : action en retard`, detail: `« ${a.libelle} » prévue le ${formatDate(a.echeance)}`, numero: r.numero });
      }
    }
    for (const alerte of alertesDelai(r, delais, maintenant, feries)) {
      if (alerte.type === "QUALIFICATION") notifications.push({ priorite: 1, titre: `${r.numero} n'est pas affectée`, detail: alerte.message, numero: r.numero });
    }
    if (acteur.role === "RESPONSABLE_TRAITEMENT" && r.responsableId === acteur.id && r.actions.length === 0) {
      notifications.push({ priorite: 1, titre: `${r.numero} vous est affectée`, detail: `${r.activite.nomCourt} · ${r.clientNom} : ajoutez les actions`, numero: r.numero });
    }
    const viseDC = r.visas.some((v) => v.type === "DIRECTION_COMMERCIALE");
    const viseQ = r.visas.some((v) => v.type === "QHSE");
    if (acteur.role === "DIRECTION_COMMERCIALE" && r.reponseLe && !viseDC) {
      notifications.push({ priorite: 2, titre: `${r.numero} attend votre visa`, detail: `Réponse envoyée au client le ${formatDate(r.reponseLe)}`, numero: r.numero });
    }
    const evaluee = r.actions.length > 0 && r.actions.every((a) => a.statut === "REALISEE" && a.efficace !== null) && !!r.causes?.trim();
    if (acteur.role === "QHSE" && evaluee && !viseQ) {
      notifications.push({ priorite: 2, titre: `${r.numero} attend le visa QHSE`, detail: "Actions réalisées et évaluées, causes renseignées", numero: r.numero });
    }
  }

  notifications.sort((a, b) => a.priorite - b.priorite);
  return { compteurs: { ouvertes: ouvertes.length, mesActions, aViser }, notifications };
});
