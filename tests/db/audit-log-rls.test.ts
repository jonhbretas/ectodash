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

// audit_log (migration 0059): trigger genérico que registra quem fez o quê
// nas tabelas de negócio. A escrita é exclusiva do trigger (SECURITY
// DEFINER); clientes autenticados só leem se forem coordenador_geral.
describe.skipIf(!canRun)(
  "audit_log trigger + RLS (live Supabase project)",
  () => {
    let admin: SupabaseClient;
    const createdUserIds: string[] = [];
    const createdDemandaIds: number[] = [];
    const createdResponsaveisKeys: Array<{
      demanda_id: number;
      profile_id: string;
    }> = [];
    let fixtureCounter = 0;

    admin = createClient(supabaseUrl!, serviceRoleKey!);

    // Mints a unique disposable @example.invalid fixture profile. Uses the
    // admin create call so the suite dispatches no real messages and burns
    // no free-tier email quota. Local copy of this repo's own established
    // fixture pattern (demandas-rls.test.ts).
    async function createFixtureUser() {
      fixtureCounter += 1;
      const email = `ectodash-test-audit-${Date.now()}-${fixtureCounter}@example.invalid`;
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
    // client — same helper shape as demandas-rls.test.ts.
    async function createFixtureWithRole(
      role: "coordenador_geral" | "voluntario_comum"
    ) {
      const fixture = await createFixtureUser();

      if (role !== "voluntario_comum") {
        const { error } = await admin
          .from("profiles")
          .update({ role })
          .eq("id", fixture.id);

        if (error) {
          throw new Error(
            `Failed to set role ${role} on fixture: ${error.message}`
          );
        }
      }

      return fixture;
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

    // Creates a disposable demanda through the given client. The audit
    // trigger must capture this exact operation with the caller as actor.
    async function criarDemanda(
      client: SupabaseClient,
      titulo: string,
      area?: string
    ) {
      const { data, error } = await client
        .from("demandas")
        .insert({
          titulo,
          prazo: "2030-01-01",
          status: "pendente",
          ...(area ? { area } : {}),
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

    async function buscarLogDemanda(demandaId: number) {
      const { data, error } = await admin
        .from("audit_log")
        .select("id, profile_id, acao, entidade_id, before_data, after_data")
        .eq("entidade", "demandas")
        .eq("entidade_id", String(demandaId))
        .order("id", { ascending: true });

      expect(error).toBeNull();
      return data ?? [];
    }

    afterAll(async () => {
      // audit_log é append-only (sem cascade a partir de demandas) — as
      // linhas do log dos fixtures são removidas explicitamente, antes de
      // apagar as demandas para não deixar lixo no log real do projeto.
      for (const id of createdDemandaIds) {
        await admin
          .from("audit_log")
          .delete()
          .eq("entidade", "demandas")
          .eq("entidade_id", String(id));
        await admin.from("demandas").delete().eq("id", id);
      }
      for (const key of createdResponsaveisKeys) {
        await admin
          .from("audit_log")
          .delete()
          .eq("entidade", "demanda_responsaveis")
          .eq("entidade_id", `${key.demanda_id} | ${key.profile_id}`);
      }
      for (const id of createdUserIds) {
        await admin.auth.admin.deleteUser(id);
      }
    });

    it("registra INSERT com o actor = usuário autenticado e o registro novo em after_data", async () => {
      const autor = await createFixtureWithRole("voluntario_comum");
      const autorClient = await signInAs(autor);
      const titulo = `Demanda auditada ${Date.now()}-${fixtureCounter}`;

      const demandaId = await criarDemanda(autorClient, titulo);

      const log = await buscarLogDemanda(demandaId);
      const insertRow = log.find((row) => row.acao === "INSERT");

      expect(insertRow).toBeDefined();
      expect(insertRow?.profile_id).toBe(autor.id);
      expect(insertRow?.entidade_id).toBe(String(demandaId));
      expect(insertRow?.before_data).toBeNull();
      expect(insertRow?.after_data?.titulo).toBe(titulo);
    });

    it("registra UPDATE com before_data/after_data do que mudou, mesmo actor", async () => {
      const autor = await createFixtureWithRole("voluntario_comum");
      const autorClient = await signInAs(autor);
      const tituloOriginal = `Demanda a alterar ${Date.now()}-${fixtureCounter}`;

      const demandaId = await criarDemanda(autorClient, tituloOriginal);

      const tituloNovo = `${tituloOriginal} (alterada)`;
      const { error: updateError } = await autorClient
        .from("demandas")
        .update({ titulo: tituloNovo })
        .eq("id", demandaId);

      expect(updateError).toBeNull();

      const log = await buscarLogDemanda(demandaId);
      const updateRow = log.find((row) => row.acao === "UPDATE");

      expect(updateRow).toBeDefined();
      expect(updateRow?.profile_id).toBe(autor.id);
      expect(updateRow?.before_data?.titulo).toBe(tituloOriginal);
      expect(updateRow?.after_data?.titulo).toBe(tituloNovo);
    });

    it("registra DELETE com before_data e actor = quem removeu (cascade de demanda_responsaveis incluso)", async () => {
      const criador = await createFixtureWithRole("voluntario_comum");
      const criadorClient = await signInAs(criador);
      const coordenador = await createFixtureWithRole("coordenador_geral");
      const coordenadorClient = await signInAs(coordenador);

      const demandaId = await criarDemanda(criadorClient, "Demanda a remover");

      const { error: linkError } = await criadorClient
        .from("demanda_responsaveis")
        .insert({ demanda_id: demandaId, profile_id: criador.id });
      expect(linkError).toBeNull();
      createdResponsaveisKeys.push({ demanda_id: demandaId, profile_id: criador.id });

      const { error: deleteError } = await coordenadorClient
        .from("demandas")
        .delete()
        .eq("id", demandaId);

      expect(deleteError).toBeNull();

      const log = await buscarLogDemanda(demandaId);
      const deleteRow = log.find((row) => row.acao === "DELETE");

      expect(deleteRow).toBeDefined();
      expect(deleteRow?.profile_id).toBe(coordenador.id);
      expect(deleteRow?.before_data?.titulo).toBe("Demanda a remover");
      expect(deleteRow?.after_data).toBeNull();

      // Cascade: o DELETE da demanda arrasta demanda_responsaveis, e o
      // trigger filho registra com entidade_id composta e o MESMO actor.
      // A query retorna as linhas do link todo (INSERT feito acima + o
      // DELETE em cascata) — a de DELETE é a que importa.
      const { data: cascadeRows } = await admin
        .from("audit_log")
        .select("acao, profile_id, entidade_id")
        .eq("entidade", "demanda_responsaveis")
        .eq("entidade_id", `${demandaId} | ${criador.id}`)
        .order("id", { ascending: true });

      const cascadeDelete = (cascadeRows ?? []).find(
        (row) => row.acao === "DELETE"
      );

      expect(cascadeDelete).toBeDefined();
      expect(cascadeDelete?.profile_id).toBe(coordenador.id);
    });

    it("escrita de service role (sem sessão) registra profile_id NULL = Sistema", async () => {
      // criado_por é NOT NULL com default auth.uid() (0003) — o service
      // role não tem sessão, então o fixture passa o criador explicitamente.
      const autor = await createFixtureUser();

      const { data: demanda, error: insertError } = await admin
        .from("demandas")
        .insert({
          titulo: "Demanda de sistema",
          prazo: "2030-01-01",
          status: "pendente",
          criado_por: autor.id,
        })
        .select("id")
        .single();

      expect(insertError).toBeNull();
      const demandaId = demanda!.id as number;
      createdDemandaIds.push(demandaId);

      const log = await buscarLogDemanda(demandaId);
      const insertRow = log.find((row) => row.acao === "INSERT");

      expect(insertRow).toBeDefined();
      expect(insertRow?.profile_id).toBeNull();
    });

    it("RLS: voluntario_comum não lê nem escreve audit_log; coordenador_geral lê", async () => {
      const comum = await createFixtureWithRole("voluntario_comum");
      const comumClient = await signInAs(comum);
      const coordenador = await createFixtureWithRole("coordenador_geral");
      const coordenadorClient = await signInAs(coordenador);

      // Uma ação real existe no log (criada pelo próprio voluntário) para a
      // leitura restrita ser testada contra dados de verdade.
      const demandaId = await criarDemanda(comumClient, "Demanda para RLS");

      const { data: comumRead, error: comumReadError } = await comumClient
        .from("audit_log")
        .select("id");

      // RLS filtra em vez de falhar — vazio, nunca erro (padrão
        // profiles-trigger.test.ts).
      expect(comumReadError).toBeNull();
      expect(comumRead ?? []).toHaveLength(0);

      // Sem policy de INSERT, forjar uma linha de log é negado pelo RLS.
      const { error: comumInsertError } = await comumClient
        .from("audit_log")
        .insert({ acao: "INSERT", entidade: "forjada" });

      expect(comumInsertError).not.toBeNull();

      const { data: coordRead, error: coordReadError } = await coordenadorClient
        .from("audit_log")
        .select("id, acao, entidade, entidade_id, profile_id")
        .eq("entidade_id", String(demandaId))
        .eq("entidade", "demandas");

      expect(coordReadError).toBeNull();
      expect(coordRead ?? []).toHaveLength(1);
      expect(coordRead?.[0]?.acao).toBe("INSERT");
      expect(coordRead?.[0]?.profile_id).toBe(comum.id);
    });
  }
);

if (!canRun) {
  describe("audit_log trigger + RLS (live Supabase project)", () => {
    it.skip("SUPABASE_SERVICE_ROLE_KEY (or other required project env vars) not set — skipping live database integration tests", () => {
      // Intentionally empty: this test exists only to surface a visible skip
      // message when the hosted-project credentials are unavailable.
    });
  });
}
