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
  | "coordenador_area"
  | "voluntario_comum"
  | "financeiro"
  | "voluntariado";

// Live-project RLS + SECURITY DEFINER function tests for migration 0017's
// institutional roster (public.voluntarios): roster visibility by role, the
// self-link flow (vincular_meu_cadastro / criar_meu_cadastro /
// buscar_voluntarios) and the coordinator write path (criar_voluntario /
// atualizar_voluntario) — including the role-assignment cap and the
// coordenador_area área scope.
describe.skipIf(!canRun)(
  "voluntarios roster RLS + functions (live Supabase project)",
  () => {
    let admin: SupabaseClient;
    const createdUserIds: string[] = [];
    const createdVoluntarioIds: number[] = [];
    let fixtureCounter = 0;
    const unique = () =>
      `${Date.now()}-${(fixtureCounter += 1)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;

    admin = createClient(supabaseUrl!, serviceRoleKey!);

    async function createUser(role: AppRole) {
      const email = `ectodash-test-vol-${role}-${unique()}@example.invalid`;
      const password = `Test-${unique()}!`;

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw new Error(`Failed to create fixture: ${error?.message}`);
      }
      createdUserIds.push(data.user.id);

      if (role !== "voluntario_comum") {
        const { error: updateError } = await admin
          .from("profiles")
          .update({ role })
          .eq("id", data.user.id);
        if (updateError) {
          throw new Error(`Failed to set role: ${updateError.message}`);
        }
      }

      return { id: data.user.id, email, password };
    }

    async function signInAs(fixture: { email: string; password: string }) {
      const client = createClient(supabaseUrl!, anonKey!);
      const { error } = await client.auth.signInWithPassword({
        email: fixture.email,
        password: fixture.password,
      });
      if (error) {
        throw new Error(`Failed to sign in: ${error.message}`);
      }
      return client;
    }

    async function createVoluntario(payload: Record<string, unknown>) {
      const { data, error } = await admin
        .from("voluntarios")
        .insert({ ativo: true, ...payload })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(`Failed to create voluntario: ${error?.message}`);
      }
      createdVoluntarioIds.push(data.id);
      return data.id as number;
    }

    afterAll(async () => {
      for (const id of createdVoluntarioIds) {
        await admin.from("voluntarios").delete().eq("id", id);
      }
      for (const id of createdUserIds) {
        await admin.auth.admin.deleteUser(id);
      }
    });

    it("voluntariado can SELECT every roster row; voluntario_comum sees none; coordenador_area only its own área", async () => {
      const myArea = `Área ${unique()}`;
      const otherArea = `Área ${unique()}`;
      const myRow = await createVoluntario({ nome: `Meu ${unique()}`, area_atuacao: myArea });
      const otherRow = await createVoluntario({ nome: `Outro ${unique()}`, area_atuacao: otherArea });

      const voluntariado = await createUser("voluntariado");
      const comum = await createUser("voluntario_comum");
      const areaCoord = await createUser("coordenador_area");
      await admin.from("lider_areas").insert({ lider_id: areaCoord.id, area: myArea });

      // voluntariado sees every roster row that exists in the project
      // (including the real seeded volunteers), so the assertion is
      // "superset of everything this suite created", never an exact count.
      const voluntariadoClient = await signInAs(voluntariado);
      const { data: all, error: allError } = await voluntariadoClient
        .from("voluntarios")
        .select("id");
      expect(allError).toBeNull();
      expect((all ?? []).length).toBeGreaterThanOrEqual(
        createdVoluntarioIds.length
      );
      const allIds = (all ?? []).map((row: { id: number }) => row.id);
      expect(allIds).toContain(myRow);
      expect(allIds).toContain(otherRow);

      const comumClient = await signInAs(comum);
      const { data: none, error: noneError } = await comumClient
        .from("voluntarios")
        .select("id");
      expect(noneError).toBeNull();
      expect(none ?? []).toHaveLength(0);

      const areaClient = await signInAs(areaCoord);
      const { data: scoped, error: scopedError } = await areaClient
        .from("voluntarios")
        .select("id");
      expect(scopedError).toBeNull();
      const scopedIds = (scoped ?? []).map((row: { id: number }) => row.id);
      expect(scopedIds).toContain(myRow);
      expect(scopedIds).not.toContain(otherRow);
    });

    it("vincular_meu_cadastro links the caller's account and applies the intended role, capped at voluntario_comum for coordenador_geral rows", async () => {
      const financeiroRow = await createVoluntario({
        nome: `Financeiro ${unique()}`,
        role: "financeiro",
      });
      const geralRow = await createVoluntario({
        nome: `Geral ${unique()}`,
        role: "coordenador_geral",
      });

      const volunteer = await createUser("voluntario_comum");

      const client = await signInAs(volunteer);
      const { data: okFinanceiro, error: err1 } = await client.rpc("vincular_meu_cadastro", { cadastro_id: financeiroRow }
      );
      expect(err1).toBeNull();
      expect(okFinanceiro).toBe(true);

      const { data: roleAfter, error: readErr } = await admin
        .from("profiles")
        .select("role, voluntario_id, vincular_pendente")
        .eq("id", volunteer.id)
        .single();
      expect(readErr).toBeNull();
      expect(roleAfter?.role).toBe("financeiro");
      expect(roleAfter?.voluntario_id).toBe(financeiroRow);
      expect(roleAfter?.vincular_pendente).toBe(false);

      // The intended role coordenador_geral must NEVER be auto-granted.
      const second = await createUser("voluntario_comum");
      const secondClient = await signInAs(second);
      const { data: okGeral, error: err2 } = await secondClient.rpc("vincular_meu_cadastro", { cadastro_id: geralRow }
      );
      expect(err2).toBeNull();
      expect(okGeral).toBe(true);

      const { data: secondRole } = await admin
        .from("profiles")
        .select("role")
        .eq("id", second.id)
        .single();
      expect(secondRole?.role).toBe("voluntario_comum");
    });

    it("a roster row can be linked only once; a non-pending caller cannot link anything", async () => {
      const row = await createVoluntario({ nome: `Unico ${unique()}` });

      const first = await createUser("voluntario_comum");
      const firstClient = await signInAs(first);
      const { data: ok1 } = await firstClient.rpc("vincular_meu_cadastro", {
        cadastro_id: row,
      });
      expect(ok1).toBe(true);

      // Second account trying the same row — the row is already taken.
      const second = await createUser("voluntario_comum");
      const secondClient = await signInAs(second);
      const { data: ok2, error: err2 } = await secondClient.rpc(
        "vincular_meu_cadastro",
        { cadastro_id: row }
      );
      expect(err2).toBeNull();
      expect(ok2).toBe(false);

      // An already-linked (or pre-existing) account has pendente=false and
      // cannot link anything else.
      const { data: ok3, error: err3 } = await firstClient.rpc(
        "vincular_meu_cadastro",
        { cadastro_id: row }
      );
      expect(err3).toBeNull();
      expect(ok3).toBe(false);
    });

    it("criar_meu_cadastro creates a fresh roster row and links the caller", async () => {
      const volunteer = await createUser("voluntario_comum");
      const client = await signInAs(volunteer);

      const { data: ok, error } = await client.rpc("criar_meu_cadastro", {
        nome: `Novo Cadastro ${unique()}`,
      });
      expect(error).toBeNull();
      expect(ok).toBe(true);

      const { data: profile } = await admin
        .from("profiles")
        .select("voluntario_id, vincular_pendente, full_name")
        .eq("id", volunteer.id)
        .single();
      expect(profile?.voluntario_id).toBeTruthy();
      expect(profile?.vincular_pendente).toBe(false);
      expect(profile?.full_name).toBeTruthy();

      const { data: row } = await admin
        .from("voluntarios")
        .select("nome, ativo")
        .eq("id", profile!.voluntario_id!)
        .single();
      expect(row?.ativo).toBe(true);
    });

    it("buscar_voluntarios only answers while vincular_pendente is set and excludes already-linked rows", async () => {
      const row = await createVoluntario({ nome: `Busca ${unique()}`, unidade: "Teste" });

      const pending = await createUser("voluntario_comum");
      const pendingClient = await signInAs(pending);
      const { data: found, error: err1 } = await pendingClient.rpc(
        "buscar_voluntarios",
        { termo: "Busca" }
      );
      expect(err1).toBeNull();
      expect((found ?? []).some((m: { cadastro_id: number }) => m.cadastro_id === row)).toBe(true);

      // After linking, the search no longer answers at all.
      const { data: okLink } = await pendingClient.rpc("vincular_meu_cadastro", {
        cadastro_id: row,
      });
      expect(okLink).toBe(true);

      const { data: after, error: err2 } = await pendingClient.rpc(
        "buscar_voluntarios",
        { termo: "Busca" }
      );
      expect(err2).toBeNull();
      expect(after ?? []).toHaveLength(0);
    });

    it("criar_voluntario: voluntariado and coordenador_geral can create; voluntario_comum is denied; coordenador_area is pinned to their own área", async () => {
      const myArea = `Área Criar ${unique()}`;
      const manager = await createUser("voluntariado");
      const managerClient = await signInAs(manager);
      const { data: managerNewId, error: managerErr } = await managerClient.rpc("criar_voluntario", {
          p_nome: `Criado ${unique()}`,
          p_codigo_pf: null,
          p_unidade: null,
          p_org_depto: null,
          p_funcao: null,
          p_data_inicio: null,
          p_data_saida: null,
          p_obs: null,
          p_area_atuacao: myArea,
          p_papel: "coordenador_geral", // ignored — manager is not geral
          p_areas_lideradas: [],
          p_telefone1: null,
          p_telefone2: null,
        }
      );
      expect(managerErr).toBeNull();
      expect(managerNewId).toBeTruthy();
      createdVoluntarioIds.push(managerNewId as number);

      const { data: stored } = await admin
        .from("voluntarios")
        .select("role")
        .eq("id", managerNewId!)
        .single();
      expect(stored?.role).toBe("voluntario_comum");

      const comum = await createUser("voluntario_comum");
      const comumClient = await signInAs(comum);
      const { data: denied, error: deniedErr } = await comumClient.rpc("criar_voluntario", {
          p_nome: `Negado ${unique()}`,
          p_codigo_pf: null,
          p_unidade: null,
          p_org_depto: null,
          p_funcao: null,
          p_data_inicio: null,
          p_data_saida: null,
          p_obs: null,
          p_area_atuacao: myArea,
          p_papel: null,
          p_areas_lideradas: [],
          p_telefone1: null,
          p_telefone2: null,
        }
      );
      expect(deniedErr).toBeNull();
      expect(denied).toBeNull();

      const areaCoord = await createUser("coordenador_area");
      await admin.from("lider_areas").insert({ lider_id: areaCoord.id, area: myArea });
      const areaClient = await signInAs(areaCoord);

      // Creating outside their own área is DENIED outright (the manager
      // gate checks the passed área before anything else).
      const { data: deniedArea, error: deniedAreaErr } = await areaClient.rpc("criar_voluntario", {
          p_nome: `De Outra Área ${unique()}`,
          p_codigo_pf: null,
          p_unidade: null,
          p_org_depto: null,
          p_funcao: null,
          p_data_inicio: null,
          p_data_saida: null,
          p_obs: null,
          p_area_atuacao: "Outra área qualquer",
          p_papel: null,
          p_areas_lideradas: [],
          p_telefone1: null,
          p_telefone2: null,
        }
      );
      expect(deniedAreaErr).toBeNull();
      expect(deniedArea).toBeNull();

      // Creating in their own área succeeds — but role stays
      // voluntario_comum and areas_lideradas stays empty: a
      // coordenador_area can never assign roles.
      const { data: areaNewId, error: areaErr } = await areaClient.rpc("criar_voluntario", {
          p_nome: `Da Área ${unique()}`,
          p_codigo_pf: null,
          p_unidade: null,
          p_org_depto: null,
          p_funcao: null,
          p_data_inicio: null,
          p_data_saida: null,
          p_obs: null,
          p_area_atuacao: myArea,
          p_papel: "financeiro", // must be ignored
          p_areas_lideradas: ["x"],
          p_telefone1: null,
          p_telefone2: null,
        }
      );
      expect(areaErr).toBeNull();
      expect(areaNewId).toBeTruthy();
      createdVoluntarioIds.push(areaNewId as number);

      const { data: areaRow } = await admin
        .from("voluntarios")
        .select("area_atuacao, role, areas_lideradas")
        .eq("id", areaNewId!)
        .single();
      expect(areaRow?.area_atuacao).toBe(myArea);
      expect(areaRow?.role).toBe("voluntario_comum");
      expect(areaRow?.areas_lideradas).toEqual([]);
    });

    it("atualizar_voluntario: voluntariado can edit data but never roles; coordenador_geral can assign roles", async () => {
      const row = await createVoluntario({
        nome: `Editar ${unique()}`,
        area_atuacao: "Voluntariado",
        role: "voluntario_comum",
      });

      const manager = await createUser("voluntariado");
      const managerClient = await signInAs(manager);
      const { data: okEdit, error: err1 } = await managerClient.rpc("atualizar_voluntario", {
          p_cadastro_id: row,
          p_nome: `Editado ${unique()}`,
          p_codigo_pf: null,
          p_unidade: "São Paulo",
          p_org_depto: null,
          p_funcao: "Monitoria DIP",
          p_data_inicio: null,
          p_data_saida: null,
          p_obs: null,
          p_area_atuacao: "Voluntariado",
          p_papel: "coordenador_geral", // must be ignored for non-geral
          p_areas_lideradas: ["Tentativa"],
          p_ativo: true,
          p_telefone1: null,
          p_telefone2: null,
        }
      );
      expect(err1).toBeNull();
      expect(okEdit).toBe(true);

      const { data: afterManager } = await admin
        .from("voluntarios")
        .select("nome, unidade, funcao, role, areas_lideradas")
        .eq("id", row)
        .single();
      expect(afterManager?.unidade).toBe("São Paulo");
      expect(afterManager?.funcao).toBe("Monitoria DIP");
      expect(afterManager?.role).toBe("voluntario_comum");
      expect(afterManager?.areas_lideradas).toEqual([]);

      const geral = await createUser("coordenador_geral");
      const geralClient = await signInAs(geral);
      const { data: okRole, error: err2 } = await geralClient.rpc("atualizar_voluntario", {
          p_cadastro_id: row,
          p_nome: afterManager!.nome,
          p_codigo_pf: null,
          p_unidade: afterManager!.unidade,
          p_org_depto: null,
          p_funcao: afterManager!.funcao,
          p_data_inicio: null,
          p_data_saida: null,
          p_obs: null,
          p_area_atuacao: "Voluntariado",
          p_papel: "financeiro",
          p_areas_lideradas: [],
          p_ativo: true,
          p_telefone1: null,
          p_telefone2: null,
        }
      );
      expect(err2).toBeNull();
      expect(okRole).toBe(true);

      const { data: afterGeral } = await admin
        .from("voluntarios")
        .select("role")
        .eq("id", row)
        .single();
      expect(afterGeral?.role).toBe("financeiro");
    });
  }
);

if (!canRun) {
  describe("voluntarios roster RLS + functions (live Supabase project)", () => {
    it.skip("SUPABASE_SERVICE_ROLE_KEY (or other required project env vars) not set — skipping live database integration tests", () => {
      // Intentionally empty: surfaces a visible skip message when the
      // hosted-project credentials are unavailable.
    });
  });
}
