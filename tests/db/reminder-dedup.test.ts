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
  "demanda_reminders_log UNIQUE(demanda_id, profile_id, tipo, sent_on) dedup constraint (live Supabase project)",
  () => {
    let admin: SupabaseClient;
    const createdUserIds: string[] = [];
    const createdDemandaIds: number[] = [];
    const createdReminderLogIds: number[] = [];
    let fixtureCounter = 0;

    admin = createClient(supabaseUrl!, serviceRoleKey!);

    // Mints a unique disposable @example.invalid fixture profile. Uses the
    // admin create call so the suite dispatches no real messages and burns
    // no free-tier email quota. Local copy of demandas-rls.test.ts's own
    // fixture pattern — deliberately not imported across test files.
    async function createFixtureUser() {
      fixtureCounter += 1;
      const email = `ectodash-test-reminder-${Date.now()}-${fixtureCounter}@example.invalid`;
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

    // Mints a disposable demanda fixture via the service-role client — this
    // suite proves ONLY the UNIQUE constraint on demanda_reminders_log, so
    // the demanda itself just needs to exist with a valid FK target.
    async function createFixtureDemanda() {
      const criador = await createFixtureUser();

      const { data, error } = await admin
        .from("demandas")
        .insert({
          titulo: "Demanda de fixture para teste de dedup de lembrete",
          prazo: "2027-06-01",
          status: "pendente",
          area: "Teste",
          criado_por: criador.id,
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(`Failed to create fixture demanda: ${error?.message}`);
      }

      createdDemandaIds.push(data.id as number);

      return { id: data.id as number };
    }

    afterAll(async () => {
      // Reminder log rows first — no FK from demandas/profiles depends on
      // this table, but clean up explicitly and in dependency order anyway.
      for (const id of createdReminderLogIds) {
        await admin.from("demanda_reminders_log").delete().eq("id", id);
      }
      // Demandas next — `on delete cascade` from demanda_responsaveis (not
      // used by this suite) would clean up link rows too, not relevant here.
      for (const id of createdDemandaIds) {
        await admin.from("demandas").delete().eq("id", id);
      }
      // Fixture users last, so no dangling FK references remain.
      for (const id of createdUserIds) {
        await admin.auth.admin.deleteUser(id);
      }
    });

    it("LEMB-03: a second insert with the identical (demanda_id, profile_id, tipo, sent_on) tuple is rejected by Postgres with error code 23505", async () => {
      const demanda = await createFixtureDemanda();
      const responsavel = await createFixtureUser();
      const sentOn = "2027-06-01";

      const { data: first, error: firstError } = await admin
        .from("demanda_reminders_log")
        .insert({
          demanda_id: demanda.id,
          profile_id: responsavel.id,
          tipo: "aproximando",
          sent_on: sentOn,
        })
        .select("id")
        .single();

      expect(firstError).toBeNull();
      expect(first?.id).toBeDefined();
      createdReminderLogIds.push(first!.id as number);

      // Second insert: identical (demanda_id, profile_id, tipo, sent_on)
      // tuple. The UNIQUE constraint itself — not application-level
      // check-then-insert logic — must reject this with 23505.
      const { data: duplicate, error: duplicateError } = await admin
        .from("demanda_reminders_log")
        .insert({
          demanda_id: demanda.id,
          profile_id: responsavel.id,
          tipo: "aproximando",
          sent_on: sentOn,
        })
        .select("id")
        .single();

      expect(duplicate).toBeNull();
      expect(duplicateError).not.toBeNull();
      expect(duplicateError?.code).toBe("23505");
    });

    it("LEMB-03: a different `tipo` for the same (demanda, profile, day) is a distinct, allowed insert", async () => {
      const demanda = await createFixtureDemanda();
      const responsavel = await createFixtureUser();
      const sentOn = "2027-06-02";

      const { data: aproximando, error: aproximandoError } = await admin
        .from("demanda_reminders_log")
        .insert({
          demanda_id: demanda.id,
          profile_id: responsavel.id,
          tipo: "aproximando",
          sent_on: sentOn,
        })
        .select("id")
        .single();

      expect(aproximandoError).toBeNull();
      createdReminderLogIds.push(aproximando!.id as number);

      const { data: atrasada, error: atrasadaError } = await admin
        .from("demanda_reminders_log")
        .insert({
          demanda_id: demanda.id,
          profile_id: responsavel.id,
          tipo: "atrasada",
          sent_on: sentOn,
        })
        .select("id")
        .single();

      // Same demanda/profile/day, different tipo — the UNIQUE constraint's
      // full column tuple does not match, so this must succeed.
      expect(atrasadaError).toBeNull();
      expect(atrasada?.id).toBeDefined();
      createdReminderLogIds.push(atrasada!.id as number);
    });

    it("LEMB-03: a different `sent_on` for the same (demanda, profile, tipo) is a distinct, allowed insert", async () => {
      const demanda = await createFixtureDemanda();
      const responsavel = await createFixtureUser();

      const { data: dayOne, error: dayOneError } = await admin
        .from("demanda_reminders_log")
        .insert({
          demanda_id: demanda.id,
          profile_id: responsavel.id,
          tipo: "atrasada",
          sent_on: "2027-06-03",
        })
        .select("id")
        .single();

      expect(dayOneError).toBeNull();
      createdReminderLogIds.push(dayOne!.id as number);

      const { data: dayTwo, error: dayTwoError } = await admin
        .from("demanda_reminders_log")
        .insert({
          demanda_id: demanda.id,
          profile_id: responsavel.id,
          tipo: "atrasada",
          sent_on: "2027-06-04",
        })
        .select("id")
        .single();

      // Same demanda/profile/tipo, a different day — the UNIQUE constraint's
      // full column tuple does not match, so this must succeed. Proves the
      // dedup granularity is genuinely per-calendar-day, not per-demanda-tipo
      // forever.
      expect(dayTwoError).toBeNull();
      expect(dayTwo?.id).toBeDefined();
      createdReminderLogIds.push(dayTwo!.id as number);
    });
  }
);

if (!canRun) {
  describe("demanda_reminders_log UNIQUE(demanda_id, profile_id, tipo, sent_on) dedup constraint (live Supabase project)", () => {
    it.skip("SUPABASE_SERVICE_ROLE_KEY (or other required project env vars) not set — skipping live database integration tests", () => {
      // Intentionally empty: this test exists only to surface a visible skip
      // message when the hosted-project credentials are unavailable.
    });
  });
}
