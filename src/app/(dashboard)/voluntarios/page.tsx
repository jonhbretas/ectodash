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
import { Users, Plus, Layers, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import { parseVoluntariosFilters } from "./voluntarios-filter-schema";
import VoluntariosFilters from "./voluntarios-filters";
import VoluntariosListClient, { type AreaNode } from "./voluntarios-list";
import MeuCadastroCard from "./meu-cadastro-card";
import MergeVincularSection, {
  type MergePerfilOpcao,
} from "./merge-vincular-section";

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
  situacao: string | null;
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
    .select("id, area_atuacao, unidade");

  const areaOptions = [
    ...new Set(
      (baseRows ?? [])
        .map((row) => row.area_atuacao)
        .filter((area): area is string => Boolean(area && area.trim()))
    ),
  ].sort((a, b) => a.localeCompare(b));

  const localidadeOptions = [
    ...new Set(
      (baseRows ?? [])
        .map((row) => row.unidade)
        .filter((localidade): localidade is string => Boolean(localidade && localidade.trim()))
    ),
  ].sort((a, b) => a.localeCompare(b));

  // Dados do merge (migration 0028): perfis e cadastros perdidos.
  const [perfisMergeResult, voluntariosMergeResult] =
    role === "coordenador_geral" || role === "voluntariado"
      ? await Promise.all([
          supabase
            .from("profiles")
            .select("id, email, voluntario_id, vincular_pendente")
            .order("email"),
          supabase
            .from("voluntarios")
            .select("id, nome")
            .order("nome"),
        ])
      : [
          { data: [] as { id: string; email: string; voluntario_id: number | null; vincular_pendente: boolean }[] },
          { data: [] as { id: number; nome: string }[] },
        ];

  const perfisVinculadosAoRoster = new Set(
    (perfisMergeResult.data ?? []).map((p) => p.voluntario_id)
  );
  const nomePorVoluntario = new Map(
    (voluntariosMergeResult.data ?? []).map((v) => [v.id, v.nome])
  );
  const perfisMerge: MergePerfilOpcao[] = (perfisMergeResult.data ?? []).map(
    (p) => ({
      id: p.id,
      email: p.email,
      voluntarioId: p.voluntario_id,
      vinculadoNome:
        p.voluntario_id !== null
          ? (nomePorVoluntario.get(p.voluntario_id) ?? "cadastro removido")
          : null,
      pendente: p.vincular_pendente,
    })
  );
  const cadastrosPerdidos = (voluntariosMergeResult.data ?? [])
    .filter((v) => !perfisVinculadosAoRoster.has(v.id))
    .map((v) => ({ id: v.id, nome: v.nome }));

  let query = supabase
    .from("voluntarios")
    .select(
      "id, nome, codigo_pf, unidade, org_depto, funcao, data_inicio, data_saida, obs, area_atuacao, role, ativo, situacao, profiles(email, role)"
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
  if (filters.localidade) {
    query = query.eq("unidade", filters.localidade);
  }
  if (filters.situacao) {
    query = query.eq("situacao", filters.situacao);
  }

  const { data: rows } = await query;
  const all = (rows ?? []) as VoluntarioRow[];

  const ativos = all.filter((row) => row.ativo).length;
  const ociosos = all.filter((row) => row.situacao === "ocioso").length;
  const afastados = all.filter((row) => row.data_saida).length;
  const vinculados = all.filter((row) => {
    const linked = !row.profiles ? null : Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return Boolean(linked);
  }).length;

  // Desligados (ativo = false) vão para a seção própria no fim da lista;
  // as áreas mostram apenas os ativos.
  const desligados = all.filter((row) => !row.ativo);
  const ativosRows = all.filter((row) => row.ativo);

  // ── Agrupamento hierárquico por org_depto ──────────────────────────
  // O campo org_depto segue o padrão "ECTOLAB \ Área \ Subárea". Cada
  // nível da hierarquia vira um nó da árvore, com as áreas registradas
  // em areas_institucionais definindo a estrutura-pai.
  function parseOrgDepto(
    orgDepto: string | null
  ): { area: string; subArea: string | null } | null {
    if (!orgDepto?.trim()) return null;
    const parts = orgDepto
      .split("\\")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length < 2) return null;
    const area = parts[1];
    const subArea = parts.length >= 3 ? parts[2] : null;
    return { area, subArea };
  }

  // Voluntários ativos agrupados por área pai → subárea (ou null).
  const hierarquia = new Map<string, Map<string | null, VoluntarioRow[]>>();
  const semOrgDepto: VoluntarioRow[] = [];

  for (const row of ativosRows) {
    const parsed = parseOrgDepto(row.org_depto);
    if (!parsed) {
      semOrgDepto.push(row);
      continue;
    }
    if (!hierarquia.has(parsed.area)) {
      hierarquia.set(parsed.area, new Map());
    }
    const subMap = hierarquia.get(parsed.area)!;
    const bucket = subMap.get(parsed.subArea) ?? [];
    bucket.push(row);
    subMap.set(parsed.subArea, bucket);
  }

  // Árvore de áreas a partir do registro institucional (áreas mãe com
  // suas subáreas aninhadas), em ordem alfabética. Voluntários de áreas
  // não registradas entram como nós livres.
  const { data: areasRegistro } = await supabase
    .from("areas_institucionais")
    .select("id, nome, area_mae_id")
    .order("nome");

  const registroPorNome = new Map(
    (areasRegistro ?? []).map((a) => [a.nome, a])
  );
  const subPorMae = new Map<string, string[]>();
  for (const area of areasRegistro ?? []) {
    if (area.area_mae_id === null) continue;
    const mae = (areasRegistro ?? []).find((a) => a.id === area.area_mae_id);
    if (!mae) continue;
    const lista = subPorMae.get(mae.nome) ?? [];
    lista.push(area.nome);
    subPorMae.set(mae.nome, lista);
  }

  function construirNo(nome: string): AreaNode {
    const subAreas = (subPorMae.get(nome) ?? [])
      .sort((a, b) => a.localeCompare(b))
      .map(construirNo)
      .filter((no) => no.rows.length > 0 || no.subAreas.length > 0);
    // Voluntários diretamente nesta área (sem subárea no org_depto).
    const direto = hierarquia.get(nome)?.get(null) ?? [];
    return { nome, rows: direto, subAreas };
  }

  const nomesMae = [...subPorMae.keys()].filter(
    (nome) => registroPorNome.get(nome)?.area_mae_id === null
  );
  const maesSemSub = [...registroPorNome.values()]
    .filter((a) => a.area_mae_id === null && !subPorMae.has(a.nome))
    .map((a) => a.nome);
  const arvoreRegistrada = [...new Set([...nomesMae, ...maesSemSub])]
    .sort((a, b) => a.localeCompare(b))
    .map(construirNo)
    .filter((no) => no.rows.length > 0 || no.subAreas.length > 0);

  // Áreas usadas no org_depto mas não registradas em areas_institucionais.
  const usadasNaoRegistradas = [...hierarquia.keys()]
    .filter((nome) => !registroPorNome.has(nome))
    .sort((a, b) => a.localeCompare(b))
    .map(construirNo)
    .filter((no) => no.rows.length > 0);

  const areaTree: AreaNode[] = [...arvoreRegistrada, ...usadasNaoRegistradas];
  if (semOrgDepto.length > 0) {
    areaTree.push({ nome: SEM_AREA_DEFINIDA, rows: semOrgDepto, subAreas: [] });
  }

  const filtersActive = Boolean(filters.busca || filters.area || filters.localidade || filters.situacao);

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
            <p className="mt-1 rounded-xl bg-[#f5f0eb] px-4 py-2 text-base font-medium text-[#8b5e2a]">
              Mostrando apenas os voluntários das suas áreas de coordenação.
            </p>
          )}
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            {role === "coordenador_geral" && (
              <>
                <Link
                  href="/areas"
                  className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-xl font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]"
                >
                  <Layers size={22} aria-hidden="true" />
                  Cadastro de áreas
                </Link>
                <Link
                  href="/voluntarios/localidades"
                  className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-xl font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]"
                >
                  <MapPin size={22} aria-hidden="true" />
                  Cadastro de localidades
                </Link>
              </>
            )}
            <Link
              href="/voluntarios/novo"
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#d4883a] px-5 text-xl font-medium text-white shadow-[0_1px_3px_rgba(212,136,58,0.25)] transition-all duration-200 hover:bg-[#c07828] hover:shadow-[0_2px_6px_rgba(212,136,58,0.3)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]"
            >
              <Plus size={22} aria-hidden="true" />
              Novo voluntário
            </Link>
          </div>
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
          <VoluntariosFilters
            areaOptions={areaOptions}
            localidadeOptions={localidadeOptions}
            currentFilters={filters}
          />

          <VoluntariosListClient
            areas={areaTree}
            all={all}
            ativos={ativos}
            ociosos={ociosos}
            afastados={afastados}
            vinculados={vinculados}
            desligados={desligados}
            canManage={canManage}
            areaOptions={areaOptions}
          />

          {role === "coordenador_geral" && (
            <MergeVincularSection
              perfis={perfisMerge}
              cadastrosPerdidos={cadastrosPerdidos}
            />
          )}
        </div>
      )}
    </PageContainer>
  );
}
