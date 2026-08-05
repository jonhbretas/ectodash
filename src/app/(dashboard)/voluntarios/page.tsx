// /voluntarios — the institutional roster (public.voluntarios, migration
// 0017), full-width modern layout like demandas/eventos: stat pills, a
// search/filter bar, and the roster grouped by área with multi-select,
// bulk actions, and collapsible sections.
//
// Access (RLS 0017 is the real boundary; this is the UX gate):
//   - coordenador_geral / voluntariado: full roster + manage;
//   - coordenador_area: their own áreas (RLS-scoped read + notice);
//   - voluntario_comum: only their own linked record.
import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import { parseVoluntariosFilters } from "./voluntarios-filter-schema";
import VoluntariosFilters from "./voluntarios-filters";
import VoluntariosListClient from "./voluntarios-list";
import MeuCadastroCard from "./meu-cadastro-card";

type VoluntarioRow = {
  id: number;
  nome: string;
  codigo_pf: string | null;
  unidade: string | null;
  org_depto: string | null;
  funcao: string | null;
  data_inicio: string | null;
  data_saida: string | null;
  obs: string | null;
  area_atuacao: string | null;
  role: string | null;
  ativo: boolean;
  profiles:
    | { email: string; role: string }[]
    | { email: string; role: string }
    | null;
};

const SEM_AREA_DEFINIDA = "Sem área definida";

export default async function VoluntariosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const filters = parseVoluntariosFilters(await searchParams);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, voluntario_id")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  const isFullRoster = role === "coordenador_geral" || role === "voluntariado";
  const isAreaScoped = role === "coordenador_area";
  const canManage = isFullRoster || isAreaScoped;

  if (!isFullRoster && !isAreaScoped) {
    if (!profile?.voluntario_id) {
      return (
        <PageContainer>
          <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
            <Users size={48} className="text-zinc-400" aria-hidden="true" />
            <h1 className="text-3xl font-semibold text-zinc-900">
              Seu cadastro ainda não foi vinculado
            </h1>
            <p className="max-w-md text-xl text-zinc-700">
              Se você já entrou pelo link de acesso, fale com o coordenador
              para vincular seu cadastro.
            </p>
          </div>
        </PageContainer>
      );
    }

    const { data: meu } = await supabase
      .from("voluntarios")
      .select(
        "id, nome, codigo_pf, unidade, org_depto, funcao, data_inicio, data_saida, obs, area_atuacao, role, ativo, profiles(email, role)"
      )
      .eq("id", profile.voluntario_id)
      .maybeSingle();

    if (!meu) {
      return null;
    }

    return <MeuCadastroCard row={meu as VoluntarioRow} role={role ?? ""} />;
  }

  const { data: baseRows } = await supabase
    .from("voluntarios")
    .select("id, area_atuacao");

  const areaOptions = [
    ...new Set(
      (baseRows ?? [])
        .map((row) => row.area_atuacao)
        .filter((area): area is string => Boolean(area && area.trim()))
    ),
  ].sort((a, b) => a.localeCompare(b));

  let query = supabase
    .from("voluntarios")
    .select(
      "id, nome, codigo_pf, unidade, org_depto, funcao, data_inicio, data_saida, obs, area_atuacao, role, ativo, profiles(email, role)"
    )
    .order("nome", { ascending: true });

  if (filters.busca) {
    query = query.or(
      `nome.ilike.%${filters.busca}%,codigo_pf.ilike.%${filters.busca}%`
    );
  }
  if (filters.area) {
    query = query.eq("area_atuacao", filters.area);
  }

  const { data: rows } = await query;
  const all = (rows ?? []) as VoluntarioRow[];

  const ativos = all.filter((row) => row.ativo).length;
  const afastados = all.filter((row) => row.data_saida).length;
  const vinculados = all.filter((row) => {
    const linked = !row.profiles ? null : Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return Boolean(linked);
  }).length;

  const groups = new Map<string, VoluntarioRow[]>();
  for (const row of all) {
    const key = row.area_atuacao?.trim() || SEM_AREA_DEFINIDA;
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }
  const grouped = [...groups.entries()].sort(([a], [b]) => {
    if (a === SEM_AREA_DEFINIDA) return 1;
    if (b === SEM_AREA_DEFINIDA) return -1;
    return a.localeCompare(b);
  });

  const filtersActive = Boolean(filters.busca || filters.area);

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <Users size={30} aria-hidden="true" />
            Voluntários
          </h1>
          <p className="text-xl text-zinc-500">
            Equipe da instituição — cadastro e coordenações por área.
          </p>
          {isAreaScoped && (
            <p className="mt-1 rounded-xl bg-blue-50 px-4 py-2 text-base font-medium text-blue-800">
              Mostrando apenas os voluntários das suas áreas de coordenação.
            </p>
          )}
        </div>
        {canManage && (
          <Link
            href="/voluntarios/novo"
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-xl font-medium text-white shadow-[0_1px_3px_rgba(29,78,216,0.25)] transition-all duration-200 hover:bg-blue-600 hover:shadow-[0_2px_6px_rgba(29,78,216,0.3)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <Plus size={22} aria-hidden="true" />
            Novo voluntário
          </Link>
        )}
      </header>

      {all.length === 0 ? (
        <>
          {filtersActive ? (
            <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
              <Users size={48} className="text-zinc-400" aria-hidden="true" />
              <h2 className="text-3xl font-semibold text-zinc-900">
                Nenhum voluntário encontrado
              </h2>
              <p className="max-w-md text-xl text-zinc-700">
                Ajuste a busca ou os filtros para encontrar o voluntário.
              </p>
            </div>
          ) : (
            <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
              <Users size={48} className="text-zinc-400" aria-hidden="true" />
              <h2 className="text-3xl font-semibold text-zinc-900">
                Nenhum voluntário cadastrado ainda
              </h2>
              <p className="max-w-md text-xl text-zinc-700">
                Cadastre os voluntários da instituição para montar a equipe.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="flex w-full flex-col gap-5">
          <VoluntariosFilters areaOptions={areaOptions} currentFilters={filters} />

          <VoluntariosListClient
            grouped={grouped}
            all={all}
            ativos={ativos}
            afastados={afastados}
            vinculados={vinculados}
            canManage={canManage}
            areaOptions={areaOptions}
          />
        </div>
      )}
    </PageContainer>
  );
}
