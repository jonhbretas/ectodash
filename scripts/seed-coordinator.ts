// One-off, never-deployed script. Lives outside src/ and must never be
// imported by a page, route, component, or Server Action — it holds the
// service-role key, which bypasses every RLS policy. Run locally with:
//   npm run seed:coordinator -- <email> [--role=<papel>]
// Papéis válidos: coordenador_geral, coordenador_area, voluntario_comum,
// financeiro, voluntariado (padrão: voluntario_comum).
import { createClient } from "@supabase/supabase-js";
import { parseInviteArgs } from "./lib/role-arg.ts";

async function main() {
  const parsed = parseInviteArgs(process.argv.slice(2));

  if (!parsed.ok) {
    console.error(parsed.error);
    process.exitCode = 1;
    return;
  }

  const { email, role } = parsed;

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

  const userId = data.user.id;

  // The Phase 1 trigger inserts the public.profiles row on invite, defaulted
  // to voluntario_comum. When a different role was requested, apply it as a
  // second step with the service-role client — this bypasses RLS by design,
  // because this script is the only trusted role-assignment path until a
  // future admin surface exists.
  if (role !== "voluntario_comum") {
    const { error: roleError } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId);

    if (roleError) {
      console.error(
        `Convite enviado, mas falha ao definir o papel ${role} para ${email}: ${roleError.message}`
      );
      process.exitCode = 1;
      return;
    }
  }

  console.log(
    `Usuário convidado com sucesso. id=${userId} papel=${role}`
  );
}

main();
