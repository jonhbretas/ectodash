import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

try { process.loadEnvFile(".env.local"); } catch { /* CI pode não ter credenciais. */ }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !key || !serviceKey)("jornada: persistência, duplicatas e isolamento (Supabase)", () => {
  let admin: SupabaseClient;
  let first: SupabaseClient;
  let second: SupabaseClient;
  const users: string[] = [];
  const volunteers: number[] = [];

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    async function fixture() {
      const email = `ectodash-test-jornada-${crypto.randomUUID()}@example.invalid`;
      const password = `Test-${crypto.randomUUID()}!`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) throw error ?? new Error("Sem usuário de teste");
      users.push(data.user.id);
      const { data: profile } = await admin.from("profiles").select("voluntario_id").eq("id", data.user.id).single();
      if (profile?.voluntario_id) volunteers.push(profile.voluntario_id);
      const client = createClient(url!, key!, { auth: { persistSession: false } });
      const login = await client.auth.signInWithPassword({ email, password });
      if (login.error) throw login.error;
      return client;
    }
    first = await fixture();
    second = await fixture();
  });

  afterAll(async () => {
    for (const id of users) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
    }
    for (const id of volunteers) {
      const { error } = await admin.from("voluntarios").delete().eq("id", id);
      if (error) throw error;
    }
  });

  it("salva uma etapa uma única vez, inclusive em gravações concorrentes", async () => {
    const row = { profile_id: users[0], etapa_id: "voluntario:boas-vindas" };
    const results = await Promise.all([1, 2].map(() => first.from("jornada_exploracao").upsert(row, { onConflict: "profile_id,etapa_id", ignoreDuplicates: true })));
    results.forEach((result) => expect(result.error).toBeNull());
    const { data, error } = await first.from("jornada_exploracao").select("etapa_id");
    expect(error).toBeNull();
    expect(data).toEqual([{ etapa_id: row.etapa_id }]);
  });

  it("não expõe descobertas de outra pessoa", async () => {
    const { data, error } = await second.from("jornada_exploracao").select("etapa_id").eq("profile_id", users[0]);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("impede pontuar na conta de outra pessoa", async () => {
    const { error } = await second.from("jornada_exploracao").insert({ profile_id: users[0], etapa_id: "docente:livro" });
    expect(error).not.toBeNull();
  });

  it("rejeita etapas inexistentes e alterações no histórico", async () => {
    const invalid = await first.from("jornada_exploracao").insert({ profile_id: users[0], etapa_id: "xp-infinito" });
    expect(invalid.error?.code).toBe("23514");
    const update = await first.from("jornada_exploracao").update({ profile_id: users[1] }).eq("profile_id", users[0]);
    expect(update.error).not.toBeNull();
    const remove = await first.from("jornada_exploracao").delete().eq("profile_id", users[0]);
    expect(remove.error).not.toBeNull();
  });

  it("nega acesso sem autenticação", async () => {
    const anonymous = createClient(url!, key!, { auth: { persistSession: false } });
    const result = await anonymous.from("jornada_exploracao").select("etapa_id");
    expect(result.error).not.toBeNull();
  });
});
