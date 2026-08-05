// scripts/cleanup-test-data.ts
// Remove do banco de PRODUÇÃO os resíduos das suítes de teste de integração
// (tests/db/*): contas @example.invalid, seus perfis, e qualquer ata/demanda
// que os testes tenham deixado para trás (ex.: "Ata de teste cascade").
// Executar apenas com consciência: apaga dados reais de fixtures de teste.
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local ausente — usa variáveis de ambiente reais.
}

const env = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Faltando ${key} no ambiente`);
  return value;
};

async function main() {
  const supabase = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY")
  );

  // 1. Usuários de teste (@example.invalid)
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersError) throw usersError;

  const testUsers = users.users.filter((u) =>
    u.email?.toLowerCase().includes("example.invalid")
  );
  console.log(`Usuários de teste: ${testUsers.length}`);
  const testUserIds = testUsers.map((u) => u.id);

  // 2. Atas/demandas deixadas por eles (o resto dos testes limpa sozinho)
  if (testUserIds.length > 0) {
    const { data: atas } = await supabase
      .from("reunioes")
      .select("id, titulo")
      .in("criado_por", testUserIds);
    for (const ata of atas ?? []) {
      console.log(`  removendo ata ${ata.id} (${ata.titulo})`);
      const { error } = await supabase.from("reunioes").delete().eq("id", ata.id);
      if (error) console.error(`  falha ao remover ata ${ata.id}:`, error.message);
    }

    const { data: demandas } = await supabase
      .from("demandas")
      .select("id, titulo")
      .in("criado_por", testUserIds);
    for (const demanda of demandas ?? []) {
      console.log(`  removendo demanda ${demanda.id} (${demanda.titulo})`);
      const { error } = await supabase
        .from("demandas")
        .delete()
        .eq("id", demanda.id);
      if (error) console.error(`  falha ao remover demanda ${demanda.id}:`, error.message);
    }
  }

  // 3. Perfis e usuários
  for (const id of testUserIds) {
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) {
      console.error(`  falha ao remover usuário ${id}:`, error.message);
    }
  }

  console.log("Limpeza concluída.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
