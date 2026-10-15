import { describe, expect, it } from "vitest";
import { conditionSuivi, lireFiltres } from "@/server/requetes/suivi";
import type { Acteur } from "@/server/droits/permissions";

describe("filtres du tableau de suivi (paramètres d'URL)", () => {
  it("garde les valeurs valides", () => {
    expect(lireFiltres({ activite: "OXY", statut: "EN_RETARD", mode: "PLATEFORME_WEB", recurrent: "oui", q: "  concentrateur ", page: "2" })).toEqual({
      activite: "OXY",
      statut: "EN_RETARD",
      type: undefined,
      mode: "PLATEFORME_WEB",
      responsable: undefined,
      recurrent: "oui",
      q: "concentrateur",
      page: 2,
    });
  });

  it("ignore les valeurs inconnues ou piégées au lieu de planter", () => {
    const f = lireFiltres({ statut: "SUPPRIMEE", activite: "'; DROP TABLE", mode: "FAX", page: "-3", recurrent: "peut-être" });
    expect(f).toMatchObject({ statut: undefined, activite: undefined, mode: undefined, page: 1, recurrent: undefined });
  });

  it("applique toujours le périmètre de l'utilisateur", () => {
    const responsable: Acteur = { id: "u", nom: "u", role: "RESPONSABLE_TRAITEMENT", toutesSocietes: false, societeIds: ["s1"], activiteIds: ["a1"], activitesDirigeesIds: [] };
    const condition = conditionSuivi(responsable, "s2", lireFiltres({}), "2026-10-15");
    expect(condition).toEqual({ AND: [{ id: { in: [] } }] });
  });
});
