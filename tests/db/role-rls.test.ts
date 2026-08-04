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

    it("a newly created account defaults to voluntario_comum with no role handling at all", async () => {
      // No role argument, no post-creation update — this exercises exactly
      // what a brand-new volunteer gets from Phase 1's identity trigger plus
      // the column DEFAULT, with nothing else in the path touching role.
      fixtureCounter += 1;
      const email = `ectodash-test-default-${Date.now()}-${fixtureCounter}@example.invalid`;
      const password = `Test-${Math.random().toString(36).slice(2)}-${Date.now()}!`;

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (error || !data.user) {
        throw new Error(`Failed to create default-role fixture: ${error?.message}`);
      }
      createdUserIds.push(data.user.id);

      const { data: reread, error: rereadError } = await admin
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      expect(rereadError).toBeNull();
      expect(reread?.role).toBe("voluntario_comum");
    });

    // COORDINATOR_EMAIL is deliberately not hardcoded here — it names the
    // institution's real Coordenador geral address, and this repository is
    // public. The suite reads it from the git-ignored .env.local, and this
    // one assertion skips visibly (naming the missing variable) rather than
    // failing when it is absent, per this plan's must_haves.
    const coordinatorEmail = process.env.COORDINATOR_EMAIL;

    it.skipIf(!coordinatorEmail)(
      "the seeded Coordenador geral account (COORDINATOR_EMAIL) holds coordenador_geral after the migration",
      async () => {
        const { data, error } = await admin
          .from("profiles")
          .select("role")
          .eq("email", coordinatorEmail as string);

        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        expect(data?.[0]?.role).toBe("coordenador_geral");
      }
    );

    if (!coordinatorEmail) {
      it.skip(
        "COORDINATOR_EMAIL not set — skipping the targeted coordinator-backfill assertion (see .env.local.example)",
        () => {
          // Intentionally empty: surfaces a visible, named skip reason.
        }
      );
    }

    it("structural backstop: at least one non-fixture account holds coordenador_geral after the migration", async () => {
      // Runs unconditionally, independent of COORDINATOR_EMAIL. Catches the
      // total-failure mode of migration 0002's backfill (column added, but
      // the UPDATE never ran or targeted nothing) even on a machine that
      // never configured the optional variable. Fixture accounts created by
      // this suite always live under the @example.invalid domain, so
      // excluding it can't accidentally match a disposable test row.
      const { data, error } = await admin
        .from("profiles")
        .select("id, email")
        .eq("role", "coordenador_geral")
        .not("email", "like", "%@example.invalid");

      expect(error).toBeNull();
      expect((data ?? []).length).toBeGreaterThan(0);
    });

    const allRoles: AppRole[] = [
      "coordenador_geral",
      "lider_area",
      "voluntario_comum",
      "financeiro",
    ];

    it("has_role() returns true for exactly the caller's own role, false for the other three (per-role correctness matrix)", async () => {
      // One fixture per role, each checked against all four role names over
      // RPC through its own signed-in client — never the service-role
      // client, which bypasses RLS entirely and carries no auth.uid().
      // Driven from allRoles so a fifth role later extends the matrix by
      // editing one list rather than writing a new near-identical block.
      for (const ownRole of allRoles) {
        const fixture = await createUserWithRole(ownRole);
        const client = await signInAs(fixture);

        for (const checkedRole of allRoles) {
          const { data, error } = await client.rpc("has_role", {
            required_role: checkedRole,
          });

          expect(error).toBeNull();
          expect(data).toBe(checkedRole === ownRole);
        }
      }
    });

    it("the Phase 10 financial predicate — has_role('financeiro') or has_role('coordenador_geral') — admits only those two roles", async () => {
      // Stands in for ROADMAP Success Criterion 2 ("cannot retrieve
      // financial data") until the real table lands in Phase 10 (D-03): no
      // financial table, view, or column is created here. This proves the
      // exact composite predicate Phase 10's policy will use, evaluated
      // through each role's own signed-in client.
      const expectedAdmit: Record<AppRole, boolean> = {
        financeiro: true,
        coordenador_geral: true,
        lider_area: false,
        voluntario_comum: false,
      };

      for (const role of allRoles) {
        const fixture = await createUserWithRole(role);
        const client = await signInAs(fixture);

        const [financeiroCheck, coordenadorCheck] = await Promise.all([
          client.rpc("has_role", { required_role: "financeiro" }),
          client.rpc("has_role", { required_role: "coordenador_geral" }),
        ]);

        expect(financeiroCheck.error).toBeNull();
        expect(coordenadorCheck.error).toBeNull();

        const admitted = Boolean(financeiroCheck.data) || Boolean(coordenadorCheck.data);
        expect(admitted).toBe(expectedAdmit[role]);
      }
    });

    it("an unauthenticated caller cannot obtain a usable answer from has_role()", async () => {
      // A fresh client built from the anon key, no session established.
      // EXECUTE was revoked from PUBLIC/anon in migration 0002, so the RPC
      // must not yield a usable true/false answer. Asserting on the absence
      // of `data === true` (rather than a specific status code or message
      // string) avoids pinning this test to a PostgREST implementation
      // detail that could change on a platform update without indicating a
      // real regression.
      const anonClient = createClient(supabaseUrl!, anonKey!);

      const { data, error } = await anonClient.rpc("has_role", {
        required_role: "voluntario_comum",
      });

      expect(data).not.toBe(true);
      // A rejection is expected in one of two shapes: an explicit RPC error
      // (the common case, since EXECUTE is revoked), or — should PostgREST
      // ever change how it reports a permission denial — a non-true data
      // value with no error. Either way, "true" must never be reachable.
      if (!error) {
        expect(data).not.toBe(true);
      }
    });

    it("recursion regression guard: a signed-in voluntario_comum can still read their own profile row, including role, with no error", async () => {
      // Phase 1's self-only SELECT policy still governs this read. If a
      // future phase widens profile access using has_role() in a way that
      // re-enters policy evaluation on profiles, this fails loudly here
      // rather than in production (Pitfall 1 / T-02-13).
      const volunteer = await createUserWithRole("voluntario_comum");
      const client = await signInAs(volunteer);

      const { data, error } = await client
        .from("profiles")
        .select("id, role")
        .eq("id", volunteer.id)
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBe(volunteer.id);
      expect(data?.role).toBe("voluntario_comum");
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
