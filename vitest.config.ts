import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Order matters: `env.setup.ts` seeds safe dummy env vars before
    // `setup.ts` (which transitively imports `@/configs/env` and would
    // otherwise call `process.exit(1)` in CI environments without all
    // production secrets injected).
    setupFiles: ["./tests/env.setup.ts", "./tests/setup.ts"],
    include: ["tests/integration/*.ts", "tests/unit/*.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/dist/",
      ],
    },
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 30000,
    hookTimeout: 60000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
