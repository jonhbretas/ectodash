import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// .env.local is git-ignored and holds real project credentials. Load it here so
// this integration suite can run locally with `npm test` without extra setup.
// In CI (or any environment where the file is absent) this is a silent no-op —
// the suite falls back to real process env vars and skips if they are missing.
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not found — rely on real environment variables (e.g. CI secrets).
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(supabaseUrl && anonKey && serviceRoleKey);

// Skip condition: without SUPABASE_SERVICE_ROLE_KEY (and the other project
// credentials) this suite cannot reach the live hosted project. Skip visibly
// rather than failing so CI runs without secrets stay green.
describe.skipIf(!canRun)("profiles trigger (live Supabase project)", () => {
  let admin: SupabaseClient;
  let userId: string;
  const testEmail = `ectodash-test-${Date.now()}@example.invalid`;

  beforeAll(async () => {
    admin = createClient(supabaseUrl!, serviceRoleKey!);

    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      email_confirm: true,
    });

    if (error || !data.user) {
      throw new Error(`Failed to create test user: ${error?.message}`);
    }

    userId = data.user.id;
  });

  afterAll(async () => {
    // Belt-and-suspenders cleanup: the cascade test below already deletes the
    // account, but if an earlier assertion throws, this still removes it so no
    // disposable test account lingers in the hosted project.
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("writes exactly one public.profiles row when an account is created", async () => {
    const { data, error } = await admin
      .from("profiles")
      .select("id, email")
      .eq("id", userId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.email).toBe(testEmail);
  });

  it("denies anonymous reads of public.profiles via RLS", async () => {
    const anon = createClient(supabaseUrl!, anonKey!);

    const { data, error } = await anon.from("profiles").select("id");

    // Supabase returns an empty array (not an error) when RLS filters out
    // every row — assert on length, not on the error field.
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("cascades: deleting the account removes the public.profiles row", async () => {
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    expect(deleteError).toBeNull();

    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    // Account already deleted here — prevent afterAll from retrying.
    userId = "";
  });
});

if (!canRun) {
  describe("profiles trigger (live Supabase project)", () => {
    it.skip("SUPABASE_SERVICE_ROLE_KEY (or other required project env vars) not set — skipping live database integration tests", () => {
      // Intentionally empty: this test exists only to surface a visible skip
      // message when the hosted-project credentials are unavailable.
    });
  });
}
