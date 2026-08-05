import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";
import Link from "next/link";
import DemandaList from "./demandas/demanda-list";
import DemandaFilters from "./demandas/demanda-filters";
import DemandaViewToggle, {
  type DemandaView,
} from "./demandas/demanda-view-toggle";
import KanbanBoard from "./demandas/kanban-board";
import CalendarioView from "./demandas/calendario-view";
import PageContainer from "./page-container";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock,
  Plus,
} from "lucide-react";
import { parseDemandaFilters } from "./demandas/demanda-filter-schema";

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
    .select("email, full_name, role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  const { data: liderAreasRows } =
    role === "coordenador_area"
      ? await supabase.from("lider_areas").select("area").eq("lider_id", user.id)
      : { data: [] as { area: string }[] };

  const liderAreas = (liderAreasRows ?? []).map((row) => row.area);

  let scopedViewNotice: string | null = null;
  if (role === "voluntario_comum") {
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
    query = query.eq("status", filters.status);
  }

  const { data: baseDemandas } = await supabase
    .from("demandas_com_status")
    .select("id, area, projeto, status, atrasada, evento_id")
    .order("prazo", { ascending: true });

  const baseRows = baseDemandas ?? [];

  const areaOptions = [
    ...new Set(
      baseRows
        .map((d) => d.area)
        .filter((area): area is string => Boolean(area && area.trim()))
    ),
  ].sort((a, b) => a.localeCompare(b));

  const projetoOptions = [
    ...new Set(
      baseRows
        .map((d) => d.projeto)
        .filter((projeto): projeto is string => Boolean(projeto && projeto.trim()))
    ),
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

  const view: DemandaView = filters.view ?? "kanban";

  const stats = {
    total: demandaList.length,
    atrasadas: demandaList.filter((d) => d.atrasada).length,
    pendentes: demandaList.filter((d) => d.status === "pendente").length,
    emAndamento: demandaList.filter((d) => d.status === "em_andamento").length,
    concluidas: demandaList.filter((d) => d.status === "concluida").length,
  };

  const boardKey = demandaList
    .map((d) => `${d.id}:${d.status}`)
    .join("|");

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Olá, {displayName(profile ?? { email: user.email ?? "" })}
          </h1>
          <p className="text-sm text-slate-500">
            Acompanhe suas demandas e prazos por aqui.
          </p>
        </div>
        <Link
          href="/demandas/nova"
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)] transition-all duration-200 hover:from-blue-700 hover:to-blue-600 hover:shadow-[0_4px_12px_rgba(37,99,235,0.35)] hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <Plus size={18} aria-hidden="true" />
          Nova demanda
        </Link>
      </header>

      {demandaList.length > 0 && (
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60 transition-shadow duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
              <ClipboardList size={18} className="text-slate-500" aria-hidden="true" strokeWidth={1.75} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-500">Demandas</span>
              <span className="text-2xl font-bold tracking-tight text-slate-900">{stats.total}</span>
            </div>
          </div>
          <div className={`flex items-center gap-3 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] ${
            stats.atrasadas > 0
              ? "bg-red-50 ring-1 ring-red-200/60"
              : "bg-white ring-1 ring-slate-200/60"
          }`}>
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stats.atrasadas > 0 ? "bg-red-100" : "bg-slate-100"}`}>
              <AlertTriangle size={18} className={stats.atrasadas > 0 ? "text-red-600" : "text-slate-400"} aria-hidden="true" strokeWidth={1.75} />
            </div>
            <div className="flex flex-col">
              <span className={`text-sm font-medium ${stats.atrasadas > 0 ? "text-red-600" : "text-slate-500"}`}>Atrasadas</span>
              <span className={`text-2xl font-bold tracking-tight ${stats.atrasadas > 0 ? "text-red-700" : "text-slate-900"}`}>{stats.atrasadas}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60 transition-shadow duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
              <Circle size={18} className="text-amber-500" aria-hidden="true" strokeWidth={1.75} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-500">Pendentes</span>
              <span className="text-2xl font-bold tracking-tight text-slate-900">{stats.pendentes}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60 transition-shadow duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <Clock size={18} className="text-blue-500" aria-hidden="true" strokeWidth={1.75} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-500">Em andamento</span>
              <span className="text-2xl font-bold tracking-tight text-slate-900">{stats.emAndamento}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60 transition-shadow duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50">
              <CheckCircle2 size={18} className="text-green-500" aria-hidden="true" strokeWidth={1.75} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-500">Concluídas</span>
              <span className="text-2xl font-bold tracking-tight text-slate-900">{stats.concluidas}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex w-full flex-col gap-5">
        {scopedViewNotice && (
          <p className="rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 ring-1 ring-blue-200/60">
            {scopedViewNotice}
          </p>
        )}

        <DemandaFilters
          areaOptions={areaOptions}
          projetoOptions={projetoOptions}
          eventoOptions={eventosResult.data ?? []}
          etiquetaOptions={etiquetasResult.data ?? []}
          responsavelOptions={responsavelOptions}
          currentFilters={filters}
        />

        <div className="flex w-full items-center justify-end">
          <DemandaViewToggle currentView={view} />
        </div>

        {view === "kanban" ? (
          <KanbanBoard key={boardKey} demandas={demandaList} />
        ) : view === "calendario" ? (
          <CalendarioView demandas={demandaList} />
        ) : (
          <DemandaList
            demandas={demandaList}
            groupBy={filters.agrupar}
            filtersActive={filtersActive}
          />
        )}
      </div>
    </PageContainer>
  );
}
