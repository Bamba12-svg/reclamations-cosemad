import { describe, expect, it } from "vitest";
import { alertesDelai, DELAIS_PAR_DEFAUT } from "@/server/domaine/delais";
import { ajouterJoursOuvres, joursOuvresEcoules } from "@/server/domaine/jours-ouvres";

describe("jours ouvrés", () => {
  it("ne compte ni le samedi ni le dimanche", () => {
    // vendredi 02/10/2026 → lundi 05/10/2026 : 1 jour ouvré écoulé
    expect(joursOuvresEcoules("2026-10-02", "2026-10-05")).toBe(1);
    expect(joursOuvresEcoules("2026-10-02", "2026-10-09")).toBe(5);
  });

  it("exclut les jours fériés saisis", () => {
    // jeudi 31/12/2026 → lundi 04/01/2027, avec le 1er janvier férié : seul le lundi compte
    expect(joursOuvresEcoules("2026-12-31", "2027-01-04", new Set(["2027-01-01"]))).toBe(1);
  });

  it("calcule une date limite en jours ouvrés", () => {
    expect(ajouterJoursOuvres("2026-10-02", 5)).toBe("2026-10-09");
  });
});

describe("alertes de délai (cibles 24 h / 5 j ouvrés / 15 j)", () => {
  const maintenant = new Date("2026-10-02T10:00:00Z");

  it("non affectée depuis plus de 24 h (CM-2026-0047 : reçue le 30/09 à 19:30)", () => {
    const a = alertesDelai({ recueLe: new Date("2026-09-30T19:30:00Z"), responsableId: null, reponseLe: null, clotureLe: null }, DELAIS_PAR_DEFAUT, maintenant);
    expect(a).toEqual([{ type: "QUALIFICATION", message: "Non affectée depuis 38 h (cible 24 h)" }]);
  });

  it("sans réponse depuis plus de 5 jours ouvrés (CM-2026-0041 : reçue le 22/09)", () => {
    const a = alertesDelai({ recueLe: new Date("2026-09-22T08:31:00Z"), responsableId: "u", reponseLe: null, clotureLe: null }, DELAIS_PAR_DEFAUT, maintenant);
    expect(a.map((x) => x.message)).toEqual(["Sans réponse depuis 8 j ouvrés (cible 5)"]);
  });

  it("ouverte depuis plus de 15 jours", () => {
    const a = alertesDelai({ recueLe: new Date("2026-09-15T12:20:00Z"), responsableId: "u", reponseLe: new Date(), clotureLe: null }, DELAIS_PAR_DEFAUT, maintenant);
    expect(a.map((x) => x.type)).toEqual(["CLOTURE"]);
  });

  it("aucune alerte sur une réclamation clôturée", () => {
    const a = alertesDelai({ recueLe: new Date("2026-01-01T08:00:00Z"), responsableId: null, reponseLe: null, clotureLe: new Date() }, DELAIS_PAR_DEFAUT, maintenant);
    expect(a).toEqual([]);
  });
});
