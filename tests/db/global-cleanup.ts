// Global setup do vitest (tests/db/global-cleanup.ts): roda UMA vez por
// invocação de `npm test`, antes de qualquer suíte — inclusive de testes
// unitários/componente. Remove do projeto real todo o lixo deixado por
// execuções anteriores que quebraram no meio (contas @example.invalid,
// voluntários "Novo Cadastro ..." e os dados criados por essas contas),
// via a função SECURITY DEFINER public.limpar_dados_teste() (migração
// 0062). Sem credenciais (ex.: CI sem .env.local), é um no-op silencioso,
// no mesmo padrão dos arquivos tests/db/*.test.ts.
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local não existe — confiar em variáveis de ambiente reais.
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function globalCleanup() {
  if (!supabaseUrl || !serviceRoleKey) return;
  const admin = createClient(supabaseUrl, serviceRoleKey);
  await admin.rpc("limpar_dados_teste");
}
