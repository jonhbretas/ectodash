import { createClient } from "@/lib/supabase/server";
import AppHeader from "./app-header";
import DemandaList from "./demandas/demanda-list";
import DemandaFilters from "./demandas/demanda-filters";
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
  // Next.js 16's documented shape (node_modules/next/dist/docs/01-app/
  // 01-getting-started/03-layouts-and-pages.md, "Rendering with search
  // params") — a Promise, read exclusively via this Server Component prop.
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // searchParams is untrusted URL input — zod-validated before any value
  // reaches a Supabase query, the same boundary-validation discipline
  // already applied to formData (05-RESEARCH.md Pattern 5).
  const filters = parseDemandaFilters(await searchParams);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards this route, but a defensive null-check keeps
  // this Server Component correct if it's ever rendered without middleware.
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("id", user.id)
    .single();

  const email = profile?.email ?? user.email;
  const role = profile?.role;

  // Role flags threaded to AppHeader — computed from the SAME profiles.role
  // read above, never separate queries. Purely UX-hiding decisions; every
  // destination keeps its own server-side role gate + RLS as the real
  // authorization boundary.
  const isCoordenador = role === "coordenador_geral";
  const isFinanceiro = role === "financeiro";
  const canExtractDemandas =
    role === "coordenador_geral" || role === "lider_area";

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
    // coordenador/financeiro/unknown — no notice (the unrestricted case
    // gets no UI, per the "don't add UI for the unrestricted case" rule).
    scopedViewNotice = null;
  }

  // Base role-scoped query (RLS already narrows this to whatever the
  // caller is allowed to see). demandas_com_status, not the bare demandas
  // table, is the read source — atrasada is read directly from this view's
  // server-computed column, never recomputed client-side (plan 04-01).
  let query = supabase
    .from("demandas_com_status")
    .select("id, titulo, prazo, status, area, atrasada")
    .order("prazo", { ascending: true });

  if (filters.area) {
    query = query.ilike("area", filters.area);
  }

  // Second query grouped client-side — the accepted N+1-adjacent tradeoff
  // documented in plan 04-04 (small expected data volume). The base read
  // feeds both the filter dropdown options AND, combined with the área
  // filter above, the actual filtered rows.
  const { data: baseDemandas } = await supabase
    .from("demandas_com_status")
    .select("id, area")
    .order("prazo", { ascending: true });

  const areaOptions = [
    ...new Set(
      (baseDemandas ?? [])
        .map((demanda) => demanda.area)
        .filter((area): area is string => Boolean(area && area.trim()))
    ),
  ].sort((a, b) => a.localeCompare(b));

  const { data: demandas } = await query;

  const demandaIds = (demandas ?? []).map((demanda) => demanda.id);
  const baseDemandaIds = (baseDemandas ?? []).map((demanda) => demanda.id);

  const { data: responsaveis } =
    baseDemandaIds.length > 0
      ? await supabase
          .from("demanda_responsaveis")
          .select("demanda_id, profile_id, profiles(email)")
          .in("demanda_id", baseDemandaIds)
      : {
          data: [] as {
            demanda_id: number;
            profile_id: string;
            profiles: { email: string } | null;
          }[],
        };

  const responsaveisPorDemanda = new Map<number, string[]>();
  const responsavelOptionById = new Map<string, string>();
  for (const row of responsaveis ?? []) {
    const profileRow = Array.isArray(row.profiles)
      ? row.profiles[0]
      : row.profiles;
    if (profileRow?.email) {
      responsavelOptionById.set(row.profile_id, profileRow.email);
    }
    if (demandaIds.includes(row.demanda_id)) {
      const emails = responsaveisPorDemanda.get(row.demanda_id) ?? [];
      if (profileRow?.email) {
        emails.push(profileRow.email);
      }
      responsaveisPorDemanda.set(row.demanda_id, emails);
    }
  }

  const responsavelOptions = [...responsavelOptionById.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  let demandaList = (demandas ?? []).map((demanda) => ({
    id: demanda.id,
    titulo: demanda.titulo,
    prazo: demanda.prazo,
    status: demanda.status,
    area: demanda.area,
    atrasada: demanda.atrasada,
    responsavelEmails: responsaveisPorDemanda.get(demanda.id) ?? [],
  }));

  if (filters.responsavel) {
    const matchingDemandaIds = new Set(
      (responsaveis ?? [])
        .filter((row) => row.profile_id === filters.responsavel)
        .map((row) => row.demanda_id)
    );
    demandaList = demandaList.filter((demanda) =>
      matchingDemandaIds.has(demanda.id)
    );
  }

  const filtersActive = Boolean(filters.area || filters.responsavel);

  // Personal stats strip — computed from the SAME demandaList already
  // fetched for the list, zero additional queries. Every user sees their
  // own numbers (the list is role-scoped by RLS), which turns the home
  // page into a mini-dashboard instead of a bare list.
  const stats = {
    total: demandaList.length,
    atrasadas: demandaList.filter((d) => d.atrasada).length,
    pendentes: demandaList.filter((d) => d.status === "pendente").length,
    emAndamento: demandaList.filter((d) => d.status === "em_andamento").length,
    concluidas: demandaList.filter((d) => d.status === "concluida").length,
  };

  return (
    <PageContainer>
      <AppHeader
        isCoordenador={isCoordenador}
        isFinanceiro={isFinanceiro}
        canExtractDemandas={canExtractDemandas}
      />

      <section className="flex w-full max-w-4xl flex-col gap-1">
        <h1 className="text-3xl font-semibold text-zinc-900">
          Olá, {email}
        </h1>
        <p className="text-xl text-zinc-700">
          Acompanhe suas demandas e prazos por aqui.
        </p>
      </section>

      {demandaList.length > 0 && (
        <div className="grid w-full max-w-4xl grid-cols-2 gap-4 lg:grid-cols-5">
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

      <div className="flex w-full max-w-4xl flex-col gap-4">
        {scopedViewNotice && (
          <p className="text-base text-zinc-700">{scopedViewNotice}</p>
        )}

        <DemandaFilters
          areaOptions={areaOptions}
          responsavelOptions={responsavelOptions}
          currentFilters={filters}
        />

        <DemandaList demandas={demandaList} groupBy={filters.agrupar} filtersActive={filtersActive} />
      </div>
    </PageContainer>
  );
}
