import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";
import Link from "next/link";
import DemandaList from "./demandas/demanda-list";
import DemandaFilters from "./demandas/demanda-filters";
import {
  DemandaStatusFilter,
  DemandaAgruparFilter,
} from "./demandas/demanda-quick-filters";
import DemandaViewToggle, {
  type DemandaView,
} from "./demandas/demanda-view-toggle";
import KanbanBoard from "./demandas/kanban-board";
import CalendarioView from "./demandas/calendario-view";
import PageContainer from "./page-container";
import {
  Plus,
  UserCheck,
} from "lucide-react";
import { parseDemandaFilters } from "./demandas/demanda-filter-schema";
import { groupDemandas } from "./demandas/demanda-groups";
import { cn } from "@/lib/utils";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const filters = parseDemandaFilters(await searchParams);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, role, voluntario_id")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  const meuVoluntarioId = profile?.voluntario_id ?? null;
  const minhasDemandasAtivas = Boolean(
    meuVoluntarioId !== null && filters.responsavel === String(meuVoluntarioId)
  );
  const minhasDemandasHref = minhasDemandasAtivas
    ? "/"
    : `/?responsavel=${meuVoluntarioId ?? ""}`;

  const { data: liderAreasRows } =
    role === "coordenador_area"
      ? await supabase.from("lider_areas").select("area").eq("lider_id", user.id)
      : { data: [] as { area: string }[] };

  const liderAreas = (liderAreasRows ?? []).map((row) => row.area);

  let scopedViewNotice: string | null = null;
  if (minhasDemandasAtivas) {
    scopedViewNotice = "Mostrando apenas as demandas atribuídas a você.";
  } else if (role === "voluntario_comum") {
    scopedViewNotice = "Mostrando apenas as demandas atribuídas a você.";
  } else if (role === "coordenador_area") {
    if (liderAreas.length === 0) {
      scopedViewNotice = "Mostrando apenas as demandas atribuídas a você.";
    } else if (liderAreas.length === 1) {
      scopedViewNotice = `Mostrando as demandas da área ${liderAreas[0]}.`;
    } else {
      const allButLast = liderAreas.slice(0, -1).join(", ");
      const last = liderAreas[liderAreas.length - 1];
      scopedViewNotice = `Mostrando as demandas das áreas ${allButLast} e ${last}.`;
    }
  } else {
    scopedViewNotice = null;
  }

  let query = supabase
    .from("demandas_com_status")
    .select("id, titulo, prazo, status, area, projeto, evento_id, etiqueta_id, atrasada")
    .order("prazo", { ascending: true });

  if (filters.area) {
    query = query.ilike("area", filters.area);
  }
  if (filters.projeto) {
    query = query.ilike("projeto", filters.projeto);
  }
  if (filters.evento) {
    query = query.eq("evento_id", Number(filters.evento));
  }
  if (filters.etiqueta) {
    query = query.eq("etiqueta_id", Number(filters.etiqueta));
  }
  if (filters.status) {
    query = query.in("status", filters.status.split(","));
  }

  const { data: baseDemandas } = await supabase
    .from("demandas_com_status")
    .select("id, area, projeto, status, atrasada, evento_id")
    .order("prazo", { ascending: true });

  const baseRows = baseDemandas ?? [];

  const { data: areasInstitucionaisRows } = await supabase
    .from("areas_institucionais")
    .select("nome")
    .order("nome");

  const { data: projetosCadastrados } = await supabase
    .from("projetos")
    .select("nome")
    .order("nome");

  const areaOptions = [
    ...new Set([
      ...(areasInstitucionaisRows ?? []).map((a) => a.nome),
      ...baseRows
        .map((d) => d.area)
        .filter((area): area is string => Boolean(area && area.trim())),
    ]),
  ].sort((a, b) => a.localeCompare(b));

  const projetoOptions = [
    ...new Set([
      ...(projetosCadastrados ?? []).map((p) => p.nome),
      ...baseRows
        .map((d) => d.projeto)
        .filter((projeto): projeto is string => Boolean(projeto && projeto.trim())),
    ]),
  ].sort((a, b) => a.localeCompare(b));

  const { data: demandas } = await query;

  const demandaIds = (demandas ?? []).map((demanda) => demanda.id);
  const baseDemandaIds = baseRows.map((demanda) => demanda.id);

  const [responsaveisResult, eventosResult, etiquetasResult, checklistResult] =
    await Promise.all([
      baseDemandaIds.length > 0
        ? supabase
            .from("demanda_responsaveis")
            .select(
              "demanda_id, profile_id, voluntario_id, profiles(email, full_name, voluntario_id), voluntarios(nome)"
            )
            .in("demanda_id", baseDemandaIds)
        : Promise.resolve({
            data: [] as {
              demanda_id: number;
              profile_id: string | null;
              voluntario_id: number | null;
              profiles: {
                email: string;
                full_name: string | null;
                voluntario_id: number | null;
              } | null;
              voluntarios: { nome: string } | null;
            }[],
          }),
      supabase.from("eventos").select("id, titulo, data_evento, local").order("data_evento", { ascending: true }),
      supabase.from("etiquetas").select("id, area, nome").order("area").order("nome"),
      baseDemandaIds.length > 0
        ? supabase
            .from("demanda_checklist")
            .select("demanda_id, concluido")
            .in("demanda_id", baseDemandaIds)
        : Promise.resolve({ data: [] as { demanda_id: number; concluido: boolean }[] }),
    ]);

  const responsaveis = (responsaveisResult.data ?? []) as unknown as RowResponsavel[];
  const eventoById = new Map(
    (eventosResult.data ?? []).map((evento) => [evento.id, evento.titulo])
  );
  const etiquetaById = new Map(
    (etiquetasResult.data ?? []).map((etiqueta) => [etiqueta.id, etiqueta])
  );

  const checklistPorDemanda = new Map<number, { total: number; feitos: number }>();
  for (const row of checklistResult.data ?? []) {
    const current = checklistPorDemanda.get(row.demanda_id) ?? { total: 0, feitos: 0 };
    current.total += 1;
    if (row.concluido) current.feitos += 1;
    checklistPorDemanda.set(row.demanda_id, current);
  }

  type RowResponsavel = {
    demanda_id: number;
    profile_id: string | null;
    voluntario_id: number | null;
    profiles: {
      email: string;
      full_name: string | null;
      voluntario_id: number | null;
    } | null;
    voluntarios: { nome: string } | null;
  };

  function voluntarioIdDaRow(row: RowResponsavel): number | null {
    return row.voluntario_id ?? row.profiles?.voluntario_id ?? null;
  }

  function nomeDaRow(row: RowResponsavel): string | null {
    if (row.voluntarios?.nome) return row.voluntarios.nome;
    if (row.profiles?.full_name?.trim()) return row.profiles.full_name;
    if (row.profiles?.email) return row.profiles.email;
    return null;
  }

  const responsaveisPorDemanda = new Map<number, string[]>();
  const responsavelOptionById = new Map<string, string>();
  for (const row of responsaveis) {
    const voluntarioId = voluntarioIdDaRow(row);
    const label = nomeDaRow(row);
    if (voluntarioId === null || !label) continue;
    responsavelOptionById.set(String(voluntarioId), label);
    if (demandaIds.includes(row.demanda_id)) {
      const labels = responsaveisPorDemanda.get(row.demanda_id) ?? [];
      labels.push(label);
      responsaveisPorDemanda.set(row.demanda_id, labels);
    }
  }

  const responsavelOptions = [...responsavelOptionById.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  let demandaList = (demandas ?? []).map((demanda) => {
    const etiqueta = demanda.etiqueta_id
      ? (etiquetaById.get(demanda.etiqueta_id) ?? null)
      : null;
    const checklist = checklistPorDemanda.get(demanda.id);
    return {
      id: demanda.id,
      titulo: demanda.titulo,
      prazo: demanda.prazo,
      status: demanda.status,
      area: demanda.area,
      projeto: demanda.projeto,
      atrasada: demanda.atrasada,
      eventoNome: demanda.evento_id
        ? (eventoById.get(demanda.evento_id) ?? null)
        : null,
      etiquetaNome: etiqueta ? `${etiqueta.nome} (${etiqueta.area})` : null,
      checklistTotal: checklist?.total ?? 0,
      checklistFeitos: checklist?.feitos ?? 0,
      responsavelEmails: responsaveisPorDemanda.get(demanda.id) ?? [],
    };
  });

  if (filters.responsavel) {
    const matchingDemandaIds = new Set(
      responsaveis
        .filter(
          (row) => String(voluntarioIdDaRow(row)) === filters.responsavel
        )
        .map((row) => row.demanda_id)
    );
    demandaList = demandaList.filter((demanda) =>
      matchingDemandaIds.has(demanda.id)
    );
  }

  const filtersActive = Boolean(
    filters.area ||
      filters.projeto ||
      filters.evento ||
      filters.etiqueta ||
      filters.responsavel ||
      filters.status
  );

  // "lista" is the ABSENCE of the ?view param (demanda-filter-schema.ts) —
  // the toggle deletes it, so the fallback here must be "lista", not
  // "kanban", or the Lista button would never take effect.
  const view: DemandaView = filters.view ?? "lista";

  const boardKey = demandaList
    .map((d) => `${d.id}:${d.status}`)
    .join("|");

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Olá, {displayName(profile ?? { email: user.email ?? "" })}
          </h1>
          <p className="text-sm text-slate-500">
            Acompanhe suas demandas e prazos por aqui.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DemandaFilters
            areaOptions={areaOptions}
            projetoOptions={projetoOptions}
            eventoOptions={eventosResult.data ?? []}
            etiquetaOptions={etiquetasResult.data ?? []}
            responsavelOptions={responsavelOptions}
            currentFilters={filters}
          />

          <div className="mr-2 lg:mr-4">
            <DemandaViewToggle currentView={view} />
          </div>

          {meuVoluntarioId !== null && (
            <Link
              href={minhasDemandasHref}
              title={
                minhasDemandasAtivas
                  ? "Voltar para todas as demandas"
                  : "Mostrar apenas as demandas atribuídas a você"
              }
              className={cn(
                "flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium ring-1 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]",
                minhasDemandasAtivas
                  ? "bg-[#E6E6E6] text-[#2195B9] ring-[#E6E6E6] hover:bg-[#E6E6E6]"
                  : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <UserCheck size={18} aria-hidden="true" />
              Minhas demandas
            </Link>
          )}
          <Link
            href="/demandas/nova"
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2195B9] to-[#FDBA2F] px-5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(33,149,185,0.25)] transition-all duration-200 hover:from-[#28627B] hover:to-[#2195B9] hover:shadow-[0_4px_12px_rgba(33,149,185,0.35)] hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            <Plus size={18} aria-hidden="true" />
            Nova demanda
          </Link>
        </div>
      </header>

      <div className="flex w-full flex-col gap-5">
        {scopedViewNotice && (
          <p className="rounded-xl bg-[#E6E6E6] px-4 py-2.5 text-sm font-medium text-[#2195B9] ring-1 ring-[#E6E6E6]/60">
            {scopedViewNotice}
          </p>
        )}

        {view !== "lista" && (
          <div className="flex flex-wrap items-center gap-2">
            <DemandaStatusFilter currentFilters={filters} />
            <DemandaAgruparFilter currentFilters={filters} />
          </div>
        )}

        {view === "kanban" ? (
          filters.agrupar ? (
            <div className="flex w-full flex-col gap-8">
              {groupDemandas(demandaList, filters.agrupar).map((group) => (
                <div key={group.label} className="flex w-full flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold text-zinc-900">
                      {group.label}
                    </h3>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-base font-medium text-zinc-600">
                      {group.items.length === 1
                        ? "1 demanda"
                        : `${group.items.length} demandas`}
                    </span>
                  </div>
                  <KanbanBoard
                    key={`${boardKey}-${group.label}`}
                    demandas={group.items}
                  />
                </div>
              ))}
            </div>
          ) : (
            <KanbanBoard key={boardKey} demandas={demandaList} />
          )
        ) : view === "calendario" ? (
          <CalendarioView demandas={demandaList} />
        ) : (
          <DemandaList
            demandas={demandaList}
            currentFilters={filters}
            groupBy={filters.agrupar}
            filtersActive={filtersActive}
            canExcluir={
              role === "coordenador_geral" || role === "coordenador_area"
            }
          />
        )}
      </div>
    </PageContainer>
  );
}
