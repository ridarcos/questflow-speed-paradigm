import { defineConfig } from "vitest/config";

// Tests de firestore.rules: requieren el emulador (npm run test:rules).
// No forman parte de `npm run test` (vitest.config.mts solo incluye src/).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/rules/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
