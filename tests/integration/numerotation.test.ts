import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prochainNumero, prochaineSequence } from "@/server/domaine/numerotation";
import { creerSocieteDeTest, db, supprimerSociete } from "./base";

describe("numérotation sans doublon ni trou (base réelle)", () => {
  let societe: Awaited<ReturnType<typeof creerSocieteDeTest>>;

  beforeAll(async () => {
    societe = await creerSocieteDeTest();
  });
  afterAll(async () => {
    await supprimerSociete(societe.id);
    await db.$disconnect();
  });

  it("50 dépôts simultanés obtiennent 50 numéros distincts et consécutifs", async () => {
    const sequences = await Promise.all(Array.from({ length: 50 }, () => prochaineSequence(db, societe.id, 2026)));
    expect([...sequences].sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });

  it("une transaction annulée ne consomme pas de numéro", async () => {
    await expect(
      db.$transaction(async (tx) => {
        await prochaineSequence(tx, societe.id, 2026);
        throw new Error("échec simulé après attribution du numéro");
      }),
    ).rejects.toThrow("échec simulé");
    const { numero } = await prochainNumero(db, societe, 2026);
    expect(numero).toBe(`${societe.code}-2026-0051`);
  });

  it("le compteur repart à 1 chaque année", async () => {
    const { numero } = await prochainNumero(db, societe, 2027);
    expect(numero).toBe(`${societe.code}-2027-0001`);
  });
});
