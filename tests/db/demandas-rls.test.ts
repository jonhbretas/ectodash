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
  "demandas schema + RLS enforcement (live Supabase project)",
  () => {
    let admin: SupabaseClient;
    const createdUserIds: string[] = [];
    const createdDemandaIds: number[] = [];
    const createdLiderAreaKeys: Array<{ lider_id: string; area: string }> = [];
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

    // Mints a fixture with a specific role already set via the service-role
    // client — mirrors role-rls.test.ts's createUserWithRole helper, kept
    // local to this file since these are two independent live-integration
    // suites.
    async function createFixtureWithRole(role: AppRole) {
      const fixture = await createFixtureUser();

      if (role !== "voluntario_comum") {
        const { error } = await admin
          .from("profiles")
          .update({ role })
          .eq("id", fixture.id);

        if (error) {
          throw new Error(`Failed to set role ${role} on fixture: ${error.message}`);
        }
      }

      return fixture;
    }

    // Assigns an área to a líder fixture via the service-role client
    // (mirrors docs/areas.md's coordenador-only runbook) and tracks the
    // composite key for afterAll cleanup.
    async function assignArea(liderId: string, area: string) {
      const { error } = await admin
        .from("lider_areas")
        .insert({ lider_id: liderId, area });

      if (error) {
        throw new Error(`Failed to assign area "${area}" to ${liderId}: ${error.message}`);
      }

      createdLiderAreaKeys.push({ lider_id: liderId, area });
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
      // lider_areas rows next — `on delete cascade` from profiles would
      // clean these up too, but deleting them explicitly first keeps
      // cleanup order matching the composite key's own semantics.
      for (const key of createdLiderAreaKeys) {
        await admin
          .from("lider_areas")
          .delete()
          .eq("lider_id", key.lider_id)
          .eq("area", key.area);
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

    it("DEM-05: an unrelated authenticated user can no longer edit a demanda they have no relationship to (regression of Phase 4's permissive behavior)", async () => {
      // This test's premise, before migration 0004, was that ANY
      // authenticated user could edit ANY demanda (Phase 4's permissive
      // using(true) RLS). DEM-05 deliberately breaks that: the "editor"
      // fixture here is deliberately unrelated — not criado_por, not
      // responsável, not líder of that área, not coordenador — and the
      // narrowed role-scoped policy must now deny the write.
      const criador = await createFixtureUser();
      const editor = await createFixtureWithRole("voluntario_comum");

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
      // write — updateError being null proves nothing on its own. The
      // ONLY sound proof of denial is a service-role re-read showing the
      // row UNCHANGED — the exact inverse assertion this test made before
      // migration 0004 narrowed the policy.
      expect(updateError).toBeNull();

      const { data: row, error: readError } = await admin
        .from("demandas")
        .select("titulo, area")
        .eq("id", demandaId)
        .single();

      expect(readError).toBeNull();
      expect(row?.titulo).toBe("Título original");
      expect(row?.area).toBe("Original");
    });

    it("DEM-02: a responsável (in-scope editor, post-DEM-05) can conclude a demanda, and updated_at advances (trigger proof)", async () => {
      // Rewritten for DEM-05 (migration 0004): the original version of this
      // test used an unrelated "editor" fixture, relying on Phase 4's
      // permissive using(true) UPDATE policy. That premise no longer holds
      // post-narrowing — an unrelated user can no longer edit an arbitrary
      // demanda (see the "DEM-05: an unrelated authenticated user..." test
      // above). This test's actual purpose — proving the updated_at trigger
      // still fires on an allowed, in-scope edit — is preserved by making
      // the editor a responsável (a role the narrowed policy explicitly
      // grants edit access to), not an arbitrary unrelated user.
      const criador = await createFixtureUser();
      const responsavel = await createFixtureUser();

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

      const { error: linkError } = await criadorClient
        .from("demanda_responsaveis")
        .insert({ demanda_id: demandaId, profile_id: responsavel.id });
      expect(linkError).toBeNull();

      const responsavelClient = await signInAs(responsavel);

      const { error: updateError } = await responsavelClient
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

    it("DEM-05: coordenador_geral can SELECT and UPDATE a demanda created by an unrelated fixture (regression check)", async () => {
      const criador = await createFixtureUser();
      const coordenador = await createFixtureWithRole("coordenador_geral");

      const criadorClient = await signInAs(criador);
      const { data: inserted, error: insertError } = await criadorClient
        .from("demandas")
        .insert({
          titulo: "Demanda sem relação com o coordenador",
          prazo: "2027-05-01",
          status: "pendente",
          area: "Financeiro",
        })
        .select("id")
        .single();

      expect(insertError).toBeNull();
      const demandaId = inserted!.id as number;
      createdDemandaIds.push(demandaId);

      const coordenadorClient = await signInAs(coordenador);

      const { data: selectData, error: selectError } = await coordenadorClient
        .from("demandas")
        .select("id")
        .eq("id", demandaId);

      expect(selectError).toBeNull();
      expect(selectData).toHaveLength(1);

      const { error: updateError } = await coordenadorClient
        .from("demandas")
        .update({ titulo: "Editado pelo coordenador" })
        .eq("id", demandaId);

      expect(updateError).toBeNull();

      const { data: row, error: readError } = await admin
        .from("demandas")
        .select("titulo")
        .eq("id", demandaId)
        .single();

      expect(readError).toBeNull();
      expect(row?.titulo).toBe("Editado pelo coordenador");
    });

    it("DEM-05: lider_area with one área can SELECT/UPDATE a case/whitespace-mismatched demanda in that área, and is denied on an unrelated área", async () => {
      const lider = await createFixtureWithRole("lider_area");
      await assignArea(lider.id, "Pesquisa");

      const criador = await createFixtureUser();
      const criadorClient = await signInAs(criador);

      const { data: allowedInsert, error: allowedInsertError } = await criadorClient
        .from("demandas")
        .insert({
          titulo: "Demanda da área Pesquisa (case/whitespace diferente)",
          prazo: "2027-05-05",
          status: "pendente",
          area: " PESQUISA ",
        })
        .select("id")
        .single();

      expect(allowedInsertError).toBeNull();
      const allowedDemandaId = allowedInsert!.id as number;
      createdDemandaIds.push(allowedDemandaId);

      const { data: deniedInsert, error: deniedInsertError } = await criadorClient
        .from("demandas")
        .insert({
          titulo: "Demanda da área Financeiro (não relacionada ao líder)",
          prazo: "2027-05-06",
          status: "pendente",
          area: "Financeiro",
        })
        .select("id")
        .single();

      expect(deniedInsertError).toBeNull();
      const deniedDemandaId = deniedInsert!.id as number;
      createdDemandaIds.push(deniedDemandaId);

      const liderClient = await signInAs(lider);

      // Allowed path: case/whitespace-mismatched área still matches.
      const { error: allowedUpdateError } = await liderClient
        .from("demandas")
        .update({ titulo: "Editado pelo líder de Pesquisa" })
        .eq("id", allowedDemandaId);

      expect(allowedUpdateError).toBeNull();

      const { data: allowedRow, error: allowedReadError } = await admin
        .from("demandas")
        .select("titulo")
        .eq("id", allowedDemandaId)
        .single();

      expect(allowedReadError).toBeNull();
      expect(allowedRow?.titulo).toBe("Editado pelo líder de Pesquisa");

      // Denied path: an unrelated área is not visible or editable.
      const { data: deniedSelect, error: deniedSelectError } = await liderClient
        .from("demandas")
        .select("id")
        .eq("id", deniedDemandaId);

      expect(deniedSelectError).toBeNull();
      expect(deniedSelect ?? []).toHaveLength(0);

      const { error: deniedUpdateError } = await liderClient
        .from("demandas")
        .update({ titulo: "Não deveria conseguir editar" })
        .eq("id", deniedDemandaId);

      expect(deniedUpdateError).toBeNull();

      const { data: deniedRow, error: deniedReadError } = await admin
        .from("demandas")
        .select("titulo")
        .eq("id", deniedDemandaId)
        .single();

      expect(deniedReadError).toBeNull();
      expect(deniedRow?.titulo).toBe("Demanda da área Financeiro (não relacionada ao líder)");
    });

    it("DEM-05: lider_area assigned to TWO áreas simultaneously can SELECT/UPDATE demandas in either área, and is denied on a third", async () => {
      const lider = await createFixtureWithRole("lider_area");
      await assignArea(lider.id, "Pesquisa");
      await assignArea(lider.id, "Eventos");

      const criador = await createFixtureUser();
      const criadorClient = await signInAs(criador);

      const { data: pesquisaInsert, error: pesquisaInsertError } = await criadorClient
        .from("demandas")
        .insert({
          titulo: "Demanda da área Pesquisa",
          prazo: "2027-05-10",
          status: "pendente",
          area: "Pesquisa",
        })
        .select("id")
        .single();
      expect(pesquisaInsertError).toBeNull();
      const pesquisaDemandaId = pesquisaInsert!.id as number;
      createdDemandaIds.push(pesquisaDemandaId);

      const { data: eventosInsert, error: eventosInsertError } = await criadorClient
        .from("demandas")
        .insert({
          titulo: "Demanda da área Eventos",
          prazo: "2027-05-11",
          status: "pendente",
          area: "Eventos",
        })
        .select("id")
        .single();
      expect(eventosInsertError).toBeNull();
      const eventosDemandaId = eventosInsert!.id as number;
      createdDemandaIds.push(eventosDemandaId);

      const { data: financeiroInsert, error: financeiroInsertError } = await criadorClient
        .from("demandas")
        .insert({
          titulo: "Demanda da área Financeiro (terceira, não assignada)",
          prazo: "2027-05-12",
          status: "pendente",
          area: "Financeiro",
        })
        .select("id")
        .single();
      expect(financeiroInsertError).toBeNull();
      const financeiroDemandaId = financeiroInsert!.id as number;
      createdDemandaIds.push(financeiroDemandaId);

      const liderClient = await signInAs(lider);

      // Allowed: both assigned áreas.
      for (const [id, title] of [
        [pesquisaDemandaId, "Editado — líder multi-área (Pesquisa)"],
        [eventosDemandaId, "Editado — líder multi-área (Eventos)"],
      ] as const) {
        const { error: updateError } = await liderClient
          .from("demandas")
          .update({ titulo: title })
          .eq("id", id);
        expect(updateError).toBeNull();

        const { data: row, error: readError } = await admin
          .from("demandas")
          .select("titulo")
          .eq("id", id)
          .single();
        expect(readError).toBeNull();
        expect(row?.titulo).toBe(title);
      }

      // Denied: third, unassigned área.
      const { data: deniedSelect, error: deniedSelectError } = await liderClient
        .from("demandas")
        .select("id")
        .eq("id", financeiroDemandaId);
      expect(deniedSelectError).toBeNull();
      expect(deniedSelect ?? []).toHaveLength(0);

      const { error: deniedUpdateError } = await liderClient
        .from("demandas")
        .update({ titulo: "Não deveria conseguir editar" })
        .eq("id", financeiroDemandaId);
      expect(deniedUpdateError).toBeNull();

      const { data: deniedRow, error: deniedReadError } = await admin
        .from("demandas")
        .select("titulo")
        .eq("id", financeiroDemandaId)
        .single();
      expect(deniedReadError).toBeNull();
      expect(deniedRow?.titulo).toBe("Demanda da área Financeiro (terceira, não assignada)");
    });

    it("DEM-05: voluntario_comum can SELECT and UPDATE a demanda they created (criado_por path), with no responsável assigned", async () => {
      const voluntario = await createFixtureWithRole("voluntario_comum");
      const voluntarioClient = await signInAs(voluntario);

      const { data: inserted, error: insertError } = await voluntarioClient
        .from("demandas")
        .insert({
          titulo: "Demanda criada pelo próprio voluntário",
          prazo: "2027-05-15",
          status: "pendente",
          area: "Assistência Social",
        })
        .select("id")
        .single();

      expect(insertError).toBeNull();
      const demandaId = inserted!.id as number;
      createdDemandaIds.push(demandaId);

      const { data: selectData, error: selectError } = await voluntarioClient
        .from("demandas")
        .select("id")
        .eq("id", demandaId);
      expect(selectError).toBeNull();
      expect(selectData).toHaveLength(1);

      const { error: updateError } = await voluntarioClient
        .from("demandas")
        .update({ status: "em_andamento" })
        .eq("id", demandaId);
      expect(updateError).toBeNull();

      const { data: row, error: readError } = await admin
        .from("demandas")
        .select("status")
        .eq("id", demandaId)
        .single();
      expect(readError).toBeNull();
      expect(row?.status).toBe("em_andamento");
    });

    it("DEM-05: voluntario_comum linked as responsável can SELECT/UPDATE that demanda, while an unrelated third voluntário is denied both", async () => {
      const criador = await createFixtureUser();
      const responsavel = await createFixtureWithRole("voluntario_comum");
      const unrelated = await createFixtureWithRole("voluntario_comum");

      const criadorClient = await signInAs(criador);

      const { data: inserted, error: insertError } = await criadorClient
        .from("demandas")
        .insert({
          titulo: "Demanda com responsável vinculado",
          prazo: "2027-05-20",
          status: "pendente",
          area: "Eventos",
        })
        .select("id")
        .single();

      expect(insertError).toBeNull();
      const demandaId = inserted!.id as number;
      createdDemandaIds.push(demandaId);

      const { error: linkError } = await criadorClient
        .from("demanda_responsaveis")
        .insert({ demanda_id: demandaId, profile_id: responsavel.id });
      expect(linkError).toBeNull();

      const responsavelClient = await signInAs(responsavel);

      const { data: selectData, error: selectError } = await responsavelClient
        .from("demandas")
        .select("id")
        .eq("id", demandaId);
      expect(selectError).toBeNull();
      expect(selectData).toHaveLength(1);

      const { error: updateError } = await responsavelClient
        .from("demandas")
        .update({ titulo: "Editado pelo responsável" })
        .eq("id", demandaId);
      expect(updateError).toBeNull();

      const { data: row, error: readError } = await admin
        .from("demandas")
        .select("titulo")
        .eq("id", demandaId)
        .single();
      expect(readError).toBeNull();
      expect(row?.titulo).toBe("Editado pelo responsável");

      // Unrelated third voluntário: no criado_por, no responsável link, no
      // líder role — denied both SELECT and UPDATE.
      const unrelatedClient = await signInAs(unrelated);

      const { data: deniedSelect, error: deniedSelectError } = await unrelatedClient
        .from("demandas")
        .select("id")
        .eq("id", demandaId);
      expect(deniedSelectError).toBeNull();
      expect(deniedSelect ?? []).toHaveLength(0);

      const { error: deniedUpdateError } = await unrelatedClient
        .from("demandas")
        .update({ titulo: "Não deveria conseguir editar" })
        .eq("id", demandaId);
      expect(deniedUpdateError).toBeNull();

      const { data: unchangedRow, error: unchangedReadError } = await admin
        .from("demandas")
        .select("titulo")
        .eq("id", demandaId)
        .single();
      expect(unchangedReadError).toBeNull();
      expect(unchangedRow?.titulo).toBe("Editado pelo responsável");
    });

    it("DEM-05: demanda_responsaveis is independently scoped — a direct, non-joined query returns zero rows for a demanda the caller cannot see via demandas", async () => {
      const criador = await createFixtureUser();
      const responsavel = await createFixtureUser();
      const unrelated = await createFixtureWithRole("voluntario_comum");

      const criadorClient = await signInAs(criador);

      const { data: inserted, error: insertError } = await criadorClient
        .from("demandas")
        .insert({
          titulo: "Demanda para checagem de escopo independente",
          prazo: "2027-05-25",
          status: "pendente",
          area: "Pesquisa de Campo",
        })
        .select("id")
        .single();

      expect(insertError).toBeNull();
      const demandaId = inserted!.id as number;
      createdDemandaIds.push(demandaId);

      const { error: linkError } = await criadorClient
        .from("demanda_responsaveis")
        .insert({ demanda_id: demandaId, profile_id: responsavel.id });
      expect(linkError).toBeNull();

      // The unrelated fixture cannot see the demanda via `demandas`...
      const unrelatedClient = await signInAs(unrelated);

      const { data: demandaSelect, error: demandaSelectError } = await unrelatedClient
        .from("demandas")
        .select("id")
        .eq("id", demandaId);
      expect(demandaSelectError).toBeNull();
      expect(demandaSelect ?? []).toHaveLength(0);

      // ...and a DIRECT (non-joined) query against demanda_responsaveis for
      // the same demanda_id must ALSO return zero rows — proving the join
      // table's own policy, not an inherited/cascaded grant from demandas.
      const { data: responsaveisSelect, error: responsaveisSelectError } =
        await unrelatedClient
          .from("demanda_responsaveis")
          .select("profile_id")
          .eq("demanda_id", demandaId);
      expect(responsaveisSelectError).toBeNull();
      expect(responsaveisSelect ?? []).toHaveLength(0);
    });

    it("DEM-05: demandas_com_status view returns exactly the same demanda ids as a direct demandas query, for a lider_area fixture", async () => {
      const lider = await createFixtureWithRole("lider_area");
      await assignArea(lider.id, "Pesquisa");

      const criador = await createFixtureUser();
      const criadorClient = await signInAs(criador);

      const { data: matchInsert, error: matchInsertError } = await criadorClient
        .from("demandas")
        .insert({
          titulo: "Demanda visível via view (Pesquisa)",
          prazo: "2027-05-30",
          status: "pendente",
          area: "Pesquisa",
        })
        .select("id")
        .single();
      expect(matchInsertError).toBeNull();
      const matchDemandaId = matchInsert!.id as number;
      createdDemandaIds.push(matchDemandaId);

      const { data: outOfScopeInsert, error: outOfScopeInsertError } = await criadorClient
        .from("demandas")
        .insert({
          titulo: "Demanda fora de escopo (Financeiro)",
          prazo: "2027-05-31",
          status: "pendente",
          area: "Financeiro",
        })
        .select("id")
        .single();
      expect(outOfScopeInsertError).toBeNull();
      const outOfScopeDemandaId = outOfScopeInsert!.id as number;
      createdDemandaIds.push(outOfScopeDemandaId);

      const liderClient = await signInAs(lider);

      const { data: viaTable, error: viaTableError } = await liderClient
        .from("demandas")
        .select("id")
        .in("id", [matchDemandaId, outOfScopeDemandaId]);
      expect(viaTableError).toBeNull();

      const { data: viaView, error: viaViewError } = await liderClient
        .from("demandas_com_status")
        .select("id")
        .in("id", [matchDemandaId, outOfScopeDemandaId]);
      expect(viaViewError).toBeNull();

      const tableIds = (viaTable ?? []).map((r) => r.id).sort();
      const viewIds = (viaView ?? []).map((r) => r.id).sort();

      expect(viewIds).toEqual(tableIds);
      expect(tableIds).toEqual([matchDemandaId]);
    });

    it("DEM-05: a lider_area cannot self-assign a new área (self-escalation guard), but can view their own existing lider_areas rows", async () => {
      const lider = await createFixtureWithRole("lider_area");
      await assignArea(lider.id, "Pesquisa");

      const liderClient = await signInAs(lider);

      // Denied write: attempting to self-assign a NEW área.
      const { error: insertError } = await liderClient
        .from("lider_areas")
        .insert({ lider_id: lider.id, area: "Financeiro" });

      // RLS returns success-with-zero-rows (not necessarily an error) on a
      // denied write — the sound proof is a service-role re-read confirming
      // no such row exists, not the response shape of the insert itself.
      const { data: rereadDenied, error: rereadDeniedError } = await admin
        .from("lider_areas")
        .select("area")
        .eq("lider_id", lider.id)
        .eq("area", "Financeiro")
        .maybeSingle();

      expect(rereadDeniedError).toBeNull();
      expect(rereadDenied).toBeNull();
      // Surface the insert error for diagnostics without depending on its
      // exact shape being the sole proof of denial.
      void insertError;

      // Allowed read: the líder CAN see their own existing lider_areas row.
      const { data: ownRows, error: ownRowsError } = await liderClient
        .from("lider_areas")
        .select("area")
        .eq("lider_id", lider.id);

      expect(ownRowsError).toBeNull();
      expect((ownRows ?? []).map((r) => r.area)).toEqual(["Pesquisa"]);
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
