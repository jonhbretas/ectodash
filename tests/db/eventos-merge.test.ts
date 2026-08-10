import { afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Live-project integration tests for migration 0046's merge function
// (public.mesclar_eventos): references of the duplicated event (demandas,
// contratos, PROEP editions, Drive folder config) move to the definitive
// event, the duplicate is deleted, and only coordenador_geral can run it.
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not found — rely on real environment variables (e.g. CI secrets).
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(supabaseUrl && anonKey && serviceRoleKey);

describe.skipIf(!canRun)(
  "mesclar_eventos merge (live Supabase project)",
  () => {
    let admin: SupabaseClient;
    const createdUserIds: string[] = [];
    const createdEventoIds: number[] = [];
    const createdDemandaIds: number[] = [];
    const createdContratoIds: number[] = [];
    const createdModeloIds: number[] = [];
    const createdProepStudentIds: string[] = [];
    const createdTipoIds: number[] = [];
    let fixtureCounter = 0;
    const unique = () =>
      `${Date.now()}-${(fixtureCounter += 1)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;

    admin = createClient(supabaseUrl!, serviceRoleKey!);

    async function createUser(role: "coordenador_geral" | "voluntario_comum") {
      const email = `ectodash-test-evt-${role}-${unique()}@example.invalid`;
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

    async function createEvento(
      criadoPor: string,
      payload: { titulo: string; data_evento: string; local?: string | null; descricao?: string | null }
    ) {
      const { data, error } = await admin
        .from("eventos")
        .insert({ criado_por: criadoPor, ...payload })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(`Failed to create evento: ${error?.message}`);
      }
      createdEventoIds.push(data.id);
      return data.id as number;
    }

    async function createDemanda(criadoPor: string, eventoId: number, titulo: string) {
      const { data, error } = await admin
        .from("demandas")
        .insert({
          titulo,
          prazo: "2026-12-31",
          status: "pendente",
          criado_por: criadoPor,
          evento_id: eventoId,
        })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(`Failed to create demanda: ${error?.message}`);
      }
      createdDemandaIds.push(data.id);
      return data.id as number;
    }

    async function createModeloContrato(criadoPor: string) {
      const { data, error } = await admin
        .from("contrato_modelos")
        .insert({
          titulo: `Modelo ${unique()}`,
          categoria: "teste",
          conteudo: "contrato de teste",
          criado_por: criadoPor,
        })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(`Failed to create contrato_modelo: ${error?.message}`);
      }
      createdModeloIds.push(data.id);
      return data.id as number;
    }

    async function createContrato(
      criadoPor: string,
      modeloId: number,
      eventoId: number
    ) {
      const { data, error } = await admin
        .from("contratos")
        .insert({
          modelo_id: modeloId,
          evento_id: eventoId,
          aluno_nome: `Aluno ${unique()}`,
          criado_por: criadoPor,
        })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(`Failed to create contrato: ${error?.message}`);
      }
      createdContratoIds.push(data.id);
      return data.id as number;
    }

    async function createProepStudent(eventoId: number) {
      const { data, error } = await admin
        .from("proep_students")
        .insert({ edition_id: eventoId, name: `Aluno PROEP ${unique()}` })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(`Failed to create proep_students: ${error?.message}`);
      }
      createdProepStudentIds.push(data.id);
      return data.id as string;
    }

    afterAll(async () => {
      for (const id of createdContratoIds) {
        await admin.from("contratos").delete().eq("id", id);
      }
      for (const id of createdModeloIds) {
        await admin.from("contrato_modelos").delete().eq("id", id);
      }
      for (const id of createdProepStudentIds) {
        await admin.from("proep_students").delete().eq("id", id);
      }
      for (const id of createdDemandaIds) {
        await admin.from("demandas").delete().eq("id", id);
      }
      for (const id of createdEventoIds) {
        await admin.from("eventos").delete().eq("id", id);
      }
      for (const id of createdTipoIds) {
        await admin.from("evento_tipos").delete().eq("id", id);
      }
      for (const id of createdUserIds) {
        await admin.auth.admin.deleteUser(id);
      }
    });

    it("moves demandas/contratos/PROEP references to the kept event, adopts missing fields, and deletes the duplicate", async () => {
      const coord = await createUser("coordenador_geral");
      const manter = await createEvento(coord.id, {
        titulo: `Qualificação ${unique()}`,
        data_evento: "2026-09-10",
        local: null,
      });
      const remover = await createEvento(coord.id, {
        titulo: `Qualificação ${unique()} (duplicado)`,
        data_evento: "2026-09-10",
        local: "Centro Ectolab",
        descricao: "Sessão extraída de ata",
      });

      // Demandas: uma só no duplicado (move), uma com título igual nos dois
      // (dedupe — só a do definitivo sobrevive).
      const demandaSola = await createDemanda(coord.id, remover, `Tarefa única ${unique()}`);
      const tituloRepetido = `Tarefa repetida ${unique()}`;
      const demandaManter = await createDemanda(coord.id, manter, tituloRepetido);
      await createDemanda(coord.id, remover, tituloRepetido);

      // Contratos e PROEP apontando para o duplicado.
      const modelo = await createModeloContrato(coord.id);
      const contrato = await createContrato(coord.id, modelo, remover);
      const estudante = await createProepStudent(remover);

      const { data: editionConfig, error: editionError } = await admin
        .from("proep_edition_config")
        .insert({ edition_id: remover, drive_folder_id: "pasta-1" })
        .select("edition_id")
        .single();
      if (editionError || !editionConfig) {
        throw new Error(`Failed to create proep_edition_config: ${editionError?.message}`);
      }

      const client = await signInAs(coord);
      const { data: resultado, error: rpcError } = await client.rpc("mesclar_eventos", {
        p_manter_id: manter,
        p_remover_id: remover,
      });
      expect(rpcError).toBeNull();
      expect(resultado).toBe("ok");

      // Duplicado removido; definitivo mantido.
      const { data: eventosRestantes, error: readEventosError } = await admin
        .from("eventos")
        .select("id, local, descricao")
        .in("id", [manter, remover]);
      expect(readEventosError).toBeNull();
      const ids = (eventosRestantes ?? []).map((e: { id: number }) => e.id);
      expect(ids).toEqual([manter]);
      expect(eventosRestantes?.[0]?.local).toBe("Centro Ectolab");
      expect(eventosRestantes?.[0]?.descricao).toBe("Sessão extraída de ata");

      // Demandas: única movida existe e aponta para manter; repetida só no
      // definitivo (dedupe removeu a cópia do duplicado).
      const { data: demandasMovidas } = await admin
        .from("demandas")
        .select("id, evento_id, titulo")
        .in("id", [demandaSola, demandaManter]);
      expect((demandasMovidas ?? []).length).toBe(2);
      const sola = (demandasMovidas ?? []).find(
        (d: { id: number }) => d.id === demandaSola
      );
      expect(sola?.evento_id).toBe(manter);
      const { data: repetidas } = await admin
        .from("demandas")
        .select("id, evento_id")
        .eq("titulo", tituloRepetido);
      expect((repetidas ?? []).length).toBe(1);
      expect(repetidas?.[0]?.evento_id).toBe(manter);
      expect(repetidas?.[0]?.id).toBe(demandaManter);

      // Contratos e PROEP reapontados para o definitivo.
      const { data: contratoLido } = await admin
        .from("contratos")
        .select("evento_id")
        .eq("id", contrato)
        .single();
      expect(contratoLido?.evento_id).toBe(manter);

      const { data: estudanteLido } = await admin
        .from("proep_students")
        .select("edition_id")
        .eq("id", estudante)
        .single();
      expect(estudanteLido?.edition_id).toBe(manter);

      const { data: pastaLida } = await admin
        .from("proep_edition_config")
        .select("edition_id")
        .eq("edition_id", manter)
        .single();
      expect(pastaLida?.edition_id).toBe(manter);
    });

    it("refuses merge when the kept event already has a Drive folder (keeps the kept event's config)", async () => {
      const coord = await createUser("coordenador_geral");
      const manter = await createEvento(coord.id, {
        titulo: `Curso ${unique()}`,
        data_evento: "2026-10-05",
      });
      const remover = await createEvento(coord.id, {
        titulo: `Curso ${unique()} (duplicado)`,
        data_evento: "2026-10-05",
      });

      const { error: configManterError } = await admin
        .from("proep_edition_config")
        .insert({ edition_id: manter, drive_folder_id: "pasta-definitiva" });
      const { error: configRemoverError } = await admin
        .from("proep_edition_config")
        .insert({ edition_id: remover, drive_folder_id: "pasta-duplicada" });
      expect(configManterError).toBeNull();
      expect(configRemoverError).toBeNull();

      const client = await signInAs(coord);
      const { data: resultado, error: rpcError } = await client.rpc("mesclar_eventos", {
        p_manter_id: manter,
        p_remover_id: remover,
      });
      expect(rpcError).toBeNull();
      expect(resultado).toBe("ok");

      // O merge não deve falhar com conflito de PK — a config do definitivo
      // prevalece e a do duplicado é descartada.
      const { data: pastas } = await admin
        .from("proep_edition_config")
        .select("edition_id, drive_folder_id")
        .eq("edition_id", manter);
      expect(pastas?.length).toBe(1);
      expect(pastas?.[0]?.drive_folder_id).toBe("pasta-definitiva");
    });

    it("rejects non-coordinator callers and invalid inputs", async () => {
      const coord = await createUser("coordenador_geral");
      const comum = await createUser("voluntario_comum");
      const manter = await createEvento(coord.id, {
        titulo: `Live ${unique()}`,
        data_evento: "2026-11-01",
      });
      const remover = await createEvento(coord.id, {
        titulo: `Live ${unique()} (duplicado)`,
        data_evento: "2026-11-01",
      });

      const comumClient = await signInAs(comum);
      const { data: negado, error: negadoError } = await comumClient.rpc(
        "mesclar_eventos",
        { p_manter_id: manter, p_remover_id: remover }
      );
      expect(negadoError).toBeNull();
      expect(negado).toBe("sem_permissao");

      const coordClient = await signInAs(coord);
      const { data: mesmoEvento } = await coordClient.rpc("mesclar_eventos", {
        p_manter_id: manter,
        p_remover_id: manter,
      });
      expect(mesmoEvento).toBe("mesmo_evento");

      const { data: naoEncontrado } = await coordClient.rpc("mesclar_eventos", {
        p_manter_id: manter,
        p_remover_id: 999999999,
      });
      expect(naoEncontrado).toBe("evento_nao_encontrado");
    });
  }
);
