import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chargerActeur } from "@/server/droits/acteur";
import type { Acteur } from "@/server/droits/permissions";
import { lireFiltresTableauDeBord, tableauDeBord } from "@/server/requetes/tableau-de-bord";
import { creerSocieteDeTest, db, supprimerSociete } from "./base";

describe("tableau de bord (base réelle)", () => {
  const maintenant = new Date("2026-10-15T12:00:00Z");
  let societe: Awaited<ReturnType<typeof creerSocieteDeTest>>;
  let qhse: Acteur;
  let qhseId = "";

  beforeAll(async () => {
    societe = await creerSocieteDeTest();
    qhseId = (await db.user.create({ data: { email: `tdb-${Date.now()}@test.sn`, nom: "Qhse Tdb", role: "QHSE", toutesSocietes: true } })).id;
    qhse = (await chargerActeur(db, qhseId))!;
    const [a, b] = await Promise.all([
      db.activite.create({ data: { societeId: societe.id, code: "AAA", nom: "Test A", nomCourt: "A", description: "", icone: "", ordre: 1 } }),
      db.activite.create({ data: { societeId: societe.id, code: "BBB", nom: "Test B", nomCourt: "B", description: "", icone: "", ordre: 2 } }),
    ]);
    let n = 0;
    const rec = (activiteId: string, recueLe: string, extra: object = {}) =>
      db.reclamation.create({
        data: {
          numero: `${societe.code}-2026-${String(++n).padStart(4, "0")}`,
          societeId: societe.id,
          annee: 2026,
          sequence: n,
          activiteId,
          recueLe: new Date(recueLe),
          mode: "MAIL",
          origine: "Client particulier",
          profil: "PARTICULIER",
          clientNom: `Client ${n}`,
          telephone: "+221770000000",
          canauxReponse: ["SMS"],
          type: "SERVICE",
          description: "Description de test suffisante.",
          ...extra,
        },
      });
    // Clôturée en 4 jours, deux actions évaluées (1 efficace sur 2).
    await rec(a.id, "2026-09-01T09:00:00Z", {
      responsableId: qhseId,
      clotureLe: new Date("2026-09-05T10:00:00Z"),
      actions: {
        create: [
          { ordre: 1, libelle: "x", responsableId: qhseId, echeance: new Date("2026-09-03"), statut: "REALISEE", critere: "", efficace: true },
          { ordre: 2, libelle: "y", responsableId: qhseId, echeance: new Date("2026-09-03"), statut: "REALISEE", critere: "", efficace: false },
        ],
      },
    });
    // En retard (action échue non réalisée).
    await rec(a.id, "2026-10-01T09:00:00Z", {
      responsableId: qhseId,
      actions: { create: [{ ordre: 1, libelle: "z", responsableId: qhseId, echeance: new Date("2026-10-10"), statut: "EN_COURS", critere: "" }] },
    });
    // Nouvelle, produit, non affectée depuis plus de 24 h.
    await rec(b.id, "2026-10-13T08:00:00Z", { type: "PRODUIT", sousType: "PRIX" });
    // Hors période de 30 jours (mais dans les 12 mois).
    await rec(b.id, "2026-03-10T08:00:00Z", { responsableId: qhseId, clotureLe: new Date("2026-03-20T08:00:00Z") });
  });

  afterAll(async () => {
    await supprimerSociete(societe.id);
    await db.user.delete({ where: { id: qhseId } });
    await db.$disconnect();
  });

  it("12 derniers mois : indicateurs, courbe mensuelle, répartitions, priorités", async () => {
    const d = await tableauDeBord(qhse, societe.id, lireFiltresTableauDeBord({}), maintenant);
    expect(d.recues).toBe(4);
    expect(d.parStatut).toEqual({ NOUVELLE: 1, EN_COURS: 0, EN_RETARD: 1, TRAITEE: 2 });
    expect(d.delaiMoyen).toBe(7); // (4 + 10) / 2
    expect(d.efficacite).toEqual({ pourcentage: 50, evaluees: 2 });
    expect(d.courbe.points).toHaveLength(13);
    expect(d.courbe.points.at(-1)).toMatchObject({ libelle: "Oct. 26", nombre: 2 });
    expect(d.parActivite).toEqual([
      { code: "AAA", nom: "A", nombre: 2, enRetard: 1 },
      { code: "BBB", nom: "B", nombre: 2, enRetard: 0 },
    ]);
    expect(d.parType.find((t) => t.libelle === "Produit · prix")).toMatchObject({ nombre: 1, pourcentage: 25 });
    expect(d.priorites.map((p) => [p.statut, p.alerte?.startsWith("Non affectée") ?? false])).toEqual([
      ["EN_RETARD", false],
      ["NOUVELLE", true],
    ]);
  });

  it("30 derniers jours et filtre d'activité ; valeurs d'URL invalides ignorées", async () => {
    const d = await tableauDeBord(qhse, societe.id, lireFiltresTableauDeBord({ periode: "30", activite: "BBB" }), maintenant);
    expect(d.recues).toBe(1);
    expect(d.courbe.titre).toBe("Réclamations reçues par jour");
    expect(d.courbe.points).toHaveLength(30);
    expect(d.priorites).toHaveLength(1);
    expect(lireFiltresTableauDeBord({ periode: "999", activite: "<script>" })).toEqual({ periode: "365", activite: undefined });
  });
});
