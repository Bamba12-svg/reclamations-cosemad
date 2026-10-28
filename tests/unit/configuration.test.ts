import { afterEach, describe, expect, it, vi } from "vitest";
import { register } from "@/instrumentation";

describe("garde-fous de configuration au démarrage", () => {
  const sauvegarde = { ...process.env };
  afterEach(() => {
    process.env = { ...sauvegarde };
    vi.restoreAllMocks();
  });
  const enLigne = (env: Record<string, string | undefined>) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // Valeurs neutres d'abord : le test ne doit pas dépendre de la console qui le lance (ex. set DEMO_EN_LIGNE=1).
    const neutre = { DEMO_EN_LIGNE: undefined, MESSAGERIE_MODE: undefined };
    process.env = { ...sauvegarde, ...neutre, NEXT_RUNTIME: "nodejs", NODE_ENV: "production", DATABASE_URL: "postgresql://x", AUTH_SECRET: "x".repeat(32), MODE_DEMO: "0", ...env };
  };

  it("démarre avec une configuration de production correcte", () => {
    enLigne({ MESSAGERIE_MODE: "production" });
    expect(() => register()).not.toThrow();
  });

  it("refuse le mode démo en production, sauf démonstration publique déclarée", () => {
    enLigne({ MODE_DEMO: "1" });
    expect(() => register()).toThrow(/MODE_DEMO=1 en production/);
    enLigne({ MODE_DEMO: "1", DEMO_EN_LIGNE: "1" });
    expect(() => register()).not.toThrow();
  });

  it("refuse une clé de session absente ou trop courte", () => {
    enLigne({ AUTH_SECRET: "court" });
    expect(() => register()).toThrow(/AUTH_SECRET/);
  });
});
