import { afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Live RLS/trigger/RPC proof for pautas votação (migration
// 20261021150000_pautas_votacao_anexo.sql). Mesmo padrão de feedback-rls.test.ts.
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local ausente — usa variáveis reais do ambiente (ex.: segredos de CI).
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(supabaseUrl && anonKey && serviceRoleKey);

describe.skipIf(!canRun)("pautas votação + RLS (live Supabase project)", () => {
  // describe.skipIf ainda executa o corpo para coletar testes: só cria o
  // cliente quando as credenciais existem.
  const admin: SupabaseClient = canRun
    ? createClient(supabaseUrl!, serviceRoleKey!)
    : (null as unknown as SupabaseClient);
  const createdUserIds: string[] = [];
  const createdPautaIds: number[] = [];
  let fixtureCounter = 0;

  async function createFixtureUser() {
    fixtureCounter += 1;
    const email = `ectodash-test-pautavoto-${Date.now()}-${fixtureCounter}@example.invalid`;
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

  async function signInAs(fixture: { email: string; password: string }) {
    const client = createClient(supabaseUrl!, anonKey!);
    const { error } = await client.auth.signInWithPassword({
      email: fixture.email,
      password: fixture.password,
    });
    if (error) throw new Error(`Failed to sign in as ${fixture.email}: ${error.message}`);
    return client;
  }

  async function createCoordenador() {
    const fx = await createFixtureUser();
    await admin.from("profiles").update({ role: "coordenador_geral" }).eq("id", fx.id);
    return { fx, client: await signInAs(fx) };
  }

  async function criarPauta(client: SupabaseClient, extra: Record<string, unknown> = {}) {
    const { data, error } = await client
      .from("pautas")
      .insert({ titulo: "Pauta de teste de votação", ...extra })
      .select("id, tipo, quorum_minimo, votacao_status")
      .single();
    if (data?.id) createdPautaIds.push(data.id as number);
    return { data, error };
  }

  afterAll(async () => {
    for (const id of createdPautaIds) {
      await admin.from("pautas").delete().eq("id", id);
    }
    for (const id of createdUserIds) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("PV-01: insert força votacao_status/quorum; informativa fica sem votação", async () => {
    const user = await signInAs(await createFixtureUser());
    const { data, error } = await criarPauta(user, {
      tipo: "deliberativa",
      votacao_status: "aprovada",
      quorum_minimo: 1,
    });
    expect(error).toBeNull();
    expect(data?.votacao_status).toBe("aberta");
    expect(data?.quorum_minimo).toBe(3);

    const info = await criarPauta(user, { tipo: "informativa" });
    expect(info.error).toBeNull();
    expect(info.data?.votacao_status).toBeNull();
  });

  it("PV-02: criador não altera votacao_status/quorum/tipo da própria pauta", async () => {
    const user = await signInAs(await createFixtureUser());
    const { data } = await criarPauta(user, { tipo: "deliberativa" });
    const id = data!.id as number;

    for (const patch of [
      { votacao_status: "aprovada" },
      { quorum_minimo: 1 },
      { tipo: "informativa" },
    ]) {
      const { error } = await user.from("pautas").update(patch).eq("id", id);
      expect(error).not.toBeNull();
    }

    const { data: row } = await admin
      .from("pautas")
      .select("tipo, quorum_minimo, votacao_status")
      .eq("id", id)
      .single();
    expect(row).toEqual({ tipo: "deliberativa", quorum_minimo: 3, votacao_status: "aberta" });
  });

  it("PV-03: voto é upsert por usuário, não falsifica user_id e exige deliberativa", async () => {
    const a = await createFixtureUser();
    const b = await createFixtureUser();
    const clientA = await signInAs(a);
    const clientB = await signInAs(b);
    const { data } = await criarPauta(clientA, { tipo: "deliberativa" });
    const id = data!.id as number;

    const up1 = await clientA
      .from("pauta_votos")
      .upsert({ pauta_id: id, user_id: a.id, voto: "aprovar" }, { onConflict: "pauta_id,user_id" });
    expect(up1.error).toBeNull();
    const up2 = await clientA
      .from("pauta_votos")
      .upsert(
        { pauta_id: id, user_id: a.id, voto: "rejeitar", comentario: "mudei de ideia" },
        { onConflict: "pauta_id,user_id" }
      );
    expect(up2.error).toBeNull();
    const upB = await clientB
      .from("pauta_votos")
      .upsert({ pauta_id: id, user_id: b.id, voto: "abster" }, { onConflict: "pauta_id,user_id" });
    expect(upB.error).toBeNull();

    const { data: votos } = await admin.from("pauta_votos").select("user_id, voto").eq("pauta_id", id);
    expect(votos).toHaveLength(2);
    expect(votos!.find((v) => v.user_id === a.id)?.voto).toBe("rejeitar");

    // Voto em nome de outra pessoa falha.
    const spoof = await clientB
      .from("pauta_votos")
      .insert({ pauta_id: id, user_id: a.id, voto: "aprovar" });
    expect(spoof.error).not.toBeNull();

    // Pauta informativa não aceita voto.
    const { data: info } = await criarPauta(clientA, { tipo: "informativa" });
    const semVotacao = await clientA
      .from("pauta_votos")
      .insert({ pauta_id: info!.id, user_id: a.id, voto: "aprovar" });
    expect(semVotacao.error).not.toBeNull();
  });

  it("PV-04: só coordenador encerra; resultado calculado em SQL; votos bloqueados depois", async () => {
    const a = await createFixtureUser();
    const b = await createFixtureUser();
    const c = await createFixtureUser();
    const clientA = await signInAs(a);
    const clientB = await signInAs(b);
    const clientC = await signInAs(c);
    const { fx: coord, client: coordClient } = await createCoordenador();
    const { data } = await criarPauta(clientA, { tipo: "deliberativa" });
    const id = data!.id as number;

    await clientA.from("pauta_votos").insert({ pauta_id: id, user_id: a.id, voto: "aprovar" });
    await clientB.from("pauta_votos").insert({ pauta_id: id, user_id: b.id, voto: "aprovar" });
    await clientC.from("pauta_votos").insert({ pauta_id: id, user_id: c.id, voto: "rejeitar" });

    const negado = await clientA.rpc("encerrar_votacao_pauta", { p_pauta_id: id });
    expect(negado.error).not.toBeNull();

    const ok = await coordClient.rpc("encerrar_votacao_pauta", { p_pauta_id: id });
    expect(ok.error).toBeNull();
    expect(ok.data).toBe("aprovada");

    const { data: row } = await admin
      .from("pautas")
      .select("votacao_status, votacao_encerrada_em, votacao_encerrada_por")
      .eq("id", id)
      .single();
    expect(row?.votacao_status).toBe("aprovada");
    expect(row?.votacao_encerrada_em).not.toBeNull();
    expect(row?.votacao_encerrada_por).toBe(coord.id);

    // Depois de encerrada: novo voto e alteração falham.
    const d = await createFixtureUser();
    const clientD = await signInAs(d);
    const novo = await clientD
      .from("pauta_votos")
      .insert({ pauta_id: id, user_id: d.id, voto: "aprovar" });
    expect(novo.error).not.toBeNull();
    const alterado = await clientA
      .from("pauta_votos")
      .update({ voto: "rejeitar" })
      .eq("pauta_id", id)
      .eq("user_id", a.id)
      .select("id");
    expect(alterado.data ?? []).toHaveLength(0);
    const { data: ainda } = await admin
      .from("pauta_votos")
      .select("voto")
      .eq("pauta_id", id)
      .eq("user_id", a.id)
      .single();
    expect(ainda?.voto).toBe("aprovar");
  });

  it("PV-05: sem quórum e reabertura pelo coordenador", async () => {
    const a = await createFixtureUser();
    const b = await createFixtureUser();
    const clientA = await signInAs(a);
    const clientB = await signInAs(b);
    const { client: coordClient } = await createCoordenador();
    const { data } = await criarPauta(clientA, { tipo: "deliberativa" });
    const id = data!.id as number;

    await clientA.from("pauta_votos").insert({ pauta_id: id, user_id: a.id, voto: "aprovar" });
    await clientB.from("pauta_votos").insert({ pauta_id: id, user_id: b.id, voto: "aprovar" });

    const fechou = await coordClient.rpc("encerrar_votacao_pauta", { p_pauta_id: id });
    expect(fechou.error).toBeNull();
    expect(fechou.data).toBe("sem_quorum");

    const negado = await clientA.rpc("reabrir_votacao_pauta", { p_pauta_id: id });
    expect(negado.error).not.toBeNull();

    const reabriu = await coordClient.rpc("reabrir_votacao_pauta", { p_pauta_id: id });
    expect(reabriu.error).toBeNull();

    const { data: row } = await admin
      .from("pautas")
      .select("votacao_status, votacao_encerrada_em, votacao_encerrada_por")
      .eq("id", id)
      .single();
    expect(row).toEqual({
      votacao_status: "aberta",
      votacao_encerrada_em: null,
      votacao_encerrada_por: null,
    });

    const voltou = await clientA
      .from("pauta_votos")
      .update({ voto: "abster" })
      .eq("pauta_id", id)
      .eq("user_id", a.id)
      .select("id");
    expect(voltou.error).toBeNull();
    expect(voltou.data).toHaveLength(1);
  });

  it("PV-06: embeds explícitos de profiles não geram PGRST201", async () => {
    const a = await createFixtureUser();
    const clientA = await signInAs(a);
    const { data } = await criarPauta(clientA, { tipo: "deliberativa" });
    const id = data!.id as number;
    await clientA.from("pauta_votos").insert({ pauta_id: id, user_id: a.id, voto: "aprovar" });

    const pautas = await clientA
      .from("pautas")
      .select(
        "id, profiles!pautas_criado_por_fkey(full_name, email), encerrador:profiles!pautas_votacao_encerrada_por_fkey(full_name, email)"
      )
      .eq("id", id);
    expect(pautas.error).toBeNull();
    expect(pautas.data).toHaveLength(1);

    const votos = await clientA
      .from("pauta_votos")
      .select("id, profiles!pauta_votos_user_id_fkey(full_name, email)")
      .eq("pauta_id", id);
    expect(votos.error).toBeNull();
    expect(votos.data).toHaveLength(1);
  });
});

if (!canRun) {
  describe("pautas votação + RLS (live Supabase project)", () => {
    it.skip("SUPABASE_SERVICE_ROLE_KEY (ou outras variáveis do projeto) ausente — testes live ignorados", () => {});
  });
}
