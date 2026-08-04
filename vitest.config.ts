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
    include: ["tests/**/*.test.ts"],
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
  },
});
