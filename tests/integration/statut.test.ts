import { afterAll, describe, expect, it } from "vitest";
import { ajouterJours, aujourdhuiIso } from "@/lib/dates";
import { STATUTS_RECLAMATION } from "@/lib/libelles";
import { calculerStatut, filtreStatut } from "@/server/domaine/statut";
import { db } from "./base";

/**
 * Le statut est calculé à deux endroits : en mémoire (fiche, listes) et en SQL (filtres, compteurs
 * du tableau de bord). Ce test vérifie sur toutes les réclamations de la base que les deux donnent
 * le même résultat, pour plusieurs dates de référence.
 */
describe("statut : calcul en mémoire ≡ filtre SQL", () => {
  afterAll(() => db.$disconnect());

  it("même résultat pour chaque réclamation de la base", async () => {
    const reclamations = await db.reclamation.findMany({
      select: { id: true, clotureLe: true, responsableId: true, actions: { select: { statut: true, echeance: true } } },
    });
    if (reclamations.length === 0) {
      console.warn("Base vide : lancez « npm run db:seed » pour un test complet.");
      return;
    }
    for (const jour of [aujourdhuiIso(), ajouterJours(aujourdhuiIso(), -20), ajouterJours(aujourdhuiIso(), 30)]) {
      for (const statut of STATUTS_RECLAMATION) {
        const enSql = await db.reclamation.findMany({ where: filtreStatut(statut, jour), select: { id: true } });
        const enMemoire = reclamations.filter((r) => calculerStatut(r, jour) === statut).map((r) => r.id);
        expect(enSql.map((r) => r.id).sort(), `${statut} au ${jour}`).toEqual(enMemoire.sort());
      }
    }
  });
});
