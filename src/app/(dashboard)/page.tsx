import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";
import DemandaList from "./demandas/demanda-list";
import DemandaFilters from "./demandas/demanda-filters";
import DemandaViewToggle, {
  type DemandaView,
} from "./demandas/demanda-view-toggle";
import KanbanBoard from "./demandas/kanban-board";
import CalendarioView from "./demandas/calendario-view";
import PageContainer from "./page-container";
import StatCard from "@/components/stat-card";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock,
} from "lucide-react";
import { parseDemandaFilters } from "./demandas/demanda-filter-schema";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // searchParams is untrusted URL input — zod-validated before any value
  // reaches a Supabase query (05-RESEARCH.md Pattern 5).
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

  // Only read when the caller is a lider_area.
  const { data: liderAreasRows } =
    role === "lider_area"
      ? await supabase.from("lider_areas").select("area").eq("lider_id", user.id)
      : { data: [] as { area: string }[] };

  const liderAreas = (liderAreasRows ?? []).map((row) => row.area);

  // Role-scoped-view notice, computed once server-side.
  let scopedViewNotice: string | null = null;
  if (role === "voluntario_comum") {
    scopedViewNotice = "Mostrando apenas as demandas atribuídas a você.";
  } else if (role === "lider_area") {
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

  // Base role-scoped query (RLS narrows it). demandas_com_status is the
  // read source — atrasada and evento_id come from the view directly.
  let query = supabase
    .from("demandas_com_status")
    .select("id, titulo, prazo, status, area, projeto, evento_id, etiqueta_id, atrasada")
    .order("prazo", { ascending: true });

  // All filter dimensions, combined with AND, each applied as a query
  // modifier BEFORE data reaches the client.
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

  // Base read for dropdown options — same role-scoped source, unfiltered,
  // so a filter never disappears an option it isn't filtering on.
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
            .select("demanda_id, profile_id, profiles(email, full_name)")
            .in("demanda_id", baseDemandaIds)
        : Promise.resolve({
            data: [] as {
              demanda_id: number;
              profile_id: string;
              profiles: { email: string; full_name: string | null } | null;
            }[],
          }),
      supabase.from("eventos").select("id, titulo").order("data_evento", { ascending: true }),
      supabase.from("etiquetas").select("id, area, nome").order("area").order("nome"),
      baseDemandaIds.length > 0
        ? supabase
            .from("demanda_checklist")
            .select("demanda_id, concluido")
            .in("demanda_id", baseDemandaIds)
        : Promise.resolve({ data: [] as { demanda_id: number; concluido: boolean }[] }),
    ]);

  const responsaveis = responsaveisResult.data ?? [];
  const eventoById = new Map(
    (eventosResult.data ?? []).map((evento) => [evento.id, evento.titulo])
  );
  const etiquetaById = new Map(
    (etiquetasResult.data ?? []).map((etiqueta) => [etiqueta.id, etiqueta])
  );

  // Checklist progress per demanda — one batched read, counted client-side.
  const checklistPorDemanda = new Map<number, { total: number; feitos: number }>();
  for (const row of checklistResult.data ?? []) {
    const current = checklistPorDemanda.get(row.demanda_id) ?? { total: 0, feitos: 0 };
    current.total += 1;
    if (row.concluido) current.feitos += 1;
    checklistPorDemanda.set(row.demanda_id, current);
  }

  const responsaveisPorDemanda = new Map<number, string[]>();
  const responsavelOptionById = new Map<string, string>();
  for (const row of responsaveis) {
    const profileRow = Array.isArray(row.profiles)
      ? row.profiles[0]
      : row.profiles;
    if (profileRow) {
      const label = displayName(profileRow);
      responsavelOptionById.set(row.profile_id, label);
      if (demandaIds.includes(row.demanda_id)) {
        const labels = responsaveisPorDemanda.get(row.demanda_id) ?? [];
        labels.push(label);
        responsaveisPorDemanda.set(row.demanda_id, labels);
      }
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
        .filter((row) => row.profile_id === filters.responsavel)
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

  const view: DemandaView = filters.view ?? "lista";

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
      <section className="flex w-full max-w-7xl flex-col gap-1">
        <h1 className="text-3xl font-semibold text-zinc-900">
          Olá, {displayName(profile ?? { email: user.email ?? "" })}
        </h1>
        <p className="text-xl text-zinc-700">
          Acompanhe suas demandas e prazos por aqui.
        </p>
      </section>

      {demandaList.length > 0 && (
        <div className="grid w-full max-w-7xl grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard
            label="Suas demandas"
            value={stats.total}
            Icon={ClipboardList}
          />
          <StatCard
            label="Atrasadas"
            value={stats.atrasadas}
            Icon={AlertTriangle}
            highlight={stats.atrasadas > 0}
          />
          <StatCard
            label="Pendentes"
            value={stats.pendentes}
            Icon={Circle}
            iconClassName="text-amber-700"
          />
          <StatCard
            label="Em andamento"
            value={stats.emAndamento}
            Icon={Clock}
            iconClassName="text-blue-700"
          />
          <StatCard
            label="Concluídas"
            value={stats.concluidas}
            Icon={CheckCircle2}
            iconClassName="text-green-700"
          />
        </div>
      )}

      <div className="flex w-full max-w-7xl flex-col gap-4">
        {scopedViewNotice && (
          <p className="text-base text-zinc-700">{scopedViewNotice}</p>
        )}

        <DemandaFilters
          areaOptions={areaOptions}
          projetoOptions={projetoOptions}
          eventoOptions={eventosResult.data ?? []}
          etiquetaOptions={etiquetasResult.data ?? []}
          responsavelOptions={responsavelOptions}
          currentFilters={filters}
        />

        <DemandaViewToggle currentView={view} />

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
