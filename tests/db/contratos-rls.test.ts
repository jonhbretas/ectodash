import { afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// .env.local is git-ignored and holds real project credentials. Load it here so
// this integration suite can run locally with `npm test` without extra setup.
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
  | "financeiro";

describe.skipIf(!canRun)(
  "contratos schema + RLS enforcement (live Supabase project)",
  () => {
    let admin: SupabaseClient;
    const createdUserIds: string[] = [];
    const createdContratoIds: number[] = [];
    const createdModeloIds: number[] = [];
    const createdEventoIds: number[] = [];
    let fixtureCounter = 0;

    admin = createClient(supabaseUrl!, serviceRoleKey!);

    async function createFixtureUser() {
      fixtureCounter += 1;
      const email = `ectodash-test-contrato-${Date.now()}-${fixtureCounter}@example.invalid`;
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

    async function createModeloViaAdmin(criadoPor: string) {
      const { data, error } = await admin
        .from("contrato_modelos")
        .insert({
          titulo: "Contrato de teste",
          categoria: "curso",
          conteudo:
            "CLÁUSULA PRIMEIRA — DO OBJETO\n\nO presente contrato rege a participação de {{aluno_nome}} no evento {{evento_titulo}}.",
          criado_por: criadoPor,
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(`Failed to create modelo: ${error?.message}`);
      }
      createdModeloIds.push(data.id as number);
      return data.id as number;
    }

    async function createEventoViaAdmin(criadoPor: string) {
      const { data, error } = await admin
        .from("eventos")
        .insert({
          titulo: "Evento de contrato teste",
          data_evento: "2027-03-01",
          local: "Sede",
          criado_por: criadoPor,
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(`Failed to create evento: ${error?.message}`);
      }
      createdEventoIds.push(data.id as number);
      return data.id as number;
    }

    afterAll(async () => {
      for (const id of createdContratoIds) {
        await admin.from("contratos").delete().eq("id", id);
      }
      for (const id of createdModeloIds) {
        await admin.from("contrato_modelos").delete().eq("id", id);
      }
      for (const id of createdEventoIds) {
        await admin.from("eventos").delete().eq("id", id);
      }
      for (const id of createdUserIds) {
        await admin.auth.admin.deleteUser(id);
      }
    });

    it("CT-01: voluntário comum pode criar um contrato com o próprio criado_por e lê-lo depois", async () => {
      const criador = await createFixtureUser();
      const modeloId = await createModeloViaAdmin(criador.id);
      const cliente = await signInAs(criador);

      const { data: inserted, error: insertError } = await cliente
        .from("contratos")
        .insert({
          modelo_id: modeloId,
          aluno_nome: "Aluno de Teste",
          aluno_email: "aluno@example.invalid",
          status: "gerado",
        })
        .select("id")
        .single();

      expect(insertError).toBeNull();
      expect(inserted?.id).toBeDefined();
      const contratoId = inserted!.id as number;
      createdContratoIds.push(contratoId);

      const { data: row, error: readError } = await admin
        .from("contratos")
        .select("aluno_nome, status, criado_por")
        .eq("id", contratoId)
        .single();

      expect(readError).toBeNull();
      expect(row?.aluno_nome).toBe("Aluno de Teste");
      expect(row?.status).toBe("gerado");
      expect(row?.criado_por).toBe(criador.id);

      const { data: ownRead } = await cliente
        .from("contratos")
        .select("id")
        .eq("id", contratoId)
        .single();
      expect(ownRead?.id).toBe(contratoId);
    });

    it("CT-01b: contrato pode referenciar um evento existente", async () => {
      const criador = await createFixtureUser();
      const modeloId = await createModeloViaAdmin(criador.id);
      const eventoId = await createEventoViaAdmin(criador.id);
      const cliente = await signInAs(criador);

      const { data: inserted, error: insertError } = await cliente
        .from("contratos")
        .insert({
          modelo_id: modeloId,
          evento_id: eventoId,
          aluno_nome: "Aluno com Evento",
          status: "gerado",
        })
        .select("id")
        .single();

      expect(insertError).toBeNull();
      const contratoId = inserted!.id as number;
      createdContratoIds.push(contratoId);

      const { data: row } = await admin
        .from("contratos")
        .select("evento_id")
        .eq("id", contratoId)
        .single();
      expect(row?.evento_id).toBe(eventoId);
    });

    it("CT-02: criado_por não pode ser forjado para o id de outro usuário", async () => {
      const actor = await createFixtureUser();
      const victim = await createFixtureUser();
      const modeloId = await createModeloViaAdmin(actor.id);
      const cliente = await signInAs(actor);

      const { data: inserted, error: insertError } = await cliente
        .from("contratos")
        .insert({
          modelo_id: modeloId,
          aluno_nome: "Spoof",
          status: "gerado",
          criado_por: victim.id,
        })
        .select("id")
        .single();

      if (insertError) {
        expect(insertError).not.toBeNull();
        return;
      }

      const contratoId = inserted!.id as number;
      createdContratoIds.push(contratoId);

      const { data: row, error: readError } = await admin
        .from("contratos")
        .select("criado_por")
        .eq("id", contratoId)
        .single();

      expect(readError).toBeNull();
      expect(row?.criado_por).toBe(actor.id);
      expect(row?.criado_por).not.toBe(victim.id);
    });

    it("CT-03: usuário não vê nem atualiza contrato de outro usuário", async () => {
      const dono = await createFixtureUser();
      const estranho = await createFixtureUser();
      const modeloId = await createModeloViaAdmin(dono.id);
      const donoClient = await signInAs(dono);
      const estranhoClient = await signInAs(estranho);

      const { data: inserted } = await donoClient
        .from("contratos")
        .insert({
          modelo_id: modeloId,
          aluno_nome: "Dono do Contrato",
          status: "assinado",
        })
        .select("id")
        .single();
      const contratoId = inserted!.id as number;
      createdContratoIds.push(contratoId);

      const { data: invisible, error: selectError } = await estranhoClient
        .from("contratos")
        .select("id")
        .eq("id", contratoId);

      expect(selectError).toBeNull();
      expect(invisible ?? []).toHaveLength(0);

      const { data: updated, error: updateError } = await estranhoClient
        .from("contratos")
        .update({ status: "cancelado" })
        .eq("id", contratoId)
        .select("id");

      expect(updateError).toBeNull();
      expect(updated ?? []).toHaveLength(0);
    });

    it("CT-04: coordenador geral vê e atualiza contrato de outro usuário", async () => {
      const dono = await createFixtureUser();
      const coordenador = await createFixtureWithRole("coordenador_geral");
      const modeloId = await createModeloViaAdmin(dono.id);
      const donoClient = await signInAs(dono);
      const coordClient = await signInAs(coordenador);

      const { data: inserted } = await donoClient
        .from("contratos")
        .insert({
          modelo_id: modeloId,
          aluno_nome: "Contrato do Coordenador",
          status: "gerado",
        })
        .select("id")
        .single();
      const contratoId = inserted!.id as number;
      createdContratoIds.push(contratoId);

      const { data: visible, error: selectError } = await coordClient
        .from("contratos")
        .select("id, aluno_nome")
        .eq("id", contratoId)
        .single();

      expect(selectError).toBeNull();
      expect(visible?.aluno_nome).toBe("Contrato do Coordenador");

      const { data: updated, error: updateError } = await coordClient
        .from("contratos")
        .update({ status: "assinando" })
        .eq("id", contratoId)
        .select("status");

      expect(updateError).toBeNull();
      expect(updated?.[0]?.status).toBe("assinando");
    });

    it("CT-05: modelos são legíveis por todos; só criador ou coordenador atualiza", async () => {
      const criador = await createFixtureUser();
      const estranho = await createFixtureUser();
      const modeloId = await createModeloViaAdmin(criador.id);
      const criadorClient = await signInAs(criador);
      const estranhoClient = await signInAs(estranho);

      const { data: read } = await estranhoClient
        .from("contrato_modelos")
        .select("id, titulo")
        .eq("id", modeloId)
        .single();
      expect(read?.id).toBe(modeloId);

      const { data: updated, error: updateError } = await estranhoClient
        .from("contrato_modelos")
        .update({ titulo: "Hackeado" })
        .eq("id", modeloId)
        .select("id");

      expect(updateError).toBeNull();
      expect(updated ?? []).toHaveLength(0);

      const { data: updatedByCreator, error: creatorError } = await criadorClient
        .from("contrato_modelos")
        .update({ titulo: "Contrato de teste editado" })
        .eq("id", modeloId)
        .select("titulo");

      expect(creatorError).toBeNull();
      expect(updatedByCreator?.[0]?.titulo).toBe("Contrato de teste editado");
    });
  }
);
