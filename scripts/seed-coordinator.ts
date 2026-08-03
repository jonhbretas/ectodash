// One-off, never-deployed script. Lives outside src/ and must never be
// imported by a page, route, component, or Server Action — it holds the
// service-role key, which bypasses every RLS policy. Run locally with:
//   npm run seed:coordinator -- <email>
import { createClient } from "@supabase/supabase-js";

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Uso: npm run seed:coordinator -- <email>");
    process.exitCode = 1;
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!supabaseUrl || !serviceRoleKey || !siteUrl) {
    console.error(
      "Faltam variáveis de ambiente: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL"
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/callback`,
  });

  if (error || !data?.user) {
    console.error(
      `Falha ao convidar ${email}: ${error?.message ?? "erro desconhecido"}`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Usuário convidado com sucesso. id=${data.user.id}`);
}

main();
