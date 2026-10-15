import { describe, expect, it } from "vitest";
import { calculerStatut, etapesClient, type ActionPourStatut } from "@/server/domaine/statut";

const J = (iso: string) => new Date(`${iso}T00:00:00Z`);
const action = (statut: ActionPourStatut["statut"], echeance: string): ActionPourStatut => ({ statut, echeance: J(echeance) });
const AUJ = "2026-10-02";

describe("calculerStatut — règles de la maquette", () => {
  it("Nouvelle : aucun responsable, aucune action en retard", () => {
    expect(calculerStatut({ clotureLe: null, responsableId: null, actions: [] }, AUJ)).toBe("NOUVELLE");
  });

  it("En cours : un responsable est désigné", () => {
    expect(calculerStatut({ clotureLe: null, responsableId: "u1", actions: [action("EN_COURS", "2026-10-05")] }, AUJ)).toBe("EN_COURS");
  });

  it("En retard dès qu'UNE action non réalisée dépasse son échéance (CM-2026-0041)", () => {
    const r = { clotureLe: null, responsableId: "u1", actions: [action("REALISEE", "2026-09-25"), action("EN_COURS", "2026-09-30")] };
    expect(calculerStatut(r, AUJ)).toBe("EN_RETARD");
  });

  it("une action dont l'échéance est aujourd'hui n'est pas en retard", () => {
    expect(calculerStatut({ clotureLe: null, responsableId: "u1", actions: [action("A_FAIRE", AUJ)] }, AUJ)).toBe("EN_COURS");
  });

  it("une action réalisée après son échéance ne met pas la réclamation en retard", () => {
    expect(calculerStatut({ clotureLe: null, responsableId: "u1", actions: [action("REALISEE", "2026-09-01")] }, AUJ)).toBe("EN_COURS");
  });

  it("Traitée l'emporte sur tout : la clôture fige le statut", () => {
    expect(calculerStatut({ clotureLe: J("2026-09-30"), responsableId: "u1", actions: [action("EN_COURS", "2026-09-01")] }, AUJ)).toBe("TRAITEE");
  });
});

describe("etapesClient — ce que voit le client", () => {
  it("expose 4 étapes et jamais le statut « En retard »", () => {
    const etapes = etapesClient({ recueLe: J("2026-09-22"), responsableId: "u1", affecteeLe: J("2026-09-22"), reponseLe: null, clotureLe: null });
    expect(etapes.map((e) => e.libelle)).toEqual(["Reçue", "En cours d'analyse", "Réponse envoyée", "Clôturée"]);
    expect(etapes.map((e) => e.faite)).toEqual([true, true, false, false]);
    expect(JSON.stringify(etapes)).not.toMatch(/retard/i);
  });
});
