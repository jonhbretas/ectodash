// /voluntarios — the institutional roster (public.voluntarios, migration
// 0017), full-width modern layout like demandas/eventos: stat pills, a
// search/filter bar, and the roster grouped by área with badge-carrying
// cards. The roster is decoupled from auth accounts: rows exist whether or
// not the volunteer has signed in, and a "Vinculado" badge marks rows whose
// account already completed the /vincular self-link flow.
//
// Access (RLS 0017 is the real boundary; this is the UX gate):
//   - coordenador_geral / voluntariado: full roster + manage;
//   - coordenador_area: their own áreas (RLS-scoped read + notice);
//   - voluntario_comum: only their own linked record.
import Link from "next/link";
import {
  Users,
  Plus,
  UserRoundCheck,
  CalendarClock,
  ShieldCheck,
  Pencil,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { roleLabel } from "@/lib/role-labels";
import PageContainer from "../page-container";
import { parseVoluntariosFilters } from "./voluntarios-filter-schema";
import VoluntariosFilters from "./voluntarios-filters";

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

function linkedProfile(row: VoluntarioRow) {
  if (!row.profiles) return null;
  return Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
}

function formatData(iso: string | null): string | null {
  if (!iso) return null;
  return format(new Date(`${iso}T00:00:00`), "dd/MM/yyyy", { locale: ptBR });
}

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

  // Voluntário comum: only their own linked record (RLS gives them nothing
  // else). No roster query at all — their own row is the whole screen.
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

  // Base read for the área options — unfiltered, so a filter never hides
  // its own options.
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
  const vinculados = all.filter((row) => linkedProfile(row)).length;

  // Group preserves alphabetical order of rows within each área; areas sort
  // by name with "Sem área definida" last.
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
        {(isFullRoster || isAreaScoped) && (
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
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
              <Users size={22} className="text-zinc-500" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-base font-medium text-zinc-500">Equipe</span>
                <span className="text-2xl font-semibold text-zinc-900">{all.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
              <ShieldCheck size={22} className="text-green-500" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-base font-medium text-zinc-500">Ativos</span>
                <span className="text-2xl font-semibold text-zinc-900">{ativos}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
              <CalendarClock size={22} className="text-amber-500" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-base font-medium text-zinc-500">Com saída marcada</span>
                <span className="text-2xl font-semibold text-zinc-900">{afastados}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
              <UserRoundCheck size={22} className="text-blue-500" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-base font-medium text-zinc-500">Vinculados</span>
                <span className="text-2xl font-semibold text-zinc-900">{vinculados}</span>
              </div>
            </div>
          </div>

          <VoluntariosFilters areaOptions={areaOptions} currentFilters={filters} />

          <div className="flex w-full flex-col gap-8">
            {grouped.map(([area, rowsInArea]) => (
              <section key={area} className="flex w-full flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="h-8 w-1.5 rounded-full bg-blue-600" aria-hidden="true" />
                  <h2 className="text-2xl font-semibold text-zinc-900 sm:text-3xl">{area}</h2>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-base font-medium text-blue-800">
                    {rowsInArea.length} {rowsInArea.length === 1 ? "voluntário" : "voluntários"}
                  </span>
                </div>
                <div className="flex w-full flex-col rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
                  {rowsInArea.map((row, index) => (
                    <VoluntarioCard
                      key={row.id}
                      row={row}
                      isLast={index === rowsInArea.length - 1}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function VoluntarioCard({ row, isLast }: { row: VoluntarioRow; isLast: boolean }) {
  const linked = linkedProfile(row);
  const afastado = Boolean(row.data_saida);
  const effectiveRole = linked?.role ?? row.role ?? "voluntario_comum";

  return (
    <div
      className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
        isLast ? "" : "border-b border-zinc-100"
      }`}
    >
      <Link
        href={`/voluntarios/${row.id}`}
        className="flex min-w-0 flex-col gap-1 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className={`truncate text-xl font-medium ${row.ativo ? "text-zinc-900" : "text-zinc-500 line-through"}`}>
            {row.nome}
          </span>
          {linked && (
            <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-base font-medium text-blue-800 ring-1 ring-blue-200/60">
              <UserRoundCheck size={14} aria-hidden="true" />
              Vinculado
            </span>
          )}
          {afastado && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-base font-medium text-amber-800 ring-1 ring-amber-200/60">
              Saída: {formatData(row.data_saida)}
            </span>
          )}
        </span>
        <span className="truncate text-base text-zinc-600">
          {[
            row.codigo_pf ? `Cód. PF ${row.codigo_pf}` : null,
            row.unidade,
            row.funcao,
            linked?.email ?? null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span className="truncate text-base text-zinc-500">
          {row.org_depto ?? "—"} · Desde {formatData(row.data_inicio) ?? "—"}
        </span>
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-base font-medium text-zinc-800 ring-1 ring-zinc-200/60">
          {roleLabel(effectiveRole)}
        </span>
        <Link
          href={`/voluntarios/${row.id}/editar`}
          className="flex min-h-12 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <Pencil size={16} aria-hidden="true" />
          Editar
        </Link>
      </div>
    </div>
  );
}

function MeuCadastroCard({ row, role }: { row: VoluntarioRow; role: string }) {
  const linked = linkedProfile(row);
  return (
    <PageContainer>
      <div className="flex w-full max-w-2xl flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="h-8 w-1.5 rounded-full bg-blue-600" aria-hidden="true" />
          <h2 className="text-2xl font-semibold text-zinc-900">Meu cadastro</h2>
        </div>
        <div className="flex w-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-semibold text-zinc-900">{row.nome}</span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-base font-medium text-zinc-800 ring-1 ring-zinc-200/60">
              {roleLabel(linked?.role ?? role)}
            </span>
          </div>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              ["Cód. PF", row.codigo_pf],
              ["Unidade", row.unidade],
              ["Org Depto", row.org_depto],
              ["Função", row.funcao],
              ["Data de início", formatData(row.data_inicio)],
              ["Data de saída", formatData(row.data_saida)],
            ].map(([label, value]) => (
              <div key={label as string} className="flex flex-col gap-0.5">
                <dt className="text-base text-zinc-500">{label}</dt>
                <dd className="text-xl text-zinc-900">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
          {row.obs && <p className="text-base text-zinc-600">Obs: {row.obs}</p>}
        </div>
      </div>
    </PageContainer>
  );
}
