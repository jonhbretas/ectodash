import Link from "next/link";
import { Lock, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";

// Role labels — the four fixed institutional roles (0002_profiles_role.sql)
// in their pt-BR display names, the single place this mapping lives.
const ROLE_LABELS: Record<string, string> = {
  coordenador_geral: "Coordenador geral",
  lider_area: "Líder de área",
  voluntario_comum: "Voluntário comum",
  financeiro: "Financeiro",
};

export default async function VoluntariosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // A volunteer roster with every account's role is coordinator
  // information — same UX-layer gate /painel uses. RLS (0001/0002) is the
  // real boundary: a non-coordinator would only ever see their own row.
  if (profile?.role !== "coordenador_geral") {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">
            A lista de voluntários é exclusiva do coordenador
          </h1>
          <p className="max-w-md text-xl text-zinc-700">
            Você não tem acesso à equipe completa. Toque abaixo para voltar
            às suas demandas.
          </p>
          <Link
            href="/"
            className="flex min-h-14 items-center justify-center rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Ver minhas demandas
          </Link>
        </div>
      </PageContainer>
    );
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("email, role, created_at")
    .order("email");

  const rows = profiles ?? [];

  return (
    <PageContainer>
      <div className="flex w-full max-w-4xl flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <Users size={28} aria-hidden="true" />
          Voluntários
        </h1>
        <p className="text-base text-zinc-700">
          {rows.length} {rows.length === 1 ? "voluntário" : "voluntários"} na
          instituição.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex w-full max-w-4xl flex-col items-center gap-4 py-16 text-center">
          <Users size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhum voluntário cadastrado ainda
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            Cada voluntário entra por convite com o e-mail institucional.
          </p>
        </div>
      ) : (
        <div className="flex w-full max-w-4xl flex-col rounded-xl border border-zinc-200 bg-white shadow-sm">
          {rows.map((row, index) => (
            <div
              key={row.email}
              className={`flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
                index > 0 ? "border-t border-zinc-200" : ""
              }`}
            >
              <span className="truncate text-xl text-zinc-900">
                {row.email}
              </span>
              <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-base font-medium text-blue-800">
                {ROLE_LABELS[row.role] ?? row.role}
              </span>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
