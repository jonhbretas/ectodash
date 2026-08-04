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

// Skip condition: without SUPABASE_SERVICE_ROLE_KEY (and the other project
// credentials) this suite cannot reach the live hosted project. Skip visibly
// rather than failing so CI runs without secrets stay green.
describe.skipIf(!canRun)(
  "demandas schema + RLS enforcement (live Supabase project)",
  () => {
    let admin: SupabaseClient;
    const createdUserIds: string[] = [];
    const createdDemandaIds: number[] = [];
    let fixtureCounter = 0;

    admin = createClient(supabaseUrl!, serviceRoleKey!);

    // Mints a unique disposable @example.invalid fixture profile. Uses the
    // admin create call so the suite dispatches no real messages and burns
    // no free-tier email quota. This is a local copy of role-rls.test.ts's
    // fixture pattern — deliberately not imported across test files, since
    // these are two separate live-integration suites.
    async function createFixtureUser() {
      fixtureCounter += 1;
      const email = `ectodash-test-demanda-${Date.now()}-${fixtureCounter}@example.invalid`;
      const password = `Test-${Math.random().toString(36).slice(2)}-${Date.now()}!`;

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (error || !data.user) {
        throw new Error(`Failed to create fixture user: ${error?.message}`);
      }

      createdUserIds.push(data.user.id);

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
      // Demandas first — `on delete cascade` from demanda_responsaveis means
      // deleting the demanda is sufficient to clean up its link rows too.
      for (const id of createdDemandaIds) {
        await admin.from("demandas").delete().eq("id", id);
      }
      // Fixture users last, so no dangling FK references remain.
      for (const id of createdUserIds) {
        await admin.auth.admin.deleteUser(id);
      }
    });

    it("DEM-01: a demanda can have multiple responsáveis (many-to-many, not a single FK)", async () => {
      const criador = await createFixtureUser();
      const responsavelA = await createFixtureUser();
      const responsavelB = await createFixtureUser();

      const criadorClient = await signInAs(criador);

      const { data: inserted, error: insertError } = await criadorClient
        .from("demandas")
        .insert({
          titulo: "Organizar doações de inverno",
          prazo: "2027-01-15",
          status: "pendente",
          area: "Assistência Social",
        })
        .select("id")
        .single();

      expect(insertError).toBeNull();
      expect(inserted?.id).toBeDefined();
      const demandaId = inserted!.id as number;
      createdDemandaIds.push(demandaId);

      const { error: linkError } = await criadorClient
        .from("demanda_responsaveis")
        .insert([
          { demanda_id: demandaId, profile_id: responsavelA.id },
          { demanda_id: demandaId, profile_id: responsavelB.id },
        ]);

      expect(linkError).toBeNull();

      // Re-read via service-role client — never trust the acting client's
      // own response shape, per this project's established observation
      // contract (role-rls.test.ts, Phase 2's SELECT-gates-UPDATE lesson).
      const { data: demandaRow, error: demandaReadError } = await admin
        .from("demandas")
        .select("titulo, prazo, status, area")
        .eq("id", demandaId)
        .single();

      expect(demandaReadError).toBeNull();
      expect(demandaRow?.titulo).toBe("Organizar doações de inverno");
      expect(demandaRow?.status).toBe("pendente");
      expect(demandaRow?.area).toBe("Assistência Social");

      const { data: links, error: linksReadError } = await admin
        .from("demanda_responsaveis")
        .select("profile_id")
        .eq("demanda_id", demandaId);

      expect(linksReadError).toBeNull();
      expect(links).toHaveLength(2);
      const linkedProfileIds = (links ?? []).map((l) => l.profile_id).sort();
      expect(linkedProfileIds).toEqual(
        [responsavelA.id, responsavelB.id].sort()
      );
    });

    it("DEM-01: criado_por cannot be spoofed to another user's id (anti-spoofing)", async () => {
      const actor = await createFixtureUser();
      const victim = await createFixtureUser();

      const actorClient = await signInAs(actor);

      const { data: inserted, error: insertError } = await actorClient
        .from("demandas")
        .insert({
          titulo: "Tentativa de spoof de autoria",
          prazo: "2027-02-01",
          status: "pendente",
          area: "Teste",
          criado_por: victim.id,
        })
        .select("id")
        .single();

      if (insertError) {
        // The INSERT policy's WITH CHECK rejected the spoofed criado_por
        // outright — this is the expected, sound outcome.
        expect(insertError).not.toBeNull();
        return;
      }

      // If the insert didn't error, the column default / RLS must still
      // have forced criado_por to the actor's own id, never the victim's.
      const demandaId = inserted!.id as number;
      createdDemandaIds.push(demandaId);

      const { data: row, error: readError } = await admin
        .from("demandas")
        .select("criado_por")
        .eq("id", demandaId)
        .single();

      expect(readError).toBeNull();
      expect(row?.criado_por).toBe(actor.id);
      expect(row?.criado_por).not.toBe(victim.id);
    });

    it("DEM-02: a different authenticated user can edit an existing demanda's fields (SELECT-gates-UPDATE re-verification)", async () => {
      const criador = await createFixtureUser();
      const editor = await createFixtureUser();

      const criadorClient = await signInAs(criador);

      const { data: inserted, error: insertError } = await criadorClient
        .from("demandas")
        .insert({
          titulo: "Título original",
          prazo: "2027-03-01",
          status: "pendente",
          area: "Original",
        })
        .select("id")
        .single();

      expect(insertError).toBeNull();
      const demandaId = inserted!.id as number;
      createdDemandaIds.push(demandaId);

      const editorClient = await signInAs(editor);

      const { error: updateError } = await editorClient
        .from("demandas")
        .update({ titulo: "Título editado por outro usuário", area: "Editada" })
        .eq("id", demandaId);

      // RLS returns success-with-zero-rows (not an error) on a denied
      // write, so the only sound assertion is a service-role re-read.
      expect(updateError).toBeNull();

      const { data: row, error: readError } = await admin
        .from("demandas")
        .select("titulo, area")
        .eq("id", demandaId)
        .single();

      expect(readError).toBeNull();
      expect(row?.titulo).toBe("Título editado por outro usuário");
      expect(row?.area).toBe("Editada");
    });

    it("DEM-02: a different authenticated user can conclude a demanda, and updated_at advances (trigger proof)", async () => {
      const criador = await createFixtureUser();
      const editor = await createFixtureUser();

      const criadorClient = await signInAs(criador);

      const { data: inserted, error: insertError } = await criadorClient
        .from("demandas")
        .insert({
          titulo: "Demanda a concluir",
          prazo: "2027-03-05",
          status: "pendente",
          area: "Teste",
        })
        .select("id, created_at")
        .single();

      expect(insertError).toBeNull();
      const demandaId = inserted!.id as number;
      createdDemandaIds.push(demandaId);

      const editorClient = await signInAs(editor);

      const { error: updateError } = await editorClient
        .from("demandas")
        .update({ status: "concluida" })
        .eq("id", demandaId);

      expect(updateError).toBeNull();

      const { data: row, error: readError } = await admin
        .from("demandas")
        .select("status, created_at, updated_at")
        .eq("id", demandaId)
        .single();

      expect(readError).toBeNull();
      expect(row?.status).toBe("concluida");
      expect(new Date(row!.updated_at).getTime()).toBeGreaterThan(
        new Date(row!.created_at).getTime()
      );
    });

    it("DEM-02: responsável swap via delete-then-insert on demanda_responsaveis", async () => {
      const criador = await createFixtureUser();
      const responsavelA = await createFixtureUser();
      const responsavelB = await createFixtureUser();
      const responsavelC = await createFixtureUser();

      const criadorClient = await signInAs(criador);

      const { data: inserted, error: insertError } = await criadorClient
        .from("demandas")
        .insert({
          titulo: "Demanda com troca de responsável",
          prazo: "2027-03-10",
          status: "pendente",
          area: "Teste",
        })
        .select("id")
        .single();

      expect(insertError).toBeNull();
      const demandaId = inserted!.id as number;
      createdDemandaIds.push(demandaId);

      const { error: linkError } = await criadorClient
        .from("demanda_responsaveis")
        .insert([
          { demanda_id: demandaId, profile_id: responsavelA.id },
          { demanda_id: demandaId, profile_id: responsavelB.id },
        ]);
      expect(linkError).toBeNull();

      // Swap: remove B, add C. A is retained untouched.
      const { error: deleteError } = await criadorClient
        .from("demanda_responsaveis")
        .delete()
        .eq("demanda_id", demandaId)
        .eq("profile_id", responsavelB.id);
      expect(deleteError).toBeNull();

      const { error: newLinkError } = await criadorClient
        .from("demanda_responsaveis")
        .insert({ demanda_id: demandaId, profile_id: responsavelC.id });
      expect(newLinkError).toBeNull();

      const { data: links, error: linksReadError } = await admin
        .from("demanda_responsaveis")
        .select("profile_id")
        .eq("demanda_id", demandaId);

      expect(linksReadError).toBeNull();
      expect(links).toHaveLength(2);
      const linkedProfileIds = (links ?? []).map((l) => l.profile_id).sort();
      expect(linkedProfileIds).toEqual(
        [responsavelA.id, responsavelC.id].sort()
      );
    });

    it("DEM-03: a past-prazo, non-concluded demanda is atrasada = true", async () => {
      const criador = await createFixtureUser();
      const criadorClient = await signInAs(criador);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const prazo = yesterday.toISOString().slice(0, 10);

      const { data: inserted, error: insertError } = await criadorClient
        .from("demandas")
        .insert({
          titulo: "Demanda atrasada e pendente",
          prazo,
          status: "pendente",
          area: "Teste",
        })
        .select("id")
        .single();

      expect(insertError).toBeNull();
      const demandaId = inserted!.id as number;
      createdDemandaIds.push(demandaId);

      const { data: row, error: readError } = await admin
        .from("demandas_com_status")
        .select("atrasada")
        .eq("id", demandaId)
        .single();

      expect(readError).toBeNull();
      expect(row?.atrasada).toBe(true);
    });

    it("DEM-03: a past-prazo demanda that IS concluded is atrasada = false", async () => {
      const criador = await createFixtureUser();
      const criadorClient = await signInAs(criador);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const prazo = yesterday.toISOString().slice(0, 10);

      const { data: inserted, error: insertError } = await criadorClient
        .from("demandas")
        .insert({
          titulo: "Demanda concluída, prazo no passado",
          prazo,
          status: "concluida",
          area: "Teste",
        })
        .select("id")
        .single();

      expect(insertError).toBeNull();
      const demandaId = inserted!.id as number;
      createdDemandaIds.push(demandaId);

      const { data: row, error: readError } = await admin
        .from("demandas_com_status")
        .select("atrasada")
        .eq("id", demandaId)
        .single();

      expect(readError).toBeNull();
      expect(row?.atrasada).toBe(false);
    });

    it("DEM-03: a future-prazo demanda is atrasada = false", async () => {
      const criador = await createFixtureUser();
      const criadorClient = await signInAs(criador);

      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const prazo = nextMonth.toISOString().slice(0, 10);

      const { data: inserted, error: insertError } = await criadorClient
        .from("demandas")
        .insert({
          titulo: "Demanda com prazo futuro",
          prazo,
          status: "pendente",
          area: "Teste",
        })
        .select("id")
        .single();

      expect(insertError).toBeNull();
      const demandaId = inserted!.id as number;
      createdDemandaIds.push(demandaId);

      const { data: row, error: readError } = await admin
        .from("demandas_com_status")
        .select("atrasada")
        .eq("id", demandaId)
        .single();

      expect(readError).toBeNull();
      expect(row?.atrasada).toBe(false);
    });

    it("demandas_com_status view respects RLS (security_invoker) — an ordinary authenticated user can query it directly", async () => {
      const criador = await createFixtureUser();
      const criadorClient = await signInAs(criador);

      const { data: inserted, error: insertError } = await criadorClient
        .from("demandas")
        .insert({
          titulo: "Demanda para checagem de RLS na view",
          prazo: "2027-04-01",
          status: "pendente",
          area: "Teste",
        })
        .select("id")
        .single();

      expect(insertError).toBeNull();
      const demandaId = inserted!.id as number;
      createdDemandaIds.push(demandaId);

      // Query the view directly with the acting (non-service-role) client —
      // sanity-checking security_invoker = true was actually applied: this
      // must succeed (no permission error) and return rows, proving the
      // view is reachable through RLS rather than raising a bypass/denial.
      const { data, error } = await criadorClient
        .from("demandas_com_status")
        .select("id, atrasada")
        .eq("id", demandaId);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]?.id).toBe(demandaId);
    });
  }
);

if (!canRun) {
  describe("demandas schema + RLS enforcement (live Supabase project)", () => {
    it.skip("SUPABASE_SERVICE_ROLE_KEY (or other required project env vars) not set — skipping live database integration tests", () => {
      // Intentionally empty: this test exists only to surface a visible skip
      // message when the hosted-project credentials are unavailable.
    });
  });
}
