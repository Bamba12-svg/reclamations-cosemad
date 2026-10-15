import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { expedier, preparerMessage } from "@/server/messagerie";
import { journaliser } from "@/server/journal";
import { creerSocieteDeTest, db, supprimerSociete } from "./base";

describe("messagerie (mode démo) et journal", () => {
  let societe: Awaited<ReturnType<typeof creerSocieteDeTest>>;

  beforeAll(async () => {
    delete process.env.MESSAGERIE_MODE; // démo par défaut
    societe = await creerSocieteDeTest();
  });
  afterAll(async () => {
    await db.journalAudit.deleteMany({ where: { societeId: societe.id } });
    await supprimerSociete(societe.id);
    await db.$disconnect();
  });

  it("en démo, le SMS est enregistré (statut DEMO) sans être envoyé", async () => {
    const m = await preparerMessage(db, {
      societeId: societe.id,
      canal: "SMS",
      destinataire: "+221774123508",
      objet: "ignoré pour un SMS",
      corps: "FLS : votre réclamation FLS-2026-0040 est bien reçue.",
    });
    expect(m).toMatchObject({ statut: "DEMO", fournisseur: "demo", objet: null });
    expect(m.envoyeLe).toBeInstanceOf(Date);
    await expedier(db, [m.id]); // sans effet en démo
    expect((await db.message.findUniqueOrThrow({ where: { id: m.id } })).statut).toBe("DEMO");
  });

  it("en production sans fournisseur, l'échec est enregistré sans faire échouer l'opération", async () => {
    process.env.MESSAGERIE_MODE = "production";
    try {
      const m = await preparerMessage(db, { societeId: societe.id, canal: "SMS", destinataire: "+221774123508", corps: "Test" });
      expect(m.statut).toBe("EN_ATTENTE");
      await expedier(db, [m.id]);
      const apres = await db.message.findUniqueOrThrow({ where: { id: m.id } });
      expect(apres).toMatchObject({ statut: "ECHEC", erreur: "Aucun fournisseur SMS n'est configuré." });
    } finally {
      delete process.env.MESSAGERIE_MODE;
    }
  });

  it("le journal est annulé avec l'opération qui échoue", async () => {
    await expect(
      db.$transaction(async (tx) => {
        await journaliser(tx, { action: "test.echec", entite: "Societe", entiteId: societe.id, societeId: societe.id });
        throw new Error("échec");
      }),
    ).rejects.toThrow();
    await journaliser(db, { action: "test.ok", entite: "Societe", entiteId: societe.id, societeId: societe.id, details: { essai: 1 } });
    const lignes = await db.journalAudit.findMany({ where: { societeId: societe.id } });
    expect(lignes.map((l) => l.action)).toEqual(["test.ok"]);
  });
});
