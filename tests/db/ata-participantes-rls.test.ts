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

describe.skipIf(!canRun)(
  "ata_participantes schema + RLS enforcement (live Supabase project)",
  () => {
    let admin: SupabaseClient;
    const createdUserIds: string[] = [];
    const createdAtaIds: number[] = [];
    const createdVoluntarioIds: number[] = [];
    let fixtureCounter = 0;

    admin = createClient(supabaseUrl!, serviceRoleKey!);

    async function createFixtureUser() {
      fixtureCounter += 1;
      const email = `ectodash-test-ata-${Date.now()}-${fixtureCounter}@example.invalid`;
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

    async function createFixtureWithRole(role: string) {
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

    async function createVoluntario(nome: string) {
      const { data, error } = await admin
        .from("voluntarios")
        .insert({ nome, ativo: true })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(`Failed to create voluntario: ${error?.message}`);
      }
      createdVoluntarioIds.push(data.id);
      return data.id as number;
    }

    afterAll(async () => {
      // Atas first — ata_participantes cascades away with their ata.
      for (const id of createdAtaIds) {
        await admin.from("reunioes").delete().eq("id", id);
      }
      // Roster rows next — cascades clean their ata_participantes rows.
      for (const id of createdVoluntarioIds) {
        await admin.from("voluntarios").delete().eq("id", id);
      }
      // Fixture users last, so no dangling FK references remain.
      for (const id of createdUserIds) {
        await admin.auth.admin.deleteUser(id);
      }
    });

    it("ATA-01: o criador da ata vincula participantes do roster; estranhos são negados; leitura é aberta", async () => {
      const criador = await createFixtureUser();
      const estranho = await createFixtureUser();
      const voluntarioA = await createVoluntario(`Ata Vol A ${Date.now()}`);
      const voluntarioB = await createVoluntario(`Ata Vol B ${Date.now()}`);

      const criadorClient = await signInAs(criador);
      const estranhoClient = await signInAs(estranho);

      const { data: ata, error: ataError } = await criadorClient
        .from("reunioes")
        .insert({
          titulo: `Ata de teste ${Date.now()}`,
          data_reuniao: "2027-02-10",
        })
        .select("id")
        .single();
      expect(ataError).toBeNull();
      expect(ata?.id).toBeDefined();
      const ataId = ata!.id as number;
      createdAtaIds.push(ataId);

      // Criador vincula os dois voluntários — permitido.
      const { error: linkError } = await criadorClient
        .from("ata_participantes")
        .insert([
          { ata_id: ataId, voluntario_id: voluntarioA },
          { ata_id: ataId, voluntario_id: voluntarioB },
        ]);
      expect(linkError).toBeNull();

      // Estranho tenta vincular um voluntário numa ata que não é dele — negado.
      const voluntarioC = await createVoluntario(`Ata Vol C ${Date.now()}`);
      const { error: strangerError } = await estranhoClient
        .from("ata_participantes")
        .insert({ ata_id: ataId, voluntario_id: voluntarioC });
      expect(strangerError).not.toBeNull();

      // Re-read via service-role client — never trust the acting client's
      // own RLS view; the service role bypasses RLS and sees the truth.
      const { data: rows, error: readError } = await admin
        .from("ata_participantes")
        .select("voluntario_id")
        .eq("ata_id", ataId);
      expect(readError).toBeNull();
      expect((rows ?? []).map((r) => r.voluntario_id).sort()).toEqual(
        [voluntarioA, voluntarioB].sort()
      );

      // Leitura aberta: o estranho enxerga os vínculos da ata.
      const { data: strangerRead, error: strangerReadError } = await estranhoClient
        .from("ata_participantes")
        .select("voluntario_id")
        .eq("ata_id", ataId);
      expect(strangerReadError).toBeNull();
      expect(strangerRead ?? []).toHaveLength(2);
    });

    it("ATA-02: coordenador_geral pode vincular/remover em qualquer ata; criador remove o próprio vínculo", async () => {
      const criador = await createFixtureUser();
      const coordenador = await createFixtureWithRole("coordenador_geral");
      const voluntarioA = await createVoluntario(`Ata Vol D ${Date.now()}`);
      const voluntarioB = await createVoluntario(`Ata Vol E ${Date.now()}`);

      const criadorClient = await signInAs(criador);
      const coordenadorClient = await signInAs(coordenador);

      const { data: ata, error: ataError } = await criadorClient
        .from("reunioes")
        .insert({
          titulo: `Ata de teste coord ${Date.now()}`,
          data_reuniao: "2027-03-15",
        })
        .select("id")
        .single();
      expect(ataError).toBeNull();
      const ataId = ata!.id as number;
      createdAtaIds.push(ataId);

      const { error: coordInsertError } = await coordenadorClient
        .from("ata_participantes")
        .insert({ ata_id: ataId, voluntario_id: voluntarioA });
      expect(coordInsertError).toBeNull();

      // Criador remove o vínculo do próprio participante — permitido.
      const { error: creatorDeleteError } = await criadorClient
        .from("ata_participantes")
        .delete()
        .eq("ata_id", ataId)
        .eq("voluntario_id", voluntarioA);
      expect(creatorDeleteError).toBeNull();

      // O coordenador re-vincula o mesmo participante para o teste do
      // estranho ter uma linha EXISTENTE para tentar remover (delete de
      // linha inexistente é no-op sem erro e não testaria a RLS).
      const { error: coordReLinkError } = await coordenadorClient
        .from("ata_participantes")
        .insert({ ata_id: ataId, voluntario_id: voluntarioA });
      expect(coordReLinkError).toBeNull();

      // Estranho (terceiro) não pode remover — o bloqueio RLS de DELETE é
      // SILENCIOSO (0 linhas, sem erro, como o UPDATE da lição do 0002), então
      // a prova é a linha continuar existindo.
      const estranho = await createFixtureUser();
      const estranhoClient = await signInAs(estranho);
      const { error: strangerDeleteError } = await estranhoClient
        .from("ata_participantes")
        .delete()
        .eq("ata_id", ataId)
        .eq("voluntario_id", voluntarioA);
      expect(strangerDeleteError).toBeNull();

      const { data: linhaSobrevive } = await admin
        .from("ata_participantes")
        .select("voluntario_id")
        .eq("ata_id", ataId)
        .eq("voluntario_id", voluntarioA);
      expect(linhaSobrevive ?? []).toHaveLength(1);

      // Coordenador adiciona de novo e remove — permitido.
      const { error: coordReInsertError } = await coordenadorClient
        .from("ata_participantes")
        .insert({ ata_id: ataId, voluntario_id: voluntarioB });
      expect(coordReInsertError).toBeNull();

      const { error: coordDeleteError } = await coordenadorClient
        .from("ata_participantes")
        .delete()
        .eq("ata_id", ataId)
        .eq("voluntario_id", voluntarioB);
      expect(coordDeleteError).toBeNull();

      const { data: rows } = await admin
        .from("ata_participantes")
        .select("voluntario_id")
        .eq("ata_id", ataId);
      // Só resta o vínculo de A — o que o estranho não conseguiu remover.
      expect((rows ?? []).map((r) => r.voluntario_id)).toEqual([voluntarioA]);
    });

    it("ATA-03: vínculo aponta para voluntário do roster (FK) e cascata na exclusão da ata", async () => {
      const criador = await createFixtureUser();
      const voluntarioA = await createVoluntario(`Ata Vol F ${Date.now()}`);

      const criadorClient = await signInAs(criador);

      const { data: ata } = await criadorClient
        .from("reunioes")
        .insert({
          titulo: `Ata de teste cascade ${Date.now()}`,
          data_reuniao: "2027-04-01",
        })
        .select("id")
        .single();
      const ataId = ata!.id as number;

      const { error: linkError } = await criadorClient
        .from("ata_participantes")
        .insert({ ata_id: ataId, voluntario_id: voluntarioA });
      expect(linkError).toBeNull();

      // FK: um id de voluntário inexistente é rejeitado.
      const { error: badFkError } = await criadorClient
        .from("ata_participantes")
        .insert({ ata_id: ataId, voluntario_id: 999999999 });
      expect(badFkError).not.toBeNull();

      // Cascata: excluir a ata remove os vínculos.
      const { error: deleteError } = await admin
        .from("reunioes")
        .delete()
        .eq("id", ataId);
      expect(deleteError).toBeNull();

      const { data: orphans } = await admin
        .from("ata_participantes")
        .select("ata_id")
        .eq("ata_id", ataId);
      expect(orphans ?? []).toHaveLength(0);
    });
  }
);
