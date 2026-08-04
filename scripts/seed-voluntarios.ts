// One-off, never-deployed script. Lives outside src/ and must never be
// imported by a page, route, component, or Server Action — it holds the
// service-role key, which bypasses every RLS policy. Run locally with:
//   npm run seed:voluntarios
// Creates FICTITIOUS volunteer accounts (clearly fictional names and
// institutional-style emails) with full_name set, so the UI shows names
// instead of raw emails while the real volunteers are onboarded.
import { createClient } from "@supabase/supabase-js";

type FictionalVolunteer = {
  name: string;
  email: string;
  role: "lider_area" | "voluntario_comum" | "financeiro";
};

// All names and emails are fabricated — never real institutional people.
const VOLUNTEERS: FictionalVolunteer[] = [
  { name: "Ana Beatriz Souza", email: "ana.souza@ectolab.org", role: "lider_area" },
  { name: "Bruno Carvalho", email: "bruno.carvalho@ectolab.org", role: "lider_area" },
  { name: "Carla Mendes", email: "carla.mendes@ectolab.org", role: "voluntario_comum" },
  { name: "Diego Fernandes", email: "diego.fernandes@ectolab.org", role: "voluntario_comum" },
  { name: "Elisa Nogueira", email: "elisa.nogueira@ectolab.org", role: "voluntario_comum" },
  { name: "Felipe Ramos", email: "felipe.ramos@ectolab.org", role: "voluntario_comum" },
  { name: "Gabriela Lima", email: "gabriela.lima@ectolab.org", role: "voluntario_comum" },
  { name: "Henrique Alves", email: "henrique.alves@ectolab.org", role: "financeiro" },
];

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Faltam variáveis de ambiente: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  let created = 0;
  let skipped = 0;

  for (const volunteer of VOLUNTEERS) {
    // Skip accounts that already exist — the script is idempotent.
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", volunteer.email)
      .maybeSingle();

    if (existing) {
      console.log(`Já existe: ${volunteer.email} — atualizando full_name.`);
      const { error: nameError } = await supabase
        .from("profiles")
        .update({ full_name: volunteer.name, role: volunteer.role })
        .eq("id", existing.id);
      if (nameError) {
        console.error(`Falha ao atualizar ${volunteer.email}: ${nameError.message}`);
        process.exitCode = 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: volunteer.email,
      email_confirm: true,
      user_metadata: { full_name: volunteer.name },
    });

    if (error || !data?.user) {
      console.error(
        `Falha ao criar ${volunteer.email}: ${error?.message ?? "erro desconhecido"}`
      );
      process.exitCode = 1;
      continue;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: volunteer.name, role: volunteer.role })
      .eq("id", data.user.id);

    if (profileError) {
      console.error(
        `Conta criada, mas falha ao definir nome/papel de ${volunteer.email}: ${profileError.message}`
      );
      process.exitCode = 1;
      continue;
    }

    created += 1;
    console.log(`Criado: ${volunteer.name} <${volunteer.email}> (${volunteer.role})`);
  }

  console.log(`\nConcluído: ${created} criados, ${skipped} já existentes.`);
}

main();
