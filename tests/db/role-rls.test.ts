import { afterAll, describe, expect, it } from "vitest";
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

type AppRole =
  | "coordenador_geral"
  | "lider_area"
  | "voluntario_comum"
  | "financeiro";

// Skip condition: without SUPABASE_SERVICE_ROLE_KEY (and the other project
// credentials) this suite cannot reach the live hosted project. Skip visibly
// rather than failing so CI runs without secrets stay green.
describe.skipIf(!canRun)(
  "profiles.role RLS enforcement (live Supabase project)",
  () => {
    let admin: SupabaseClient;
    const createdUserIds: string[] = [];
    let fixtureCounter = 0;

    admin = createClient(supabaseUrl!, serviceRoleKey!);

    // Mints a unique disposable fixture account with the given role. Uses the
    // admin create call so the suite dispatches no real messages and burns no
    // free-tier email quota. The generated password exists only to obtain a
    // session token for this fixture and must never appear under src/.
    async function createUserWithRole(role: AppRole) {
      fixtureCounter += 1;
      const email = `ectodash-test-${role}-${Date.now()}-${fixtureCounter}@example.invalid`;
      const password = `Test-${Math.random().toString(36).slice(2)}-${Date.now()}!`;

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (error || !data.user) {
        throw new Error(
          `Failed to create ${role} fixture: ${error?.message}`
        );
      }

      createdUserIds.push(data.user.id);

      // The profiles row was just inserted by the Phase 1 trigger, defaulted
      // to 'voluntario_comum'. Only issue a service-role update when a
      // different role is actually requested.
      if (role !== "voluntario_comum") {
        const { error: updateError } = await admin
          .from("profiles")
          .update({ role })
          .eq("id", data.user.id);

        if (updateError) {
          throw new Error(
            `Failed to set role ${role} on fixture: ${updateError.message}`
          );
        }
      }

      return { id: data.user.id, email, password };
    }

    // Builds a fresh anon-key client signed in as the given fixture. This
    // client carries the `authenticated` Postgres role, so every query
    // through it is evaluated against real RLS policies.
    async function signInAs(fixture: { email: string; password: string }) {
      const client = createClient(supabaseUrl!, anonKey!);

      const { error } = await client.auth.signInWithPassword({
        email: fixture.email,
        password: fixture.password,
      });

      if (error) {
        throw new Error(`Failed to sign in as ${fixture.email}: ${error.message}`);
      }

      return client;
    }

    afterAll(async () => {
      // No fixture account should linger in the hosted project.
      for (const id of createdUserIds) {
        await admin.auth.admin.deleteUser(id);
      }
    });

    it("coordenador_geral can change another volunteer's role (tracer path)", async () => {
      const coordinator = await createUserWithRole("coordenador_geral");
      const volunteer = await createUserWithRole("voluntario_comum");

      const coordinatorClient = await signInAs(coordinator);

      const { error: updateError } = await coordinatorClient
        .from("profiles")
        .update({ role: "lider_area" })
        .eq("id", volunteer.id);

      // RLS returns success-with-zero-rows (not an error) on a denied write,
      // and the acting client cannot read another user's row back under
      // Phase 1's self-only SELECT policy — so the update response alone is
      // never sound proof of either outcome. The only sound assertion is a
      // re-read of the target row with the service-role admin client.
      expect(updateError).toBeNull();

      const { data: reread, error: rereadError } = await admin
        .from("profiles")
        .select("role")
        .eq("id", volunteer.id)
        .single();

      expect(rereadError).toBeNull();
      expect(reread?.role).toBe("lider_area");
    });

    it("voluntario_comum cannot change another user's role", async () => {
      const volunteer = await createUserWithRole("voluntario_comum");
      const target = await createUserWithRole("voluntario_comum");

      const volunteerClient = await signInAs(volunteer);

      const { error: updateError } = await volunteerClient
        .from("profiles")
        .update({ role: "coordenador_geral" })
        .eq("id", target.id);

      // A recursion failure is the specific way a caller-privileged helper
      // fails here, and it would otherwise masquerade as a successful denial.
      expect(updateError?.message ?? "").not.toMatch(/infinite recursion/i);

      const { data: reread, error: rereadError } = await admin
        .from("profiles")
        .select("role")
        .eq("id", target.id)
        .single();

      expect(rereadError).toBeNull();
      expect(reread?.role).toBe("voluntario_comum");
    });

    it("voluntario_comum cannot promote their own role (self-escalation)", async () => {
      const volunteer = await createUserWithRole("voluntario_comum");

      const volunteerClient = await signInAs(volunteer);

      const { error: updateError } = await volunteerClient
        .from("profiles")
        .update({ role: "coordenador_geral" })
        .eq("id", volunteer.id);

      expect(updateError?.message ?? "").not.toMatch(/infinite recursion/i);

      const { data: reread, error: rereadError } = await admin
        .from("profiles")
        .select("role")
        .eq("id", volunteer.id)
        .single();

      expect(rereadError).toBeNull();
      expect(reread?.role).toBe("voluntario_comum");
    });
  }
);

if (!canRun) {
  describe("profiles.role RLS enforcement (live Supabase project)", () => {
    it.skip("SUPABASE_SERVICE_ROLE_KEY (or other required project env vars) not set — skipping live database integration tests", () => {
      // Intentionally empty: this test exists only to surface a visible skip
      // message when the hosted-project credentials are unavailable.
    });
  });
}
