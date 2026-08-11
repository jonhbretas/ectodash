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
  "feedback schema + RLS enforcement (live Supabase project)",
  () => {
    let admin: SupabaseClient;
    const createdUserIds: string[] = [];
    const createdFeedbackIds: string[] = [];
    let fixtureCounter = 0;

    admin = createClient(supabaseUrl!, serviceRoleKey!);

    // Mints a unique disposable @example.invalid fixture profile. Uses the
    // admin create call so the suite dispatches no real messages and burns
    // no free-tier email quota — same fixture pattern as the other db suites.
    async function createFixtureUser() {
      fixtureCounter += 1;
      const email = `ectodash-test-feedback-${Date.now()}-${fixtureCounter}@example.invalid`;
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
      // Feedback rows first — explicit cleanup even though the FK cascades
      // on profile delete.
      for (const id of createdFeedbackIds) {
        await admin.from("feedback").delete().eq("id", id);
      }
      // Fixture users last, so no dangling FK references remain.
      for (const id of createdUserIds) {
        await admin.auth.admin.deleteUser(id);
      }
    });

    it("FDB-01: user can insert their own feedback and read it back", async () => {
      const autor = await createFixtureUser();
      const client = await signInAs(autor);

      const { data: inserted, error: insertError } = await client
        .from("feedback")
        .insert({
          user_id: autor.id,
          tipo: "bug",
          mensagem: "O botão de salvar não responde na página de demandas.",
        })
        .select("id, tipo, mensagem, status")
        .single();

      expect(insertError).toBeNull();
      expect(inserted?.id).toBeDefined();
      expect(inserted?.tipo).toBe("bug");
      expect(inserted?.status).toBe("novo");
      const feedbackId = inserted!.id as string;
      createdFeedbackIds.push(feedbackId);

      const { data: rows, error: readError } = await client
        .from("feedback")
        .select("id, mensagem")
        .eq("id", feedbackId);

      expect(readError).toBeNull();
      expect(rows).toHaveLength(1);
      expect(rows![0].mensagem).toContain("não responde");
    });

    it("FDB-02: user cannot see or mutate someone else's feedback", async () => {
      const autor = await createFixtureUser();
      const autorClient = await signInAs(autor);
      const { data: inserted, error: insertError } = await autorClient
        .from("feedback")
        .insert({
          user_id: autor.id,
          tipo: "sugestao",
          mensagem: "Incluir um calendário anual na página inicial.",
        })
        .select("id")
        .single();

      expect(insertError).toBeNull();
      const feedbackId = inserted!.id as string;
      createdFeedbackIds.push(feedbackId);

      const intruso = await createFixtureUser();
      const intrusoClient = await signInAs(intruso);

      // O terceiro não enxerga o feedback alheio.
      const { data: oculto } = await intrusoClient
        .from("feedback")
        .select("id")
        .eq("id", feedbackId)
        .maybeSingle();
      expect(oculto).toBeNull();

      // E não consegue alterar o status de acompanhamento — RLS filtra a
      // linha, o update afeta 0 registros silenciosamente.
      const { data: updated, error: updateError } = await intrusoClient
        .from("feedback")
        .update({ status: "resolvido" })
        .eq("id", feedbackId)
        .select("id");
      expect(updateError).toBeNull();
      expect(updated ?? []).toHaveLength(0);

      // O status segue inalterado (verificação via service-role).
      const { data: row } = await admin
        .from("feedback")
        .select("status")
        .eq("id", feedbackId)
        .single();
      expect(row?.status).toBe("novo");
    });

    it("FDB-03: coordinator sees all feedback and can update status", async () => {
      const autor = await createFixtureUser();
      const autorClient = await signInAs(autor);
      const { data: inserted, error: insertError } = await autorClient
        .from("feedback")
        .insert({
          user_id: autor.id,
          tipo: "bug",
          mensagem: "O relatório financeiro exporta com valores trocados.",
        })
        .select("id")
        .single();

      expect(insertError).toBeNull();
      const feedbackId = inserted!.id as string;
      createdFeedbackIds.push(feedbackId);

      const coordenador = await createFixtureUser();
      await admin
        .from("profiles")
        .update({ role: "coordenador_geral" })
        .eq("id", coordenador.id);
      const coordClient = await signInAs(coordenador);

      const { data: visivel, error: readError } = await coordClient
        .from("feedback")
        .select("id")
        .eq("id", feedbackId)
        .maybeSingle();
      expect(readError).toBeNull();
      expect(visivel?.id).toBe(feedbackId);

      const { error: updateError } = await coordClient
        .from("feedback")
        .update({ status: "visto" })
        .eq("id", feedbackId);
      expect(updateError).toBeNull();

      const { data: row } = await admin
        .from("feedback")
        .select("status")
        .eq("id", feedbackId)
        .single();
      expect(row?.status).toBe("visto");
    });
  }
);

if (!canRun) {
  describe("feedback schema + RLS enforcement (live Supabase project)", () => {
    it.skip("SUPABASE_SERVICE_ROLE_KEY (or other required project env vars) not set — skipping live database integration tests", () => {
      // Intentionally empty: this test exists only to surface a visible skip
      // message when the hosted-project credentials are unavailable.
    });
  });
}
