import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chargerActeur } from "@/server/droits/acteur";
import type { Acteur } from "@/server/droits/permissions";
import { modifierAction, repondre, ajouterAction, enregistrerCauses, viser } from "@/server/fiche/operations";
import { fichesAViser, mesActions } from "@/server/requetes/listes";
import { saisirReclamation } from "@/server/saisie";
import { contenuDemo } from "@/server/stockage/demo";
import { creerSocieteDeTest, db, supprimerSociete } from "./base";

describe("saisie à l'accueil, « Mes actions » et « À viser »", () => {
  const ctx = { ip: null, userAgent: "vitest" };
  const suffixe = Math.random().toString(36).slice(2, 8);
  let societe: Awaited<ReturnType<typeof creerSocieteDeTest>>;
  let dossier: string;
  let activiteId = "";
  const ids = { accueil: "", qhse: "", dc: "", chef: "" };
  const a = {} as Record<keyof typeof ids, Acteur>;
  const maintenant = new Date("2026-10-15T10:00:00Z");

  const saisie = (surcharge: object = {}) => ({
    mode: "TELEPHONE",
    origine: "Société · Santé",
    dateReception: "2026-10-15",
    heureReception: "09:12",
    responsableId: ids.chef,
    nom: "Clinique Test",
    telephone: "33 820 14 60",
    email: "contact@clinique.sn",
    activiteId,
    type: "PRODUIT",
    sousType: "QUALITE",
    description: "Bouteilles livrées avec un manomètre défectueux.",
    ...surcharge,
  });

  beforeAll(async () => {
    dossier = await mkdtemp(join(tmpdir(), "cosemad-saisie-"));
    process.env.STOCKAGE_DOSSIER = dossier;
    process.env.MESSAGERIE_MODE = "demo";
    societe = await creerSocieteDeTest();
    await db.parametresSociete.create({
      data: {
        societeId: societe.id,
        delaiReponseJO: 5,
        modeleSms: "Votre reclamation {numero} du {date} est enregistree. Reponse sous {delai} jours ouvres.",
        modeleEmailObjet: "Réclamation {numero}",
        modeleEmail: "Bonjour {nom}, votre réclamation {numero} est enregistrée.",
      },
    });
    const u = (cle: string, role: "AGENT_ACCUEIL" | "QHSE" | "DIRECTION_COMMERCIALE" | "RESPONSABLE_TRAITEMENT", groupe = true) =>
      db.user.create({ data: { email: `${cle}-${suffixe}@test.sn`, nom: `Test ${cle}`, role, toutesSocietes: groupe, acces: groupe ? undefined : { create: { societeId: societe.id } } } });
    ids.accueil = (await u("accueil", "AGENT_ACCUEIL")).id;
    ids.qhse = (await u("qhse", "QHSE")).id;
    ids.dc = (await u("dc", "DIRECTION_COMMERCIALE")).id;
    ids.chef = (await u("chef", "RESPONSABLE_TRAITEMENT", false)).id;
    activiteId = (await db.activite.create({ data: { societeId: societe.id, code: "OXY", nom: "Test Oxygène", nomCourt: "Oxygène", description: "", icone: "", ordre: 1, responsableId: ids.chef } })).id;
    for (const k of Object.keys(ids) as (keyof typeof ids)[]) a[k] = (await chargerActeur(db, ids[k]))!;
  });

  afterAll(async () => {
    await db.journalAudit.deleteMany({ where: { OR: [{ societeId: societe.id }, { userId: { in: Object.values(ids) } }] } });
    await supprimerSociete(societe.id);
    await db.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
    await rm(dossier, { recursive: true, force: true });
    await db.$disconnect();
  });

  it("refuse la saisie à un responsable de traitement", async () => {
    expect(await saisirReclamation(a.chef, societe.id, saisie(), [], ctx, maintenant)).toEqual({
      ok: false,
      erreur: "La saisie des réclamations est réservée à l'accueil et au Service QHSE.",
    });
  });

  it("renvoie les erreurs de la maquette, champ par champ", async () => {
    const r = await saisirReclamation(a.accueil, societe.id, saisie({ nom: "", telephone: "77 12", description: "court", type: "PRODUIT", sousType: null, heureReception: "" }), [], ctx, maintenant);
    expect(r).toMatchObject({
      ok: false,
      erreur: "Le formulaire contient 5 erreurs à corriger",
      champs: {
        nom: "Indiquez le nom du client ou de la société.",
        description: "Décrivez le problème en au moins 15 caractères.",
        type: "Précisez qualité, prix ou fonctionnalité.",
        date: "Indiquez la date et l’heure réelles de réception.",
      },
    });
    const futur = await saisirReclamation(a.accueil, societe.id, saisie({ dateReception: "2026-10-16" }), [], ctx, maintenant);
    expect(futur).toMatchObject({ ok: false, champs: { date: "La date de réception ne peut pas être dans le futur." } });
  });

  let numero = "";
  it("enregistre la réclamation : numéro, affectation, pièces, SMS et e-mail, historique, journal", async () => {
    const r = await saisirReclamation(a.accueil, societe.id, saisie(), [{ nom: "bon.pdf", octets: contenuDemo("application/pdf", "bon.pdf") }], ctx, maintenant);
    expect(r).toEqual({ ok: true, numero: `${societe.code}-2026-0001` });
    numero = `${societe.code}-2026-0001`;
    const rec = await db.reclamation.findUniqueOrThrow({
      where: { numero },
      include: { pieces: true, messages: { orderBy: { canal: "asc" } }, historique: { orderBy: { survenuLe: "asc" } } },
    });
    expect(rec).toMatchObject({
      recueLe: new Date("2026-10-15T09:12:00Z"),
      profil: "SOCIETE",
      secteur: "Santé",
      telephone: "+221338201460",
      saisieParId: ids.accueil,
      responsableId: ids.chef,
      canauxReponse: ["SMS", "EMAIL"],
      sousType: "QUALITE",
    });
    expect(rec.pieces).toHaveLength(1);
    expect(rec.messages.map((m) => [m.canal, m.statut, m.corps])).toEqual([
      ["SMS", "DEMO", `Votre reclamation ${numero} du 15/10/2026 est enregistree. Reponse sous 5 jours ouvres.`],
      ["EMAIL", "DEMO", `Bonjour Clinique Test, votre réclamation ${numero} est enregistrée.`],
    ]);
    expect(rec.historique.map((h) => h.libelle)).toEqual([
      "Réclamation enregistrée (Téléphone)",
      "Confirmation envoyée au client (SMS + e-mail)",
      "Affectée à Test chef (Test Oxygène)",
    ]);
    expect(await db.journalAudit.count({ where: { action: "reclamation.saisir", entiteId: rec.id, userId: ids.accueil } })).toBe(1);
  });

  it("« Mes actions » liste les actions non réalisées par échéance ; « À viser » suit la règle de la procédure", async () => {
    await ajouterAction(a.chef, numero, { libelle: "Remplacer le manomètre", responsableId: ids.chef, echeance: "2026-10-20", critere: "Test pression OK" }, ctx);
    await ajouterAction(a.chef, numero, { libelle: "Contrôler le stock", responsableId: ids.chef, echeance: "2026-10-16", critere: "" }, ctx);
    const liste = await mesActions(a.chef, societe.id, maintenant);
    expect(liste.map((x) => [x.libelle, x.ecart])).toEqual([
      ["Contrôler le stock", 1],
      ["Remplacer le manomètre", 5],
    ]);
    expect(await fichesAViser(a.qhse, societe.id, maintenant)).toEqual([]);

    for (const x of liste) await modifierAction(a.chef, numero, x.id, { champ: "statut", valeur: "REALISEE" }, ctx);
    expect(await mesActions(a.chef, societe.id, maintenant)).toEqual([]);
    await repondre(a.chef, numero, { texte: "Le manomètre a été remplacé ce matin.", canaux: ["SMS"] }, ctx);
    expect(await fichesAViser(a.qhse, societe.id, maintenant)).toMatchObject([{ numero, viseeDC: false, viseeQHSE: false }]);

    await viser(a.dc, numero, "DIRECTION_COMMERCIALE", ctx);
    for (const x of liste) await modifierAction(a.chef, numero, x.id, { champ: "efficace", valeur: true }, ctx);
    await enregistrerCauses(a.chef, numero, { causes: "Contrôle à la réception absent." }, ctx);
    await viser(a.qhse, numero, "QHSE", ctx);
    expect(await fichesAViser(a.qhse, societe.id, maintenant)).toEqual([]);
  });
});
