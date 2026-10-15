import { describe, expect, it } from "vitest";
import type { Role } from "@/generated/prisma/enums";
import {
  AccesRefuse,
  aLaPermission,
  exigerSurReclamation,
  filtreVisibilite,
  peutAjouterPiece,
  peutCloturer,
  peutCommenter,
  peutModifierAction,
  peutQualifier,
  peutRepondre,
  peutTraiter,
  peutViser,
  peutVoir,
  type Acteur,
  type Permission,
} from "@/server/droits/permissions";

const CM = "soc-cm";
const SON = "soc-son";
const OXY = "act-oxy";
const DIA = "act-dia";

const groupe = (role: Role): Acteur => ({ id: role, nom: role, role, toutesSocietes: true, societeIds: [], activiteIds: [], activitesDirigeesIds: [] });
const cheikhSy: Acteur = { id: "cheikh", nom: "Cheikh Sy", role: "RESPONSABLE_TRAITEMENT", toutesSocietes: false, societeIds: [CM], activiteIds: [OXY], activitesDirigeesIds: [OXY] };
const lamineDiop: Acteur = { id: "lamine", nom: "Lamine Diop", role: "RESPONSABLE_TRAITEMENT", toutesSocietes: false, societeIds: [CM], activiteIds: [OXY], activitesDirigeesIds: [] };

const recOxy = { societeId: CM, activiteId: OXY, responsableId: "cheikh", clotureLe: null, actions: [{ responsableId: "lamine" }] };
const recDialyse = { societeId: CM, activiteId: DIA, responsableId: "aida", clotureLe: null, actions: [] };
const recSonerco = { ...recOxy, societeId: SON, activiteId: "act-enr" };

describe("matrice rôle × opération", () => {
  const cas: [Role, Permission, boolean][] = [
    ["QHSE", "parametres.gerer", true],
    ["QHSE", "reclamation.cloturer", true],
    ["DIRECTION_COMMERCIALE", "reclamation.viser.dc", true],
    ["DIRECTION_COMMERCIALE", "reclamation.viser.qhse", false],
    ["DIRECTION_COMMERCIALE", "reclamation.cloturer", false],
    ["AGENT_ACCUEIL", "reclamation.creer", true],
    ["AGENT_ACCUEIL", "reclamation.traiter", false],
    ["RESPONSABLE_TRAITEMENT", "reclamation.traiter", true],
    ["RESPONSABLE_TRAITEMENT", "reclamation.repondre", true],
    ["RESPONSABLE_TRAITEMENT", "reclamation.qualifier", false],
    ["RESPONSABLE_TRAITEMENT", "parametres.gerer", false],
    ["DIRECTION_GENERALE", "reclamation.lire", true],
    ["DIRECTION_GENERALE", "commentaire.ajouter", false],
    ["DIRECTION_GENERALE", "reclamation.traiter", false],
  ];
  it.each(cas)("%s / %s → %s", (role, permission, attendu) => {
    expect(aLaPermission({ role }, permission)).toBe(attendu);
  });

  it("seul le QHSE peut clôturer (décision validée)", () => {
    const roles: Role[] = ["QHSE", "DIRECTION_COMMERCIALE", "AGENT_ACCUEIL", "RESPONSABLE_TRAITEMENT", "DIRECTION_GENERALE"];
    expect(roles.filter((role) => aLaPermission({ role }, "reclamation.cloturer"))).toEqual(["QHSE"]);
  });
});

describe("périmètre", () => {
  it("les rôles du groupe voient les 3 sociétés", () => {
    for (const role of ["QHSE", "DIRECTION_COMMERCIALE", "AGENT_ACCUEIL", "DIRECTION_GENERALE"] as const) {
      expect(peutVoir(groupe(role), recSonerco)).toBe(true);
    }
  });

  it("un responsable ne voit que sa société et ses activités", () => {
    expect(peutVoir(cheikhSy, recOxy)).toBe(true);
    expect(peutVoir(cheikhSy, recDialyse)).toBe(false);
    expect(peutVoir(cheikhSy, recSonerco)).toBe(false);
  });

  it("…mais voit une réclamation d'une autre activité s'il y a une action", () => {
    expect(peutVoir(cheikhSy, { ...recDialyse, actions: [{ responsableId: "cheikh" }] })).toBe(true);
  });

  it("filtreVisibilite ne renvoie rien hors périmètre", () => {
    expect(filtreVisibilite(cheikhSy, SON)).toEqual({ id: { in: [] } });
    expect(filtreVisibilite(groupe("QHSE"), SON)).toEqual({ societeId: SON });
  });
});

describe("contrôles sur une réclamation", () => {
  it("refuse la modification d'une fiche clôturée", () => {
    expect(() => exigerSurReclamation(groupe("QHSE"), { ...recOxy, clotureLe: new Date() }, "reclamation.traiter")).toThrow(AccesRefuse);
  });

  it("autorise un commentaire sur une fiche clôturée", () => {
    expect(() => exigerSurReclamation(groupe("QHSE"), { ...recOxy, clotureLe: new Date() }, "commentaire.ajouter")).not.toThrow();
  });

  it("la Direction générale ne peut rien modifier", () => {
    expect(() => exigerSurReclamation(groupe("DIRECTION_GENERALE"), recOxy, "commentaire.ajouter")).toThrow(AccesRefuse);
  });

  it("le membre d'équipe ne peut changer que le statut de SON action", () => {
    expect(peutModifierAction(lamineDiop, recOxy, { responsableId: "lamine" }, "statut")).toBe(true);
    expect(peutModifierAction(lamineDiop, recOxy, { responsableId: "lamine" }, "tout")).toBe(false);
    expect(peutModifierAction(lamineDiop, recOxy, { responsableId: "cheikh" }, "statut")).toBe(false);
    expect(peutModifierAction(cheikhSy, recOxy, { responsableId: "lamine" }, "tout")).toBe(true);
  });
});

describe("fiche : qui peut faire quoi", () => {
  const cloturee = { ...recOxy, clotureLe: new Date("2026-10-10") };

  it("qualifier : QHSE et responsable de l'activité, pas un membre d'équipe ni la DC", () => {
    expect(peutQualifier(groupe("QHSE"), recOxy)).toBe(true);
    expect(peutQualifier(cheikhSy, recOxy)).toBe(true);
    expect(peutQualifier(lamineDiop, recOxy)).toBe(false);
    expect(peutQualifier(groupe("DIRECTION_COMMERCIALE"), recOxy)).toBe(false);
    expect(peutQualifier(groupe("QHSE"), cloturee)).toBe(false);
  });

  it("traiter et répondre : QHSE, responsable de la réclamation ou de l'activité", () => {
    const aida: Acteur = { ...lamineDiop, id: "aida", activiteIds: [DIA] };
    expect(peutTraiter(groupe("QHSE"), recOxy)).toBe(true);
    expect(peutTraiter(cheikhSy, recOxy)).toBe(true);
    expect(peutTraiter(aida, recDialyse)).toBe(true); // responsable de la réclamation
    expect(peutTraiter(lamineDiop, recOxy)).toBe(false); // ne gère que ses propres actions
    expect(peutRepondre(groupe("AGENT_ACCUEIL"), recOxy)).toBe(false);
    expect(peutRepondre(groupe("DIRECTION_GENERALE"), recOxy)).toBe(false);
    expect(peutTraiter(cheikhSy, cloturee)).toBe(false);
  });

  it("visas : chacun le sien ; clôture : QHSE seulement", () => {
    expect(peutViser(groupe("DIRECTION_COMMERCIALE"), recOxy, "DIRECTION_COMMERCIALE")).toBe(true);
    expect(peutViser(groupe("DIRECTION_COMMERCIALE"), recOxy, "QHSE")).toBe(false);
    expect(peutViser(groupe("QHSE"), recOxy, "QHSE")).toBe(true);
    expect(peutViser(groupe("QHSE"), recOxy, "DIRECTION_COMMERCIALE")).toBe(false);
    expect(peutCloturer(groupe("QHSE"), recOxy)).toBe(true);
    expect(peutCloturer(cheikhSy, recOxy)).toBe(false);
    expect(peutCloturer(groupe("DIRECTION_GENERALE"), recOxy)).toBe(false);
  });

  it("direction générale : lecture seule", () => {
    const dg = groupe("DIRECTION_GENERALE");
    expect([peutQualifier, peutTraiter, peutRepondre, peutAjouterPiece, peutCommenter, peutCloturer].map((f) => f(dg, recOxy))).toEqual([false, false, false, false, false, false]);
  });

  it("commentaires encore possibles après clôture, pièces jointes non", () => {
    expect(peutCommenter(groupe("QHSE"), cloturee)).toBe(true);
    expect(peutAjouterPiece(groupe("QHSE"), cloturee)).toBe(false);
  });

  it("hors périmètre : rien", () => {
    expect(peutCommenter(cheikhSy, recSonerco)).toBe(false);
    expect(peutTraiter(cheikhSy, recSonerco)).toBe(false);
  });
});
