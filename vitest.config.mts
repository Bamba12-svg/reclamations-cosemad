import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // « server-only » interdit l'import côté navigateur ; en test on est déjà côté serveur.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["dotenv/config"],
    // Les tests d'intégration partagent la base : on les exécute l'un après l'autre.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
