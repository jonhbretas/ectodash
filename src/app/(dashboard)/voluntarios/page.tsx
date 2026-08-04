import Link from "next/link";
import { Lock, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";
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

  const [ativosResult, inativosResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, role, area_atuacao")
      .eq("ativo", true)
      .order("email"),
    supabase
      .from("profiles")
      .select("id, email, full_name, role, area_atuacao")
      .eq("ativo", false)
      .order("email"),
  ]);

  const rows = ativosResult.data ?? [];
  const inativos = inativosResult.data ?? [];

  return (
    <PageContainer>
      <div className="flex w-full max-w-4xl flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <Users size={28} aria-hidden="true" />
          Voluntários
        </h1>
        <p className="text-base text-zinc-700">
          {rows.length} {rows.length === 1 ? "voluntário" : "voluntários"} na
          instituição
          {inativos.length > 0 ? ` · ${inativos.length} desativado${inativos.length > 1 ? "s" : ""}` : ""}.
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
              <Link
                href={`/voluntarios/${row.id}`}
                className="flex min-w-0 flex-col gap-0.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <span className="truncate text-xl font-medium text-zinc-900">
                  {displayName(row)}
                </span>
                <span className="truncate text-base text-zinc-700">
                  {row.email}
                  {row.area_atuacao ? ` · ${row.area_atuacao}` : ""}
                </span>
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-base font-medium text-blue-800">
                  {ROLE_LABELS[row.role] ?? row.role}
                </span>
                <Link
                  href={`/voluntarios/${row.id}/editar`}
                  className="min-h-12 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  Editar
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {inativos.length > 0 && (
        <details className="w-full max-w-4xl">
          <summary className="min-h-14 cursor-pointer list-none text-2xl font-semibold text-zinc-900 marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
            Voluntários desativados ({inativos.length})
          </summary>
          <div className="mt-2 flex flex-col rounded-xl border border-zinc-200 bg-white shadow-sm">
            {inativos.map((row, index) => (
              <div
                key={row.email}
                className={`flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
                  index > 0 ? "border-t border-zinc-200" : ""
                }`}
              >
                <span className="truncate text-xl text-zinc-500 line-through">
                  {displayName(row)}
                </span>
                <Link
                  href={`/voluntarios/${row.id}/editar`}
                  className="min-h-12 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  Reativar / editar
                </Link>
              </div>
            ))}
          </div>
        </details>
      )}
    </PageContainer>
  );
}
