import "server-only";
import { cache } from "react";
import type { JourIso } from "@/lib/dates";
import { db } from "../db";
import { DELAIS_PAR_DEFAUT, type Delais } from "../domaine/delais";

/** Délais cibles de la société (Paramètres QHSE). */
export const delaisSociete = cache(async (societeId: string): Promise<Delais> => {
  const p = await db.parametresSociete.findUnique({
    where: { societeId },
    select: { delaiQualificationH: true, delaiReponseJO: true, delaiClotureJ: true },
  });
  return p ? { qualificationH: p.delaiQualificationH, reponseJO: p.delaiReponseJO, clotureJ: p.delaiClotureJ } : DELAIS_PAR_DEFAUT;
});

/** Jours fériés saisis (exclus des jours ouvrés). */
export const joursFeries = cache(async (): Promise<ReadonlySet<JourIso>> => {
  const lignes = await db.jourFerie.findMany({ select: { date: true } });
  return new Set(lignes.map((l) => l.date.toISOString().slice(0, 10)));
});
