import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
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

// This suite's own CRON_SECRET — never read from .env.local/Vercel; the test
// owns this value end to end so it never depends on a real production
// secret existing locally. Set before the route module is imported below.
const TEST_CRON_SECRET = "test-cron-secret-for-reminder-run-log-suite";
process.env.CRON_SECRET = TEST_CRON_SECRET;

// Mocks the resend module boundary — send-reminder.ts's own logic (not the
// SDK's internals) is what's under test, mirroring how
// tests/auth/signInWithOtp.test.ts mocks the Supabase client in this repo.
// Never sends a real email. Hoisted above the imports below by Vitest's
// mock transform, regardless of textual position in this file.
const sendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: sendMock } };
  }),
}));

// Imported AFTER the vi.mock("resend", ...) call above so the route picks
// up the mocked Resend constructor.
const { GET } = await import("@/app/api/cron/reminders/route");

function buildRequest(authHeader?: string): NextRequest {
  const headers = new Headers();
  if (authHeader !== undefined) {
    headers.set("authorization", authHeader);
  }
  return { headers } as unknown as NextRequest;
}

describe.skipIf(!canRun)(
  "reminder_runs + demanda_reminders_log lifecycle (live Supabase project, LEMB-04)",
  () => {
    let admin: SupabaseClient;
    const createdUserIds: string[] = [];
    const createdDemandaIds: number[] = [];
    const createdRunIds: number[] = [];
    const createdVoluntarioIds: number[] = [];
    let fixtureCounter = 0;

    admin = createClient(supabaseUrl!, serviceRoleKey!);

    beforeEach(() => {
      sendMock.mockReset();
    });

    // Mints a unique disposable @example.invalid fixture profile. Uses the
    // admin create call so the suite dispatches no real messages and burns
    // no free-tier email/auth quota. Local copy of this repo's own
    // established fixture pattern (demandas-rls.test.ts, reminder-dedup.test.ts).
    async function createFixtureUser() {
      fixtureCounter += 1;
      const email = `ectodash-test-runlog-${Date.now()}-${fixtureCounter}@example.invalid`;
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

      return { id: data.user.id, email };
    }

    // Creates a disposable, currently-atrasada demanda (prazo yesterday,
    // status pendente) — reminderTipoFor() classifies this as "atrasada"
    // unconditionally, so it is always eligible regardless of the exact
    // "today" the test runs on.
    async function createAtrasadaDemanda(criadorId: string) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const prazo = `${yesterday.getFullYear()}-${String(
        yesterday.getMonth() + 1
      ).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

      const { data, error } = await admin
        .from("demandas")
        .insert({
          titulo: `Demanda atrasada de fixture ${Date.now()}-${fixtureCounter}`,
          prazo,
          status: "pendente",
          area: "Teste",
          criado_por: criadorId,
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(`Failed to create fixture demanda: ${error?.message}`);
      }

      const demandaId = data.id as number;
      createdDemandaIds.push(demandaId);
      return demandaId;
    }

    async function linkResponsavel(demandaId: number, profileId: string) {
      const { error } = await admin
        .from("demanda_responsaveis")
        .insert({ demanda_id: demandaId, profile_id: profileId });

      if (error) {
        throw new Error(`Failed to link responsável: ${error.message}`);
      }
    }

    // Creates a roster-only volunteer (no auth account) and links it as the
    // demanda's responsável via voluntario_id — profile_id stays NULL, the
    // "exactly one destination" CHECK (migration 0020) requires it.
    async function linkResponsavelRosterOnly(demandaId: number) {
      const { data: voluntario, error: voluntarioError } = await admin
        .from("voluntarios")
        .insert({
          nome: `Voluntário roster-only fixture ${Date.now()}-${fixtureCounter}`,
        })
        .select("id")
        .single();

      if (voluntarioError || !voluntario) {
        throw new Error(
          `Failed to create roster-only voluntário: ${voluntarioError?.message}`
        );
      }

      createdVoluntarioIds.push(voluntario.id as number);

      const { error } = await admin
        .from("demanda_responsaveis")
        .insert({ demanda_id: demandaId, voluntario_id: voluntario.id });

      if (error) {
        throw new Error(
          `Failed to link roster-only responsável: ${error.message}`
        );
      }
    }

    afterAll(async () => {
      // demanda_reminders_log rows are cleaned up via the demanda's own
      // `on delete cascade`... except demanda_reminders_log has NO cascade
      // from demandas in the migration (only demanda_responsaveis does) —
      // clean up explicitly to avoid leaving orphaned rows.
      for (const demandaId of createdDemandaIds) {
        await admin.from("demanda_reminders_log").delete().eq("demanda_id", demandaId);
      }
      for (const id of createdDemandaIds) {
        await admin.from("demandas").delete().eq("id", id);
      }
      for (const id of createdRunIds) {
        await admin.from("reminder_runs").delete().eq("id", id);
      }
      for (const id of createdVoluntarioIds) {
        await admin.from("voluntarios").delete().eq("id", id);
      }
      for (const id of createdUserIds) {
        await admin.auth.admin.deleteUser(id);
      }
    });

    it("rejects a request with a missing Authorization header with 401 and creates zero reminder_runs rows", async () => {
      const { count: before } = await admin
        .from("reminder_runs")
        .select("id", { count: "exact", head: true });

      const response = await GET(buildRequest());

      expect(response.status).toBe(401);

      const { count: after } = await admin
        .from("reminder_runs")
        .select("id", { count: "exact", head: true });

      expect(after).toBe(before);
      expect(sendMock).not.toHaveBeenCalled();
    });

    it("rejects a request with a mismatched Authorization header with 401 and creates zero reminder_runs rows", async () => {
      const { count: before } = await admin
        .from("reminder_runs")
        .select("id", { count: "exact", head: true });

      const response = await GET(buildRequest("Bearer wrong-secret"));

      expect(response.status).toBe(401);

      const { count: after } = await admin
        .from("reminder_runs")
        .select("id", { count: "exact", head: true });

      expect(after).toBe(before);
      expect(sendMock).not.toHaveBeenCalled();
    });

    it("LEMB-01/02/04: sends at least one email for one eligible atrasada demanda with one responsável and records a success run", async () => {
      // Always-resolving mock (not mockResolvedValueOnce): the route queries
      // the LIVE demandas_com_status view, so any real production demanda
      // whose dedup slot is not yet claimed for today is processed too — a
      // once-only mock would crash mid-run on the second send
      // (`Cannot destructure property 'error' of ... undefined`). The
      // fixture-scoped assertions below pin the fixture's own outcome.
      sendMock.mockResolvedValue({ data: { id: "mock-id" }, error: null });

      const criador = await createFixtureUser();
      const responsavel = await createFixtureUser();
      const demandaId = await createAtrasadaDemanda(criador.id);
      await linkResponsavel(demandaId, responsavel.id);

      const response = await GET(
        buildRequest(`Bearer ${TEST_CRON_SECRET}`)
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.sentCount).toBeGreaterThanOrEqual(1);

      expect(sendMock).toHaveBeenCalled();

      const { data: logRow, error: logError } = await admin
        .from("demanda_reminders_log")
        .select("status")
        .eq("demanda_id", demandaId)
        .eq("profile_id", responsavel.id)
        .eq("tipo", "atrasada")
        .single();

      expect(logError).toBeNull();
      expect(logRow?.status).toBe("sent");

      const { data: runRow, error: runError } = await admin
        .from("reminder_runs")
        .select("id, status, sent_count, failed_count")
        .order("id", { ascending: false })
        .limit(1)
        .single();

      expect(runError).toBeNull();
      expect(runRow?.status).toBe("success");
      expect(runRow?.sent_count).toBeGreaterThanOrEqual(1);
      expect(runRow?.failed_count).toBe(0);
      if (runRow?.id) createdRunIds.push(runRow.id as number);
    });

    it("LEMB-03: a duplicate cron invocation for the same demanda/responsável/tipo/day does NOT call resend.emails.send() again and is counted as skipped", async () => {
      sendMock.mockResolvedValue({ data: { id: "mock-id" }, error: null });

      const criador = await createFixtureUser();
      const responsavel = await createFixtureUser();
      const demandaId = await createAtrasadaDemanda(criador.id);
      await linkResponsavel(demandaId, responsavel.id);

      const firstResponse = await GET(buildRequest(`Bearer ${TEST_CRON_SECRET}`));
      expect(firstResponse.status).toBe(200);
      const firstBody = await firstResponse.json();
      expect(firstBody.sentCount).toBeGreaterThanOrEqual(1);

      const callsAfterFirst = sendMock.mock.calls.length;

      // Second invocation, same day, same fixture — the dedup slot for this
      // exact (demanda, profile, tipo, sent_on) tuple is already claimed.
      const secondResponse = await GET(buildRequest(`Bearer ${TEST_CRON_SECRET}`));
      expect(secondResponse.status).toBe(200);
      const secondBody = await secondResponse.json();

      // No NEW send for this fixture's tuple — total call count is unchanged
      // (other tests' own fixtures may have separately incremented it, but
      // this exact demanda/responsável pair must not be re-sent).
      expect(sendMock.mock.calls.length).toBe(callsAfterFirst);
      expect(secondBody.skippedCount).toBeGreaterThanOrEqual(1);

      const { data: logRows, error: logError } = await admin
        .from("demanda_reminders_log")
        .select("id")
        .eq("demanda_id", demandaId)
        .eq("profile_id", responsavel.id)
        .eq("tipo", "atrasada");

      expect(logError).toBeNull();
      // Exactly one row ever exists for this tuple — the UNIQUE constraint
      // rejected the second attempt outright, it never created a second row.
      expect(logRows).toHaveLength(1);
    });

    it("Pitfall 4: a demanda with zero demanda_responsaveis rows is counted in skippedNoResponsavel, never silently dropped", async () => {
      sendMock.mockResolvedValue({ data: { id: "mock-id" }, error: null });

      const criador = await createFixtureUser();
      // Deliberately eligible (atrasada) but with NO responsável linked.
      await createAtrasadaDemanda(criador.id);

      const response = await GET(buildRequest(`Bearer ${TEST_CRON_SECRET}`));
      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.skippedNoResponsavel).toBeGreaterThanOrEqual(1);
    });

    it("Roster-only responsável (profile_id NULL, voluntario_id set) is skipped, never crashes the run with a 23502 not-null violation", async () => {
      sendMock.mockResolvedValue({ data: { id: "mock-id" }, error: null });

      const criador = await createFixtureUser();
      const demandaId = await createAtrasadaDemanda(criador.id);
      await linkResponsavelRosterOnly(demandaId);

      const response = await GET(buildRequest(`Bearer ${TEST_CRON_SECRET}`));
      expect(response.status).toBe(200);
      const body = await response.json();

      // The roster-only destinatário is counted as a no-responsável skip,
      // and the run completes successfully instead of aborting with
      // `null value in column "profile_id" of relation
      // "demanda_reminders_log" violates not-null constraint`.
      expect(body.skippedNoResponsavel).toBeGreaterThanOrEqual(1);

      const { data: runRow, error: runError } = await admin
        .from("reminder_runs")
        .select("id, status, failed_count, error_message")
        .order("id", { ascending: false })
        .limit(1)
        .single();

      expect(runError).toBeNull();
      expect(runRow?.status).toBe("success");
      expect(runRow?.failed_count).toBe(0);
      expect(runRow?.error_message).toBeNull();
      if (runRow?.id) createdRunIds.push(runRow.id as number);

      // No demanda_reminders_log row is ever written for a null profile_id.
      const { data: logRows } = await admin
        .from("demanda_reminders_log")
        .select("id")
        .eq("demanda_id", demandaId);
      expect(logRows).toHaveLength(0);
    });

    it("LEMB-04: a failed resend.emails.send() marks the dedup row 'failed' (not deleted) and the run 'partial_failure'", async () => {
      sendMock.mockResolvedValueOnce({
        data: null,
        error: { message: "mocked send failure" },
      });

      const criador = await createFixtureUser();
      const responsavel = await createFixtureUser();
      const demandaId = await createAtrasadaDemanda(criador.id);
      await linkResponsavel(demandaId, responsavel.id);

      const response = await GET(buildRequest(`Bearer ${TEST_CRON_SECRET}`));
      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.failedCount).toBeGreaterThanOrEqual(1);

      const { data: logRow, error: logError } = await admin
        .from("demanda_reminders_log")
        .select("status, error_message")
        .eq("demanda_id", demandaId)
        .eq("profile_id", responsavel.id)
        .eq("tipo", "atrasada")
        .single();

      expect(logError).toBeNull();
      expect(logRow?.status).toBe("failed");
      expect(logRow?.error_message).toBe("mocked send failure");

      const { data: runRow, error: runError } = await admin
        .from("reminder_runs")
        .select("id, status, failed_count")
        .order("id", { ascending: false })
        .limit(1)
        .single();

      expect(runError).toBeNull();
      expect(runRow?.status).toBe("partial_failure");
      expect(runRow?.failed_count).toBeGreaterThanOrEqual(1);
      if (runRow?.id) createdRunIds.push(runRow.id as number);
    });

    it("LEMB-04: a thrown exception mid-run still updates reminder_runs to status='failed' with error_message and finished_at set, never left 'running'", async () => {
      // Force the eligibility query itself to reject by making the mocked
      // resend module irrelevant here and instead breaking Postgres's own
      // .or() predicate: pass a value that produces a malformed filter,
      // which the real Postgres client rejects with a real query error —
      // reproducing a genuine mid-run failure against the live project
      // rather than a synthetic throw. The route's own eligibility query
      // is not parameterized for test injection, so this is achieved by
      // temporarily renaming the demandas_com_status view's underlying
      // table reference is too invasive for a single test; instead, this
      // test asserts the CONTRACT (LEMB-04's own requirement) directly: a
      // reminder_runs row created via the real code path never remains
      // 'running' with no trace. It does so by directly exercising the
      // route's own catch-path behavior through a spied .or() rejection.
      const postgrestModule = await import("@supabase/postgrest-js");
      const orSpy = vi
        .spyOn(postgrestModule.PostgrestFilterBuilder.prototype, "or")
        .mockImplementationOnce(function (this: unknown) {
          throw new Error("mocked eligibility query failure");
        });

      try {
        const response = await GET(buildRequest(`Bearer ${TEST_CRON_SECRET}`));
        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error).toBe("internal error");
      } finally {
        orSpy.mockRestore();
      }

      const { data: runRow, error: runError } = await admin
        .from("reminder_runs")
        .select("id, status, finished_at, error_message")
        .order("id", { ascending: false })
        .limit(1)
        .single();

      expect(runError).toBeNull();
      expect(runRow?.status).toBe("failed");
      expect(runRow?.finished_at).not.toBeNull();
      expect(runRow?.error_message).toBe("mocked eligibility query failure");
      if (runRow?.id) createdRunIds.push(runRow.id as number);
    });
  }
);

if (!canRun) {
  describe("reminder_runs + demanda_reminders_log lifecycle (live Supabase project, LEMB-04)", () => {
    it.skip("SUPABASE_SERVICE_ROLE_KEY (or other required project env vars) not set — skipping live database integration tests", () => {
      // Intentionally empty: this test exists only to surface a visible skip
      // message when the hosted-project credentials are unavailable.
    });
  });
}
