import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chargerActeur } from "@/server/droits/acteur";
import type { Acteur } from "@/server/droits/permissions";
import { chargerFiche } from "@/server/fiche/lecture";
import {
  affecter,
  ajouterAction,
  ajouterPieces,
  cloturer,
  commenter,
  enregistrerCauses,
  marquerRecurrent,
  modifierAction,
  repondre,
  viser,
} from "@/server/fiche/operations";
import { contenuDemo } from "@/server/stockage/demo";
import { creerSocieteDeTest, db, supprimerSociete } from "./base";

/**
 * Parcours complet d'une fiche PR06 sur une base réelle : chaque règle de la procédure et chaque
 * droit sont revérifiés côté serveur, quelles que soient les données envoyées par le navigateur.
 */
describe("fiche réclamation : de la qualification à la clôture", () => {
  const ctx = { ip: "127.0.0.1", userAgent: "vitest" };
  const suffixe = Math.random().toString(36).slice(2, 8);
  let societe: Awaited<ReturnType<typeof creerSocieteDeTest>>;
  let dossier: string;
  let numero: string;
  const ids: Record<"qhse" | "dc" | "dg" | "chef" | "membre" | "intrus", string> = { qhse: "", dc: "", dg: "", chef: "", membre: "", intrus: "" };
  const acteurs = {} as Record<keyof typeof ids, Acteur>;

  beforeAll(async () => {
    dossier = await mkdtemp(join(tmpdir(), "cosemad-fiche-"));
    process.env.STOCKAGE_DOSSIER = dossier;
    process.env.MESSAGERIE_MODE = "demo";
    societe = await creerSocieteDeTest();

    const user = (cle: string, nom: string, role: "QHSE" | "DIRECTION_COMMERCIALE" | "DIRECTION_GENERALE" | "RESPONSABLE_TRAITEMENT", groupe: boolean) =>
      db.user.create({
        data: {
          email: `${cle}-${suffixe}@test.sn`,
          nom,
          role,
          toutesSocietes: groupe,
          acces: groupe ? undefined : { create: { societeId: societe.id } },
        },
      });
    ids.qhse = (await user("qhse", "Zz Qhse Test", "QHSE", true)).id;
    ids.dc = (await user("dc", "Zz Dc Test", "DIRECTION_COMMERCIALE", true)).id;
    ids.dg = (await user("dg", "Zz Dg Test", "DIRECTION_GENERALE", true)).id;
    ids.chef = (await user("chef", "Chef Activité", "RESPONSABLE_TRAITEMENT", false)).id;
    ids.membre = (await user("membre", "Membre Équipe", "RESPONSABLE_TRAITEMENT", false)).id;
    ids.intrus = (await user("intrus", "Autre Activité", "RESPONSABLE_TRAITEMENT", false)).id;

    const activite = await db.activite.create({
      data: {
        societeId: societe.id,
        code: "LIV",
        nom: "Test Livraison",
        nomCourt: "Livraison",
        description: "",
        icone: "",
        ordre: 1,
        responsableId: ids.chef,
        equipes: { create: { nom: "Livreurs", ordre: 1, membres: { create: { userId: ids.membre } } } },
      },
    });
    await db.activite.create({ data: { societeId: societe.id, code: "AUT", nom: "Test Autre", nomCourt: "Autre", description: "", icone: "", ordre: 2, responsableId: ids.intrus } });

    numero = `${societe.code}-2026-0001`;
    await db.reclamation.create({
      data: {
        numero,
        societeId: societe.id,
        annee: 2026,
        sequence: 1,
        activiteId: activite.id,
        recueLe: new Date("2026-10-01T09:00:00Z"),
        mode: "TELEPHONE",
        origine: "Client particulier",
        profil: "PARTICULIER",
        clientNom: "Awa Ndiaye",
        telephone: "+221774123508",
        email: "awa@test.sn",
        canauxReponse: ["SMS", "EMAIL"],
        type: "SERVICE",
        description: "Livraison arrivée avec trois jours de retard.",
      },
    });
    for (const cle of Object.keys(ids) as (keyof typeof ids)[]) acteurs[cle] = (await chargerActeur(db, ids[cle]))!;
  });

  afterAll(async () => {
    await db.journalAudit.deleteMany({ where: { OR: [{ societeId: societe.id }, { userId: { in: Object.values(ids) } }] } });
    await supprimerSociete(societe.id);
    await db.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
    await rm(dossier, { recursive: true, force: true });
    await db.$disconnect();
  });

  const fiche = (a: Acteur = acteurs.qhse) => chargerFiche(a, societe.id, numero);
  const historique = async () => (await fiche())!.historique.map((h) => h.libelle);

  it("hors périmètre : la fiche est invisible et toute modification refusée", async () => {
    expect(await fiche(acteurs.intrus)).toBeNull();
    const r = await commenter(acteurs.intrus, numero, { texte: "Je passe par là" }, ctx);
    expect(r).toEqual({ ok: false, erreur: "Réclamation introuvable ou hors de votre périmètre." });
  });

  it("qualification : refusée au membre d'équipe et à la DG, acceptée pour le responsable de l'activité", async () => {
    expect((await affecter(acteurs.membre, numero, ids.membre, ctx)).ok).toBe(false);
    expect((await affecter(acteurs.dg, numero, ids.membre, ctx)).ok).toBe(false);
    // Quelqu'un qui n'est ni de l'équipe ni du QHSE ne peut pas être désigné.
    expect(await affecter(acteurs.chef, numero, ids.dc, ctx)).toMatchObject({ ok: false, erreur: "Cette personne ne peut pas traiter les réclamations de cette activité." });
    expect(await affecter(acteurs.chef, numero, ids.membre, ctx)).toEqual({ ok: true, message: "Réclamation affectée à Membre Équipe" });
    expect(await historique()).toContain("Affectée à Membre Équipe (Test Livraison)");
    expect((await marquerRecurrent(acteurs.qhse, numero, true, ctx)).ok).toBe(true);
    expect((await fiche())!.statut).toBe("EN_COURS");
  });

  let actionId = "";
  it("actions : validation, échéance cohérente, statut par la personne chargée, efficacité après réalisation", async () => {
    const vide = await ajouterAction(acteurs.qhse, numero, { libelle: " ", responsableId: ids.membre, echeance: "2026-10-20", critere: "" }, ctx);
    expect(vide).toMatchObject({ ok: false, erreur: "Décrivez l'action à mener." });
    const avant = await ajouterAction(acteurs.qhse, numero, { libelle: "Relivrer", responsableId: ids.membre, echeance: "2026-09-01", critere: "" }, ctx);
    expect(avant).toMatchObject({ ok: false, erreur: "L'échéance ne peut pas précéder la réception de la réclamation." });

    const ok = await ajouterAction(acteurs.membre, numero, { libelle: "Relivrer", responsableId: ids.membre, echeance: "2026-10-05", critere: "Bon signé" }, ctx);
    expect(ok.ok).toBe(true); // responsable de la réclamation
    const v = (await fiche())!;
    actionId = v.actions[0]!.id;
    expect(v.statut).toBe("EN_RETARD"); // échéance passée, action non réalisée

    expect(await modifierAction(acteurs.membre, numero, actionId, { champ: "efficace", valeur: true }, ctx)).toMatchObject({
      ok: false,
      erreur: "L'efficacité s'évalue une fois l'action réalisée.",
    });
    expect(await modifierAction(acteurs.membre, numero, actionId, { champ: "statut", valeur: "REALISEE" }, ctx)).toEqual({ ok: true, message: "Action 1 marquée comme réalisée" });
    expect((await modifierAction(acteurs.qhse, numero, actionId, { champ: "efficace", valeur: true }, ctx)).ok).toBe(true);
    expect((await modifierAction(acteurs.dg, numero, actionId, { champ: "libelle", valeur: "Piratage" }, ctx)).ok).toBe(false);
    expect((await fiche())!.statut).toBe("EN_COURS");
    expect(await historique()).toEqual(expect.arrayContaining(["Action ajoutée : Relivrer", "Action 1 : réalisée", "Action 1 jugée efficace"]));
  });

  it("visas : la DC attend la réponse au client, le QHSE attend les causes racines", async () => {
    expect(await viser(acteurs.dc, numero, "DIRECTION_COMMERCIALE", ctx)).toMatchObject({ ok: false, erreur: "La réponse au client doit d'abord être envoyée." });
    expect(await viser(acteurs.qhse, numero, "QHSE", ctx)).toMatchObject({ ok: false });
    expect(await viser(acteurs.dc, numero, "QHSE", ctx)).toMatchObject({ ok: false, erreur: "Réservé au Service QHSE." });
  });

  it("réponse : 20 caractères minimum, messages enregistrés (démo), une seule fois", async () => {
    expect(await repondre(acteurs.membre, numero, { texte: "Trop court", canaux: ["SMS"] }, ctx)).toMatchObject({ ok: false });
    const r = await repondre(acteurs.membre, numero, { texte: "Bonjour, nous avons relivré votre commande ce matin.", canaux: ["SMS", "EMAIL"] }, ctx);
    expect(r).toEqual({ ok: true, message: "Réponse envoyée à Awa Ndiaye par SMS et e-mail" });
    const messages = await db.message.findMany({ where: { reclamation: { numero } }, orderBy: { canal: "asc" } });
    expect(messages.map((m) => [m.canal, m.statut, m.destinataire])).toEqual([
      ["SMS", "DEMO", "+221774123508"],
      ["EMAIL", "DEMO", "awa@test.sn"],
    ]);
    expect((await repondre(acteurs.membre, numero, { texte: "Une deuxième réponse au client", canaux: ["SMS"] }, ctx)).ok).toBe(false);
    expect((await fiche())!.reponse).toMatchObject({ canaux: "SMS et e-mail" });
  });

  it("clôture : refusée tant qu'il manque des éléments, puis réservée au QHSE", async () => {
    expect(await cloturer(acteurs.qhse, numero, ctx)).toEqual({ ok: false, erreur: "3 éléments manquent pour clôturer." });
    expect((await enregistrerCauses(acteurs.membre, numero, { causes: "Tournée surchargée en fin de mois." }, ctx)).ok).toBe(true);
    expect((await viser(acteurs.dc, numero, "DIRECTION_COMMERCIALE", ctx)).ok).toBe(true);
    expect(await viser(acteurs.dc, numero, "DIRECTION_COMMERCIALE", ctx)).toMatchObject({ ok: false }); // pas deux fois
    expect((await viser(acteurs.qhse, numero, "QHSE", ctx)).ok).toBe(true);
    expect((await fiche())!.manquantes).toBe(0);

    expect(await cloturer(acteurs.chef, numero, ctx)).toMatchObject({ ok: false, erreur: "Seul le Service QHSE clôture une réclamation." });
    expect(await cloturer(acteurs.qhse, numero, ctx)).toEqual({ ok: true, message: `Réclamation ${numero} clôturée` });
    const v = (await fiche())!;
    expect(v.statut).toBe("TRAITEE");
    expect(v.droits).toMatchObject({ traiter: false, repondre: false, cloturer: false, pieces: false, commenter: true });
  });

  it("après clôture : lecture seule, sauf les commentaires internes", async () => {
    expect(await modifierAction(acteurs.qhse, numero, actionId, { champ: "libelle", valeur: "Modifiée" }, ctx)).toMatchObject({
      ok: false,
      erreur: "La réclamation est clôturée : la fiche est en lecture seule.",
    });
    expect((await enregistrerCauses(acteurs.qhse, numero, { causes: "Autre" }, ctx)).ok).toBe(false);
    expect((await commenter(acteurs.dc, numero, { texte: "Bien traité." }, ctx)).ok).toBe(true);
    expect((await fiche())!.commentaires.map((c) => c.texte)).toEqual(["Bien traité."]);
  });

  it("journal d'audit : chaque opération est tracée avec son auteur", async () => {
    const lignes = await db.journalAudit.findMany({ where: { societeId: societe.id }, select: { action: true, userId: true } });
    const actions = new Set(lignes.map((l) => l.action));
    for (const a of ["reclamation.affecter", "reclamation.recurrent", "action.ajouter", "action.modifier", "reclamation.repondre", "reclamation.causes", "reclamation.viser", "reclamation.cloturer", "commentaire.ajouter"]) {
      expect(actions, a).toContain(a);
    }
    expect(lignes.every((l) => l.userId)).toBe(true);
  });
});

describe("pièces jointes de la fiche", () => {
  const ctx = { ip: null, userAgent: null };
  let societe: Awaited<ReturnType<typeof creerSocieteDeTest>>;
  let qhse: Acteur;
  let qhseId = "";
  let dossier: string;
  const numero = () => `${societe.code}-2026-0002`;

  beforeAll(async () => {
    dossier = await mkdtemp(join(tmpdir(), "cosemad-pieces-"));
    process.env.STOCKAGE_DOSSIER = dossier;
    societe = await creerSocieteDeTest();
    qhseId = (await db.user.create({ data: { email: `pj-${Date.now()}@test.sn`, nom: "Qhse Pièces", role: "QHSE", toutesSocietes: true } })).id;
    qhse = (await chargerActeur(db, qhseId))!;
    const activite = await db.activite.create({ data: { societeId: societe.id, code: "PJ", nom: "Test PJ", nomCourt: "PJ", description: "", icone: "", ordre: 1 } });
    await db.reclamation.create({
      data: {
        numero: numero(),
        societeId: societe.id,
        annee: 2026,
        sequence: 2,
        activiteId: activite.id,
        recueLe: new Date(),
        mode: "MAIL",
        origine: "Client particulier",
        profil: "PARTICULIER",
        clientNom: "Test",
        telephone: "+221770000000",
        canauxReponse: ["SMS"],
        type: "AUTRE",
        description: "Description suffisamment longue.",
      },
    });
  });

  afterAll(async () => {
    await db.journalAudit.deleteMany({ where: { OR: [{ societeId: societe.id }, { userId: qhseId }] } });
    await supprimerSociete(societe.id);
    await db.user.delete({ where: { id: qhseId } });
    await rm(dossier, { recursive: true, force: true });
    await db.$disconnect();
  });

  it("refuse un faux PDF, accepte un vrai et l'inscrit dans l'historique", async () => {
    const faux = await ajouterPieces(qhse, numero(), [{ nom: "facture.pdf", octets: new TextEncoder().encode("<html>pas un pdf</html>") }], ctx);
    expect(faux).toEqual({ ok: false, erreur: "Seuls les photos (JPG, PNG) et les PDF sont acceptés." });

    const pdf = contenuDemo("application/pdf", "bon.pdf");
    expect(await ajouterPieces(qhse, numero(), [{ nom: "../../bon de livraison.pdf", octets: pdf }], ctx)).toEqual({ ok: true, message: "Pièce jointe ajoutée" });
    const v = (await chargerFiche(qhse, societe.id, numero()))!;
    expect(v.pieces).toMatchObject([{ nom: "bon de livraison.pdf", ext: "PDF", image: false }]);
    expect(v.historique[0]?.libelle).toBe("Pièce jointe ajoutée : bon de livraison.pdf");
  });
});
