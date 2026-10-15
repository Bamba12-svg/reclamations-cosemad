import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schemaDepotPortail } from "@/lib/validation/portail";
import { deposerReclamation, suivreReclamation } from "@/server/portail";
import { lireContenu } from "@/server/stockage";
import { contenuDemo } from "@/server/stockage/demo";
import { creerSocieteDeTest, db, supprimerSociete } from "./base";

describe("portail : dépôt puis suivi (base réelle)", () => {
  let societe: Awaited<ReturnType<typeof creerSocieteDeTest>>;
  let dossier: string;

  beforeAll(async () => {
    dossier = await mkdtemp(join(tmpdir(), "cosemad-stockage-"));
    process.env.STOCKAGE_DOSSIER = dossier;
    delete process.env.MESSAGERIE_MODE;
    societe = await creerSocieteDeTest();
    await db.parametresSociete.create({
      data: {
        societeId: societe.id,
        modeleSms: "Test : votre réclamation {numero} est bien reçue. Réponse sous {delai} jours ouvrés.",
        modeleEmailObjet: "Réclamation {numero}",
        modeleEmail: "Bonjour {nom}, réclamation {numero} du {date}.",
      },
    });
    await db.activite.create({ data: { societeId: societe.id, code: "LOG", nom: "Test Livraison", nomCourt: "Livraison", description: "", icone: "", ordre: 1 } });
  });

  afterAll(async () => {
    await db.journalAudit.deleteMany({ where: { societeId: societe.id } });
    await supprimerSociete(societe.id);
    await rm(dossier, { recursive: true, force: true });
    await db.$disconnect();
  });

  const depot = (surcharge: object = {}) =>
    schemaDepotPortail.parse({
      societe: societe.slug,
      profil: "SOCIETE",
      nom: "Grossiste Test",
      secteur: "Autre",
      secteurAutre: "Transport",
      contactNom: "Awa Ndiaye",
      telephone: "77 412 35 08",
      email: "awa@test.sn",
      canaux: ["SMS", "EMAIL"],
      activiteCode: "LOG",
      type: "SERVICE",
      description: "Commande livrée incomplète : 6 cartons manquants.",
      premiereFois: false,
      consentement: true,
      ...surcharge,
    });

  it("enregistre la réclamation, sa pièce jointe, l'historique, les messages et le journal", async () => {
    const png = contenuDemo("image/png", "x.png");
    const r = await deposerReclamation(depot(), [{ nom: "photo cartons.jpg", octets: png }], { ip: "10.0.0.1", userAgent: "test" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.numero).toMatch(new RegExp(`^${societe.code}-\\d{4}-0001$`));
    expect(r.messages?.sms).toContain(r.numero);
    expect(r.messages?.email).toBe(`Bonjour Awa Ndiaye, réclamation ${r.numero} du ${new Date().toISOString().slice(8, 10)}/${new Date().toISOString().slice(5, 7)}/${new Date().getUTCFullYear()}.`);

    const enBase = await db.reclamation.findUniqueOrThrow({
      where: { numero: r.numero },
      include: { pieces: true, historique: { orderBy: { survenuLe: "asc" } }, messages: true },
    });
    expect(enBase).toMatchObject({
      mode: "PLATEFORME_WEB",
      origine: "Société · Transport",
      telephone: "+221774123508",
      recurrent: true, // « Non, c'est déjà arrivé »
      premiereFois: false,
      saisieParId: null,
      responsableId: null,
    });
    expect(enBase.consentementLe).toBeInstanceOf(Date);
    expect(enBase.pieces).toHaveLength(1);
    expect(enBase.pieces[0]).toMatchObject({ source: "CLIENT", nomOriginal: "photo cartons.png", typeMime: "image/png" });
    expect(await lireContenu(enBase.pieces[0]!)).toEqual(png);
    expect(enBase.historique.map((h) => h.libelle)).toEqual(["Réclamation enregistrée (Plateforme web)", "Confirmation envoyée au client (SMS + e-mail)"]);
    expect(enBase.messages.map((m) => `${m.canal}:${m.statut}`).sort()).toEqual(["EMAIL:DEMO", "SMS:DEMO"]);
    expect(await db.journalAudit.count({ where: { entiteId: enBase.id, action: "reclamation.deposer" } })).toBe(1);
  });

  it("refuse un faux fichier sans rien enregistrer", async () => {
    const avant = await db.reclamation.count({ where: { societeId: societe.id } });
    const r = await deposerReclamation(depot(), [{ nom: "facture.pdf", octets: new TextEncoder().encode("<html>") }], { ip: null, userAgent: null });
    expect(r).toMatchObject({ ok: false, erreur: "Seuls les photos (JPG, PNG) et les PDF sont acceptés." });
    expect(await db.reclamation.count({ where: { societeId: societe.id } })).toBe(avant);
  });

  it("le suivi exige le bon téléphone et ne montre jamais l'interne", async () => {
    const r = await deposerReclamation(depot({ profil: "PARTICULIER", nom: "Moussa Faye", email: "", canaux: ["SMS"] }), [], { ip: null, userAgent: null });
    if (!r.ok) throw new Error(r.erreur);

    expect(await suivreReclamation(r.numero, "+221770000000")).toBeNull();

    // On met une action en retard : le client ne doit pas le voir.
    const rec = await db.reclamation.findUniqueOrThrow({ where: { numero: r.numero } });
    const resp = await db.user.create({ data: { nom: "Resp Test", email: `resp-${Date.now()}@test.sn`, role: "RESPONSABLE_TRAITEMENT" } });
    await db.reclamation.update({
      where: { id: rec.id },
      data: {
        responsableId: resp.id,
        affecteeLe: new Date(),
        actions: { create: { ordre: 1, libelle: "Action interne", responsableId: resp.id, echeance: new Date("2020-01-01"), critere: "x" } },
        commentaires: { create: { auteurId: resp.id, texte: "Commentaire interne" } },
      },
    });

    const suivi = await suivreReclamation(r.numero, "+221774123508");
    expect(suivi?.etapes.map((e) => [e.libelle, e.faite])).toEqual([
      ["Reçue", true],
      ["En cours d'analyse", true],
      ["Réponse envoyée", false],
      ["Clôturée", false],
    ]);
    const texte = JSON.stringify(suivi);
    expect(texte).not.toMatch(/retard|Action interne|Commentaire interne|Resp Test/i);

    await db.action.deleteMany({ where: { reclamationId: rec.id } });
    await db.commentaire.deleteMany({ where: { reclamationId: rec.id } });
    await db.reclamation.update({ where: { id: rec.id }, data: { responsableId: null } });
    await db.user.delete({ where: { id: resp.id } });
  });
});
