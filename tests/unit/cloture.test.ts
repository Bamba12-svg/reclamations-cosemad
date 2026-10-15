import { describe, expect, it } from "vitest";
import {
  blocageVisa,
  conditionsCloture,
  conditionsManquantes,
  estAViser,
  etapesFiche,
  peutEtreCloturee,
  texteManquants,
  type ReclamationPourCloture,
} from "@/server/domaine/cloture";

const complete: ReclamationPourCloture = {
  responsableId: "u1",
  causes: "Tarif du devis non repris lors de la facturation.",
  reponseLe: new Date("2026-09-19T15:30:00Z"),
  clotureLe: null,
  actions: [{ statut: "REALISEE", efficace: true }],
  visas: [{ type: "DIRECTION_COMMERCIALE" }, { type: "QHSE" }],
};

describe("Avant de clôturer — 8 conditions", () => {
  it("liste les 8 conditions dans l'ordre de la maquette", () => {
    expect(conditionsCloture(complete).map((c) => c.libelle)).toEqual([
      "Responsable de traitement désigné",
      "Au moins une action enregistrée",
      "Toutes les actions réalisées",
      "Efficacité de chaque action renseignée",
      "Causes racines renseignées",
      "Réponse envoyée au client",
      "Visa de la Direction Commerciale",
      "Visa du Service QHSE",
    ]);
  });

  it("autorise la clôture quand les 8 sont remplies", () => {
    expect(peutEtreCloturee(complete)).toBe(true);
  });

  it.each([
    ["sans responsable", { responsableId: null }, ["responsable"]],
    ["sans action", { actions: [] }, ["action", "realisees", "efficacite"]],
    ["une action non réalisée", { actions: [{ statut: "EN_COURS" as const, efficace: true }] }, ["realisees"]],
    ["efficacité non évaluée", { actions: [{ statut: "REALISEE" as const, efficace: null }] }, ["efficacite"]],
    ["causes vides (espaces seulement)", { causes: "   " }, ["causes"]],
    ["réponse non envoyée", { reponseLe: null }, ["reponse"]],
    ["visa DC manquant", { visas: [{ type: "QHSE" as const }] }, ["visaDC"]],
    ["visa QHSE manquant", { visas: [{ type: "DIRECTION_COMMERCIALE" as const }] }, ["visaQHSE"]],
  ])("bloque la clôture : %s", (_, modif, manquantes) => {
    const r = { ...complete, ...modif };
    expect(peutEtreCloturee(r)).toBe(false);
    expect(conditionsManquantes(r).map((c) => c.cle)).toEqual(manquantes);
  });

  it("une réclamation déjà clôturée ne peut pas l'être à nouveau", () => {
    expect(peutEtreCloturee({ ...complete, clotureLe: new Date() })).toBe(false);
  });

  it("CM-2026-0041 : 5 éléments manquent", () => {
    const r: ReclamationPourCloture = {
      responsableId: "cheikh",
      causes: "Tournée du transporteur surchargée",
      reponseLe: null,
      clotureLe: null,
      actions: [
        { statut: "REALISEE", efficace: true },
        { statut: "EN_COURS", efficace: null },
      ],
      visas: [],
    };
    expect(texteManquants(conditionsManquantes(r).length)).toBe("5 éléments manquent pour clôturer");
  });
});

describe("conditions des visas", () => {
  const sansVisa = { ...complete, visas: [] };

  it("Direction Commerciale : seulement après la réponse au client", () => {
    expect(blocageVisa({ ...sansVisa, reponseLe: null }, "DIRECTION_COMMERCIALE")).toBe("La réponse au client doit d'abord être envoyée.");
    expect(blocageVisa(sansVisa, "DIRECTION_COMMERCIALE")).toBeNull();
  });

  it("QHSE : actions réalisées et évaluées, causes renseignées", () => {
    expect(blocageVisa({ ...sansVisa, actions: [{ statut: "REALISEE", efficace: null }] }, "QHSE")).toMatch(/évaluées/);
    expect(blocageVisa({ ...sansVisa, causes: "" }, "QHSE")).toMatch(/causes racines/);
    expect(blocageVisa(sansVisa, "QHSE")).toBeNull();
  });

  it("on ne vise pas deux fois", () => {
    expect(blocageVisa(complete, "QHSE")).toBe("Cette fiche est déjà visée.");
  });

  it("« À viser » : traitement terminé, réponse envoyée, un visa manquant", () => {
    expect(estAViser({ ...complete, visas: [{ type: "DIRECTION_COMMERCIALE" }] })).toBe(true);
    expect(estAViser(complete)).toBe(false);
    expect(estAViser({ ...sansVisa, reponseLe: null })).toBe(false);
  });
});

describe("frise des 6 étapes", () => {
  it("marque l'étape courante (CM-2026-0041 : Traitement)", () => {
    const etapes = etapesFiche({
      responsableId: "cheikh",
      causes: "x",
      reponseLe: null,
      clotureLe: null,
      actions: [{ statut: "EN_COURS", efficace: null }],
      visas: [],
    });
    expect(etapes.filter((e) => e.faite).map((e) => e.libelle)).toEqual(["Réception", "Qualification"]);
    expect(etapes.find((e) => e.courante)?.libelle).toBe("Traitement");
  });
});
