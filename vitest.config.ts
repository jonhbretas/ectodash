import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // src/**/*.test.ts (added 05-02): pure-unit tests colocated with the
    // module they validate (demanda-filter-schema.test.ts) — no live
    // database, safe to run in parallel with the tests/db/*.test.ts
    // live-integration suites below. src/**/*.test.tsx (added 08-02):
    // same colocation convention, extended to component tests that render
    // JSX (suggestion-review-list.test.tsx).
    include: [
      "tests/**/*.test.ts",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
    ],
    testTimeout: 30000,
    // tests/db/*.test.ts are live-integration suites that mint and sign in
    // many disposable @example.invalid fixture accounts against the real
    // hosted Supabase project. Running multiple such files in parallel (the
    // default) can burst past Supabase Auth's free-tier sign-in rate limit,
    // producing "Request rate limit reached" failures that are a test-
    // execution-scheduling artifact, not a real RLS/schema regression
    // (confirmed live during Phase 5's 05-01 migration: the same suite
    // passes cleanly file-by-file). Disabling file parallelism trades a
    // few extra seconds of total run time for a suite that doesn't flake
    // on this specific free-tier limit.
    fileParallelism: false,
    // Component tests (suggestion-review-list.test.tsx, added 08-02) need a
    // DOM to render into. Vitest 4 removed the old environmentMatchGlobs
    // option — per-file environment overrides now use the
    // `// @vitest-environment jsdom` docblock at the top of the test file
    // itself (see suggestion-review-list.test.tsx), so every existing
    // *.test.ts suite here keeps running under the faster, already-proven
    // "node" environment unchanged.
    //
    // setupFiles runs for every test file regardless of environment, but
    // setup-dom.ts's own polyfills are guarded (`typeof Element !==
    // "undefined"`) so they're inert no-ops under the "node" environment.
    setupFiles: ["./tests/setup-dom.ts"],
    // Runs once per `npm test` invocation, before any suite (even under
    // file filters). Removes junk left in the live project by crashed
    // test runs (fixture accounts, "Novo Cadastro" volunteers and rows
    // they created) via public.limpar_dados_teste() (migration 0062).
    globalSetup: ["./tests/db/global-cleanup.ts"],
  },
});
