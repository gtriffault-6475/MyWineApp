import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // Les tests d'intégration SQL partagent une même base : pas de fichiers en parallèle.
    fileParallelism: false,
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html", "json"],
      include: ["**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.ts",
        "**/*.config.ts",
        "migrations/**",
        "scripts/**",
        ".next/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
