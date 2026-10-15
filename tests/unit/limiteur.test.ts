import { describe, expect, it } from "vitest";
import { enregistrerTentative, estBloque, reinitialiser } from "@/server/limiteur";

describe("limitation des tentatives de connexion", () => {
  const limite = { maximum: 5, fenetreMs: 15 * 60_000 };

  it("bloque à la 6e tentative échouée en 15 minutes, puis libère", () => {
    const cle = "connexion:test@cosemad.sn";
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(estBloque(cle, limite, t0 + i).bloque).toBe(false);
      enregistrerTentative(cle, t0 + i);
    }
    expect(estBloque(cle, limite, t0 + 10)).toMatchObject({ bloque: true });
    expect(estBloque(cle, limite, t0 + 15 * 60_000 + 1).bloque).toBe(false);
  });

  it("une connexion réussie remet le compteur à zéro", () => {
    const cle = "connexion:autre@cosemad.sn";
    for (let i = 0; i < 5; i++) enregistrerTentative(cle, i);
    reinitialiser(cle);
    expect(estBloque(cle, limite, 10).bloque).toBe(false);
  });
});
