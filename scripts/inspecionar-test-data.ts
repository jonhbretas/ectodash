// scripts/inspecionar-test-data.ts
// Lists the database rows created by the live integration test suites
// (tests/db/*): fixture auth users (@example.invalid), their profiles, and
// the fixture voluntarios rows they left behind. Read-only — the cleanup
// script (cleanup-test-data.ts) deletes what this one reports.
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local ausente — usa variáveis de ambiente reais.
}

function env(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Faltando ${key} no ambiente`);
  return value;
}

async function main() {
  const supabase = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY")
  );

  const { data: users, error: usersError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersError) throw usersError;

  const testUsers = users.users.filter((u) =>
    u.email?.toLowerCase().includes("example.invalid")
  );
  console.log(`Usuários de teste (@example.invalid): ${testUsers.length}`);
  for (const u of testUsers.slice(0, 50)) {
    console.log(`  ${u.id}  ${u.email}  criado ${u.created_at}`);
  }

  const testUserIds = testUsers.map((u) => u.id);

  if (testUserIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, voluntario_id, role, vincular_pendente")
      .in("id", testUserIds);
    if (profilesError) throw profilesError;
    console.log(`\nPerfis dos usuários de teste: ${profiles?.length ?? 0}`);
    for (const p of profiles ?? []) {
      console.log(`  ${p.id}  voluntario_id=${p.voluntario_id ?? "-"} role=${p.role ?? "-"} pending=${p.vincular_pendente}`);
    }

    const linkedVoluntarioIds = (profiles ?? [])
      .map((p) => p.voluntario_id)
      .filter((v): v is number => v !== null);
    if (linkedVoluntarioIds.length > 0) {
      const { data: vols, error: volsError } = await supabase
        .from("voluntarios")
        .select("id, nome, ativo, situacao")
        .in("id", linkedVoluntarioIds);
      if (volsError) throw volsError;
      console.log(`\nCadastros vinculados aos usuários de teste: ${vols?.length ?? 0}`);
      for (const v of vols ?? []) {
        console.log(`  ${v.id}  ${v.nome}  ativo=${v.ativo} situacao=${v.situacao}`);
      }
    }
  }

  const { data: suspeitos, error: suspeitosError } = await supabase
    .from("voluntarios")
    .select("id, nome, ativo, created_at")
    .ilike("nome", "%Teste%");
  if (suspeitosError) throw suspeitosError;
  console.log(`\nCadastros com 'Teste' no nome: ${suspeitos?.length ?? 0}`);
  for (const v of suspeitos ?? []) {
    console.log(`  ${v.id}  ${v.nome}  ativo=${v.ativo} criado ${v.created_at}`);
  }

  // Demandas, atas, DIPs e registros deixados pelos usuários de teste
  if (testUserIds.length > 0) {
    const { data: demandas } = await supabase
      .from("demandas")
      .select("id, titulo, criado_por")
      .in("criado_por", testUserIds);
    console.log(`\nDemandas criadas pelos usuarios de teste: ${demandas?.length ?? 0}`);
    for (const d of demandas ?? []) console.log(`  ${d.id}  ${d.titulo}`);

    const { data: atas } = await supabase
      .from("reunioes")
      .select("id, titulo, criado_por")
      .in("criado_por", testUserIds);
    console.log(`\nAtas criadas pelos usuarios de teste: ${atas?.length ?? 0}`);
    for (const a of atas ?? []) console.log(`  ${a.id}  ${a.titulo}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
