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

// Live-project RLS + SECURITY DEFINER function tests for migration 0043's
// access-levels model (cargos = nível + escopo):
//   - coordena_area / coordena_localidade scoping over demandas and the
//     voluntarios roster (incl. área inheritance for coordenador_geral_area);
//   - cargo grant/revoke: coordenador_geral grants anything, a
//     coordenador_geral_area only within its own área tree, a
//     coordenador_localidade only its own localidade; self-management and
//     autopromoção are blocked by construction;
//   - the SECURITY DEFINER roster write path (criar_voluntario /
//     atualizar_voluntario) accepts cargo-based coordinators without ever
//     letting them assign roles, pinning new volunteers to their área.
describe.skipIf(!canRun)(
  "cargos de acesso RLS + functions (live Supabase project)",
  () => {
    let admin: SupabaseClient;
    const createdUserIds: string[] = [];
    const createdVoluntarioIds: number[] = [];
    const createdAreaIds: number[] = [];
    const createdLocalidadeIds: number[] = [];
    let fixtureCounter = 0;
    const unique = () =>
      `${Date.now()}-${(fixtureCounter += 1)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;

    admin = createClient(supabaseUrl!, serviceRoleKey!);

    async function createUser() {
      const email = `ectodash-test-cargo-${unique()}@example.invalid`;
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
      return { id: data.user.id, email, password };
    }

    async function setRole(id: string, role: string) {
      const { error } = await admin
        .from("profiles")
        .update({ role })
        .eq("id", id);
      if (error) {
        throw new Error(`Failed to set role: ${error.message}`);
      }
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

    async function createArea(nome: string, criadoPor: string, areaMaeId: number | null = null) {
      const { data, error } = await admin
        .from("areas_institucionais")
        .insert({ nome, area_mae_id: areaMaeId, criado_por: criadoPor })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(`Failed to create area: ${error?.message}`);
      }
      createdAreaIds.push(data.id);
      return data.id as number;
    }

    async function createLocalidade(nome: string, criadoPor: string) {
      const { data, error } = await admin
        .from("voluntario_localidades")
        .insert({ nome, criado_por: criadoPor })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(`Failed to create localidade: ${error?.message}`);
      }
      createdLocalidadeIds.push(data.id);
      return data.id as number;
    }

    // criado_por is NOT NULL with default auth.uid() — the service-role
    // admin has no session, so the creator is explicit in every fixture.
    async function createCargo(
      profileId: string,
      nivel: string,
      areaId: number | null,
      localidadeId: number | null,
      modulos: string[] = []
    ) {
      const { data, error } = await admin
        .from("cargos")
        .insert({
          profile_id: profileId,
          nivel,
          area_id: areaId,
          localidade_id: localidadeId,
          criado_por: profileId,
        })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(`Failed to create cargo: ${error?.message}`);
      }
      if (modulos.length) {
        const { error: err } = await admin
          .from("cargo_modulos")
          .insert(modulos.map((m) => ({ cargo_id: data.id, modulo: m })));
        if (err) {
          throw new Error(`Failed to create cargo modulos: ${err.message}`);
        }
      }
      return data.id as number;
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

    async function createDemanda(
      titulo: string,
      area: string | null,
      criadoPor: string
    ) {
      const { data, error } = await admin
        .from("demandas")
        .insert({ titulo, area, criado_por: criadoPor, prazo: "2026-12-31" })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(`Failed to create demanda: ${error?.message}`);
      }
      return data.id as number;
    }

    afterAll(async () => {
      for (const id of createdVoluntarioIds) {
        await admin.from("voluntarios").delete().eq("id", id);
      }
      for (const id of createdLocalidadeIds) {
        await admin.from("voluntario_localidades").delete().eq("id", id);
      }
      for (const id of createdAreaIds) {
        await admin.from("areas_institucionais").delete().eq("id", id);
      }
      for (const id of createdUserIds) {
        await admin.auth.admin.deleteUser(id);
      }
    });

    it("coordenador_area (cargo) vê e edita demandas da própria área; nada de outra área", async () => {
      const coord = await createUser();
      const areaANome = `Área A ${unique()}`;
      const areaBNome = `Área B ${unique()}`;
      const areaA = await createArea(areaANome, coord.id);
      const areaB = await createArea(areaBNome, coord.id);

      await createCargo(coord.id, "coordenador_area", areaA, null, [
        "demandas",
      ]);

      const dA = await createDemanda(`DA ${unique()}`, areaANome, coord.id);
      const outro = await createUser();
      const dB = await createDemanda(`DB ${unique()}`, areaBNome, outro.id);

      const client = await signInAs(coord);
      const { data: visiveis, error: selErr } = await client
        .from("demandas")
        .select("id");
      expect(selErr).toBeNull();
      const ids = (visiveis ?? []).map((r: { id: number }) => r.id);
      expect(ids).toContain(dA);
      expect(ids).not.toContain(dB);

      const { data: updOk, error: updErr } = await client
        .from("demandas")
        .update({ descricao: "editada pelo coordenador de área" })
        .eq("id", dA)
        .select("id");
      expect(updErr).toBeNull();
      expect(updOk ?? []).toHaveLength(1);

      const { data: updDenied, error: updDeniedErr } = await client
        .from("demandas")
        .update({ descricao: "não deveria passar" })
        .eq("id", dB)
        .select("id");
      expect(updDeniedErr).toBeNull();
      expect(updDenied ?? []).toHaveLength(0);
    });

    it("coordenador_geral_area herda sub-áreas; coordenador_area não", async () => {
      const geralArea = await createUser();
      const paiNome = `Pai ${unique()}`;
      const filhaNome = `Filha ${unique()}`;
      const pai = await createArea(paiNome, geralArea.id);
      const filha = await createArea(filhaNome, geralArea.id, pai);

      await createCargo(geralArea.id, "coordenador_geral_area", pai, null);
      const simples = await createUser();
      await createCargo(simples.id, "coordenador_area", pai, null);

      const dPai = await createDemanda(`DPai ${unique()}`, paiNome, geralArea.id);
      const dFilha = await createDemanda(`DFilha ${unique()}`, filhaNome, geralArea.id);

      const geralClient = await signInAs(geralArea);
      const { data: geralVisiveis } = await geralClient
        .from("demandas")
        .select("id");
      const geralIds = (geralVisiveis ?? []).map((r: { id: number }) => r.id);
      expect(geralIds).toContain(dPai);
      expect(geralIds).toContain(dFilha);

      const simplesClient = await signInAs(simples);
      const { data: simplesVisiveis } = await simplesClient
        .from("demandas")
        .select("id");
      const simplesIds = (simplesVisiveis ?? []).map((r: { id: number }) => r.id);
      expect(simplesIds).toContain(dPai);
      expect(simplesIds).not.toContain(dFilha);
    });

    it("roster: cargo de área vê só a própria área; cargo de localidade vê por localidade", async () => {
      const areaCoord = await createUser();
      const areaNome = `Área Roster ${unique()}`;
      const outraAreaNome = `Outra Área ${unique()}`;
      const area = await createArea(areaNome, areaCoord.id);
      await createArea(outraAreaNome, areaCoord.id);
      const localidadeNome = `Loc ${unique()}`;
      const localidade = await createLocalidade(localidadeNome, areaCoord.id);

      const meuVol = await createVoluntario({
        nome: `Meu ${unique()}`,
        area_atuacao: areaNome,
      });
      const outroVol = await createVoluntario({
        nome: `Outro ${unique()}`,
        area_atuacao: outraAreaNome,
      });
      const locVol = await createVoluntario({
        nome: `Loc ${unique()}`,
        unidade: localidadeNome,
      });

      await createCargo(areaCoord.id, "coordenador_area", area, null);
      const areaClient = await signInAs(areaCoord);
      const { data: areaScoped } = await areaClient
        .from("voluntarios")
        .select("id");
      const areaIds = (areaScoped ?? []).map((r: { id: number }) => r.id);
      expect(areaIds).toContain(meuVol);
      expect(areaIds).not.toContain(outroVol);

      const locCoord = await createUser();
      await createCargo(locCoord.id, "coordenador_localidade", null, localidade);
      const locClient = await signInAs(locCoord);
      const { data: locScoped } = await locClient
        .from("voluntarios")
        .select("id");
      const locIds = (locScoped ?? []).map((r: { id: number }) => r.id);
      expect(locIds).toContain(locVol);
      expect(locIds).not.toContain(meuVol);
    });

    it("gestão de cargos: geral concede qualquer; geral de área só na árvore; voluntário comum nada", async () => {
      const gestor = await createUser();
      const paiNome = `Pai Gestão ${unique()}`;
      const foraNome = `Fora ${unique()}`;
      const pai = await createArea(paiNome, gestor.id);
      await createArea(foraNome, gestor.id);
      const filha = await createArea(`Filha Gestão ${unique()}`, gestor.id, pai);

      const alvo = await createUser();

      // coordenador_geral concede um cargo qualquer.
      const geral = await createUser();
      await setRole(geral.id, "coordenador_geral");
      const geralClient = await signInAs(geral);
      const { error: errGeral } = await geralClient.from("cargos").insert({
        profile_id: alvo.id,
        nivel: "coordenador_area",
        area_id: filha,
      }).select("id");
      expect(errGeral).toBeNull();

      // coordenador_geral_area de Pai concede dentro da árvore (Filha)…
      await createCargo(gestor.id, "coordenador_geral_area", pai, null);
      const gestorClient = await signInAs(gestor);
      const { data: dentro, error: errDentro } = await gestorClient.from("cargos").insert({
        profile_id: alvo.id,
        nivel: "coordenador_geral_area",
        area_id: filha,
      }).select("id");
      expect(errDentro).toBeNull();
      expect(dentro ?? []).toHaveLength(1);

      // …mas é barrado fora da árvore (PostgREST pode devolver 42501 ou
      // lista vazia conforme a versão — qualquer um dos dois = negado).
      const { data: foraInsert, error: errFora } = await gestorClient
        .from("cargos")
        .insert({
          profile_id: alvo.id,
          nivel: "coordenador_area",
          area_id: pai,
        }).select("id");
      expect(errFora !== null || (foraInsert ?? []).length === 0).toBe(true);

      // Um voluntário comum sem cargos não concede nada.
      const comum = await createUser();
      const comumClient = await signInAs(comum);
      const { data: comumInsert, error: errComum } = await comumClient
        .from("cargos")
        .insert({
          profile_id: alvo.id,
          nivel: "coordenador_area",
          area_id: filha,
        }).select("id");
      expect(errComum !== null || (comumInsert ?? []).length === 0).toBe(true);
    });

    it("gestor de escopo edita/exclui cargos do alvo, nunca os próprios", async () => {
      const gestor = await createUser();
      const paiNome = `Pai Gerir ${unique()}`;
      const filhaNome = `Filha Gerir ${unique()}`;
      const pai = await createArea(paiNome, gestor.id);
      const filha = await createArea(filhaNome, gestor.id, pai);

      const gestorCargo = await createCargo(
        gestor.id,
        "coordenador_geral_area",
        pai,
        null
      );
      const alvo = await createUser();
      const alvoCargo = await createCargo(
        alvo.id,
        "coordenador_area",
        filha,
        null
      );

      const gestorClient = await signInAs(gestor);

      // O gestor enxerga os cargos do alvo (SELECT)…
      const { data: visiveis } = await gestorClient
        .from("cargos")
        .select("id");
      const ids = (visiveis ?? []).map((r: { id: number }) => r.id);
      expect(ids).toContain(alvoCargo);

      // …e pode excluir o cargo do alvo (dentro da árvore).
      const { data: del, error: delErr } = await gestorClient
        .from("cargos")
        .delete()
        .eq("id", alvoCargo)
        .select("id");
      expect(delErr).toBeNull();
      expect(del ?? []).toHaveLength(1);

      // Mas nunca o próprio cargo (autogestão bloqueada: me <> alvo).
      const { data: delSelf, error: delSelfErr } = await gestorClient
        .from("cargos")
        .delete()
        .eq("id", gestorCargo)
        .select("id");
      expect(delSelfErr).toBeNull();
      expect(delSelf ?? []).toHaveLength(0);
    });

    it("criar/atualizar voluntário por cargo: pinagem na área e teto de papel", async () => {
      const coord = await createUser();
      const areaNome = `Área Func ${unique()}`;
      const foraNome = `Área Fora Func ${unique()}`;
      const area = await createArea(areaNome, coord.id);
      await createArea(foraNome, coord.id);

      await createCargo(coord.id, "coordenador_area", area, null);
      const client = await signInAs(coord);

      // Criar fora da própria área é negado…
      const { data: negado } = await client.rpc("criar_voluntario", {
        p_nome: `Fora ${unique()}`,
        p_codigo_pf: null,
        p_unidade: null,
        p_org_depto: null,
        p_funcao: null,
        p_data_inicio: null,
        p_data_saida: null,
        p_obs: null,
        p_area_atuacao: foraNome,
        p_papel: null,
        p_areas_lideradas: [],
        p_telefone1: null,
        p_telefone2: null,
      });
      expect(negado).toBeNull();

      // …e criar dentro pin para a própria área, sem papel.
      const { data: novoId, error: errNovo } = await client.rpc(
        "criar_voluntario",
        {
          p_nome: `Da Área ${unique()}`,
          p_codigo_pf: null,
          p_unidade: null,
          p_org_depto: null,
          p_funcao: null,
          p_data_inicio: null,
          p_data_saida: null,
          p_obs: null,
          p_area_atuacao: areaNome,
          p_papel: "financeiro",
          p_areas_lideradas: ["x"],
          p_telefone1: null,
          p_telefone2: null,
        }
      );
      expect(errNovo).toBeNull();
      expect(novoId).toBeTruthy();
      createdVoluntarioIds.push(novoId as number);

      const { data: linha } = await admin
        .from("voluntarios")
        .select("area_atuacao, role, area_id")
        .eq("id", novoId!)
        .single();
      expect(linha?.area_atuacao).toBe(areaNome);
      expect(linha?.area_id).toBe(area);
      expect(linha?.role).toBe("voluntario_comum");

      // Atualizar linha da própria área funciona; de outra área, não.
      const meuVol = await createVoluntario({
        nome: `Editar ${unique()}`,
        area_atuacao: areaNome,
      });
      const outroVol = await createVoluntario({
        nome: `Editar Fora ${unique()}`,
        area_atuacao: foraNome,
      });
      const { data: okEditar } = await client.rpc("atualizar_voluntario", {
        p_cadastro_id: meuVol,
        p_nome: `Editado ${unique()}`,
        p_codigo_pf: null,
        p_unidade: null,
        p_org_depto: null,
        p_funcao: null,
        p_data_inicio: null,
        p_data_saida: null,
        p_obs: null,
        p_area_atuacao: areaNome,
        p_papel: null,
        p_areas_lideradas: [],
        p_ativo: true,
        p_telefone1: null,
        p_telefone2: null,
      });
      expect(okEditar).toBe(true);

      const { data: negadoEditar } = await client.rpc("atualizar_voluntario", {
        p_cadastro_id: outroVol,
        p_nome: `Editado ${unique()}`,
        p_codigo_pf: null,
        p_unidade: null,
        p_org_depto: null,
        p_funcao: null,
        p_data_inicio: null,
        p_data_saida: null,
        p_obs: null,
        p_area_atuacao: foraNome,
        p_papel: null,
        p_areas_lideradas: [],
        p_ativo: true,
        p_telefone1: null,
        p_telefone2: null,
      });
      expect(negadoEditar).toBe(false);
    });

    it("coordenador_localidade concede cargos só da própria localidade", async () => {
      const gestor = await createUser();
      const locANome = `Loc A ${unique()}`;
      const locBNome = `Loc B ${unique()}`;
      const locA = await createLocalidade(locANome, gestor.id);
      const locB = await createLocalidade(locBNome, gestor.id);

      await createCargo(gestor.id, "coordenador_localidade", null, locA);
      const alvo = await createUser();

      const gestorClient = await signInAs(gestor);
      const { error: errDentro } = await gestorClient.from("cargos").insert({
        profile_id: alvo.id,
        nivel: "coordenador_localidade",
        localidade_id: locA,
      });
      expect(errDentro).toBeNull();

      const { error: errFora } = await gestorClient.from("cargos").insert({
        profile_id: alvo.id,
        nivel: "coordenador_localidade",
        localidade_id: locB,
      });
      expect(errFora).toBeNull();

      // Verificação pelo lado do admin: só o cargo da localidade A entrou
      // (o RETURNING do primeiro cargo do alvo é filtrado pela política de
      // SELECT — o alvo ainda não tem cargo no escopo do gestor).
      const { data: concedidos } = await admin
        .from("cargos")
        .select("localidade_id")
        .eq("profile_id", alvo.id);
      const locs = (concedidos ?? []).map((r: { localidade_id: number }) => r.localidade_id);
      expect(locs).toEqual([locA]);
    });
  }
);

if (!canRun) {
  describe("cargos de acesso RLS + functions (live Supabase project)", () => {
    it.skip("SUPABASE_SERVICE_ROLE_KEY (or other required project env vars) not set — skipping live database integration tests", () => {
      // Intentionally empty: surfaces a visible skip message when the
      // hosted-project credentials are unavailable.
    });
  });
}
