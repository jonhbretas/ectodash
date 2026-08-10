import { afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not found — rely on real environment variables.
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
  "contratos por evento schema + RLS (live Supabase project)",
  () => {
    let admin: SupabaseClient;
    const createdUserIds: string[] = [];
    const createdEventoIds: number[] = [];
    const createdModeloIds: number[] = [];
    const createdVinculos: Array<{ evento_id: number; wp_product_id: number }> = [];
    const createdVinculosModelo: Array<{ evento_id: number; modelo_id: number }> = [];
    let fixtureCounter = 0;

    admin = createClient(supabaseUrl!, serviceRoleKey!);

    async function createFixtureUser() {
      fixtureCounter += 1;
      const email = `ectodash-test-cev-${Date.now()}-${fixtureCounter}@example.invalid`;
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
          throw new Error(`Failed to set role ${role}: ${error.message}`);
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

    async function createEventoViaAdmin(criadoPor: string) {
      const { data, error } = await admin
        .from("eventos")
        .insert({
          titulo: "Evento contratos por evento",
          data_evento: "2027-04-01",
          criado_por: criadoPor,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`Failed to create evento: ${error?.message}`);
      createdEventoIds.push(data.id as number);
      return data.id as number;
    }

    async function createModeloViaAdmin(criadoPor: string) {
      const { data, error } = await admin
        .from("contrato_modelos")
        .insert({
          titulo: "Modelo por evento teste",
          categoria: "curso",
          conteudo:
            "CLÁUSULA PRIMEIRA — DO OBJETO\n\nO presente contrato rege a participação de {{aluno_nome}}.",
          criado_por: criadoPor,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`Failed to create modelo: ${error?.message}`);
      createdModeloIds.push(data.id as number);
      return data.id as number;
    }

    afterAll(async () => {
      for (const v of createdVinculos) {
        await admin
          .from("contrato_evento_produtos")
          .delete()
          .eq("evento_id", v.evento_id)
          .eq("wp_product_id", v.wp_product_id);
      }
      for (const v of createdVinculosModelo) {
        await admin
          .from("contrato_evento_modelos")
          .delete()
          .eq("evento_id", v.evento_id)
          .eq("modelo_id", v.modelo_id);
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

    it("CEV-01: coordenador vincula produto e habilita modelo do evento", async () => {
      const coord = await createFixtureWithRole("coordenador_geral");
      const eventoId = await createEventoViaAdmin(coord.id);
      const modeloId = await createModeloViaAdmin(coord.id);
      const cliente = await signInAs(coord);

      const { error: prodError } = await cliente
        .from("contrato_evento_produtos")
        .insert({ evento_id: eventoId, wp_product_id: 999001, nome_produto: "Curso Teste 2027" });
      expect(prodError).toBeNull();
      createdVinculos.push({ evento_id: eventoId, wp_product_id: 999001 });

      const { error: modError } = await cliente
        .from("contrato_evento_modelos")
        .insert({ evento_id: eventoId, modelo_id: modeloId, conteudo_personalizado: null });
      expect(modError).toBeNull();
      createdVinculosModelo.push({ evento_id: eventoId, modelo_id: modeloId });

      const { data: prodRows } = await admin
        .from("contrato_evento_produtos")
        .select("nome_produto")
        .eq("evento_id", eventoId)
        .eq("wp_product_id", 999001);
      expect(prodRows?.[0]?.nome_produto).toBe("Curso Teste 2027");

      const { data: modRows } = await admin
        .from("contrato_evento_modelos")
        .select("modelo_id")
        .eq("evento_id", eventoId)
        .eq("modelo_id", modeloId);
      expect(modRows).toHaveLength(1);
    });

    it("CEV-02: voluntário comum NÃO vincula produto nem habilita modelo", async () => {
      const coord = await createFixtureWithRole("coordenador_geral");
      const vol = await createFixtureUser();
      const eventoId = await createEventoViaAdmin(coord.id);
      const modeloId = await createModeloViaAdmin(coord.id);
      const cliente = await signInAs(vol);

      const { data: prodInserted, error: prodError } = await cliente
        .from("contrato_evento_produtos")
        .insert({ evento_id: eventoId, wp_product_id: 999002, nome_produto: "Curso Bloqueado" })
        .select("wp_product_id");
      expect(prodError).not.toBeNull();
      expect(prodInserted ?? []).toHaveLength(0);

      const { data: modInserted, error: modError } = await cliente
        .from("contrato_evento_modelos")
        .insert({ evento_id: eventoId, modelo_id: modeloId })
        .select("modelo_id");
      expect(modError).not.toBeNull();
      expect(modInserted ?? []).toHaveLength(0);

      const { data: prodRows } = await admin
        .from("contrato_evento_produtos")
        .select("wp_product_id")
        .eq("evento_id", eventoId)
        .eq("wp_product_id", 999002);
      expect(prodRows ?? []).toHaveLength(0);
    });

    it("CEV-03: qualquer autenticado lê os vínculos do evento", async () => {
      const coord = await createFixtureWithRole("coordenador_geral");
      const vol = await createFixtureUser();
      const eventoId = await createEventoViaAdmin(coord.id);

      const { error: adminError } = await admin
        .from("contrato_evento_produtos")
        .insert({ evento_id: eventoId, wp_product_id: 999003, nome_produto: "Curso Legivel" });
      expect(adminError).toBeNull();
      createdVinculos.push({ evento_id: eventoId, wp_product_id: 999003 });

      const cliente = await signInAs(vol);
      const { data: rows, error: readError } = await cliente
        .from("contrato_evento_produtos")
        .select("nome_produto")
        .eq("evento_id", eventoId)
        .eq("wp_product_id", 999003);
      expect(readError).toBeNull();
      expect(rows?.[0]?.nome_produto).toBe("Curso Legivel");
    });

    it("CEV-04: contrato em lote grava expira_em e conteudo_utilizado (snapshot)", async () => {
      const coord = await createFixtureWithRole("coordenador_geral");
      const modeloId = await createModeloViaAdmin(coord.id);
      const cliente = await signInAs(coord);

      const { data: inserted, error } = await cliente
        .from("contratos")
        .insert({
          modelo_id: modeloId,
          aluno_nome: "Aluno Lote",
          status: "gerado",
          expira_em: "2027-04-16",
          conteudo_utilizado: "Texto adaptado para o evento X",
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      const contratoId = inserted!.id as number;

      const { data: row } = await admin
        .from("contratos")
        .select("expira_em, conteudo_utilizado")
        .eq("id", contratoId)
        .single();
      expect(row?.expira_em).toBe("2027-04-16");
      expect(row?.conteudo_utilizado).toBe("Texto adaptado para o evento X");

      await admin.from("contratos").delete().eq("id", contratoId);
    });
  }
);
