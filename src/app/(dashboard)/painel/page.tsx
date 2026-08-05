import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, Circle, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import StatCard from "@/components/stat-card";
import PageContainer from "../page-container";
import type { DemandaTableRow } from "../demandas/demanda-table";
import AreaSummary, { type AreaSummaryRow } from "./area-summary";
import ResponsavelSummary, {
  type ResponsavelSummaryRow,
} from "./responsavel-summary";
import OverduePanel from "./overdue-panel";
import ReminderRunsPanel, {
  type ReminderRunRow,
} from "./reminder-runs-panel";
import SheetSyncPanel, { type SheetSyncRunRow } from "./sheet-sync-panel";
import AreasConfig from "./areas-config";

// Matches demanda-list.tsx's SEM_AREA_DEFINIDA constant exactly, character
// for character — the coordinator dashboard's área breakdown must never
// visually disagree with the personal dashboard's grouped view for the same
// underlying data (06-RESEARCH.md Pitfall 5).
const SEM_AREA_DEFINIDA = "Sem área definida";

export default async function PainelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts already guards unauthenticated visitors — this mirrors
  // page.tsx's existing precedent, not a new auth mechanism.
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase.from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // UX-LAYER CONVENIENCE ONLY — never the authorization boundary. Every
  // Supabase query below runs through this caller's own ordinary
  // authenticated client; RLS (migration 0004, already live) is what
  // actually determines what rows come back, regardless of whether this
  // branch is ever bypassed or buggy.
  if (profile?.role !== "coordenador_geral") {
    return (
      <PageContainer>
          <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">
            Este painel é exclusivo do coordenador
          </h1>
          <p className="max-w-md text-xl text-zinc-700">
            Você não tem acesso ao painel geral da instituição. Toque abaixo
            para voltar às suas demandas.
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

  // Institution-wide flat read — no .eq()/.ilike() filter; this IS the
  // institution-wide read, per migration 0004's coordenador SELECT branch
  // (first OR-branch, has_role('coordenador_geral'), no further condition).
  const { data: rows } = await supabase.from("demandas_com_status")
    .select("id, titulo, prazo, status, area, atrasada");

  const allRows = rows ?? [];

  return (
    <PageContainer>

      <div className="flex w-full max-w-4xl flex-col gap-2">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Painel do coordenador
        </h1>
        <p className="text-base text-zinc-700">
          Visão geral de todas as demandas da instituição.
        </p>
      </div>

      {allRows.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <ClipboardList
            size={48}
            className="text-zinc-400"
            aria-hidden="true"
          />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhuma demanda cadastrada na instituição ainda
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            Quando as áreas começarem a cadastrar demandas, o resumo da
            instituição vai aparecer aqui.
          </p>
          <Link
            href="/"
            className="flex min-h-14 items-center justify-center rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Ver demandas
          </Link>
        </div>
      ) : (
        <PainelContent rows={allRows} supabase={supabase} />
      )}
    </PageContainer>
  );
}

type PainelRow = {
  id: number;
  titulo: string;
  prazo: string;
  status: "pendente" | "em_andamento" | "concluida";
  area: string | null;
  atrasada: boolean;
};

async function PainelContent({
  rows,
  supabase,
}: {
  rows: PainelRow[];
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  const total = rows.length;
  const pendentes = rows.filter((r) => r.status === "pendente").length;
  const emAndamento = rows.filter((r) => r.status === "em_andamento").length;
  const concluidas = rows.filter((r) => r.status === "concluida").length;
  const atrasadas = rows.filter((r) => r.atrasada).length;

  // Área counts + each área's overdue sub-count, computed from the SAME
  // flat rows fetch — no second query needed for this
  // (06-RESEARCH.md Pattern 1/2).
  const areaCounts = new Map<string, { count: number; overdueCount: number }>();
  for (const row of rows) {
    const key = row.area?.trim() || SEM_AREA_DEFINIDA;
    const existing = areaCounts.get(key) ?? { count: 0, overdueCount: 0 };
    existing.count += 1;
    if (row.atrasada) existing.overdueCount += 1;
    areaCounts.set(key, existing);
  }
  const areaRows: AreaSummaryRow[] = [...areaCounts.entries()].map(
    ([area, { count, overdueCount }]) => ({ area, count, overdueCount })
  );

  // Overdue rows, sorted by prazo ascending — derived from the same rows
  // fetch, no second query.
  const overdueRows = rows
    .filter((row) => row.atrasada)
    .sort((a, b) => a.prazo.localeCompare(b.prazo));
  const atrasadaByDemandaId = new Map<number, boolean>(
    rows.map((row) => [row.id, row.atrasada])
  );

  // Second query, separate from the flat read above — the institution-wide
  // read for the responsável breakdown, per migration 0004's
  // demanda_responsaveis SELECT policy having the same unconditional
  // coordenador branch. ONE batched query, never a per-volunteer loop
  // (06-RESEARCH.md Pattern 1b, Pitfall 3). Each row normalizes to the
  // ROSTER volunteer id/name (profile rows resolve via voluntario_id) —
  // volunteers without an account still show as responsáveis.
  const { data: responsaveisRows } = await supabase.from("demanda_responsaveis")
    .select(
      "demanda_id, profile_id, voluntario_id, profiles(email, full_name, voluntario_id), voluntarios(nome)"
    );

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

  const countsByResponsavel = new Map<
    string,
    { email: string; count: number; overdueCount: number }
  >();
  for (const row of (responsaveisRows ?? []) as unknown as RowResponsavel[]) {
    const voluntarioId = row.voluntario_id ?? row.profiles?.voluntario_id;
    if (voluntarioId === null || voluntarioId === undefined) continue;
    const label =
      row.voluntarios?.nome ??
      row.profiles?.full_name?.trim() ??
      row.profiles?.email;
    if (!label) continue;
    const key = String(voluntarioId);
    const existing = countsByResponsavel.get(key) ?? {
      email: label,
      count: 0,
      overdueCount: 0,
    };
    existing.count += 1;
    if (atrasadaByDemandaId.get(row.demanda_id)) {
      existing.overdueCount += 1;
    }
    countsByResponsavel.set(key, existing);
  }

  const responsavelRows: ResponsavelSummaryRow[] = [
    ...countsByResponsavel.entries(),
  ].map(([profileId, { email, count, overdueCount }]) => ({
    profileId,
    email,
    count,
    overdueCount,
  }));

  // Overdue panel rows need the same shape DemandaTable/DemandaCard already
  // expect — responsavelEmails is derived per-demanda from the same
  // responsaveisRows fetch, one pass, no additional query.
  const emailsByDemandaId = new Map<number, string[]>();
  for (const row of (responsaveisRows ?? []) as unknown as RowResponsavel[]) {
    const label =
      row.voluntarios?.nome ??
      row.profiles?.full_name?.trim() ??
      row.profiles?.email;
    if (!label) continue;
    const emails = emailsByDemandaId.get(row.demanda_id) ?? [];
    emails.push(label);
    emailsByDemandaId.set(row.demanda_id, emails);
  }

  const overduePanelRows: DemandaTableRow[] = overdueRows.map((row) => ({
    id: row.id,
    titulo: row.titulo,
    responsavelEmails: emailsByDemandaId.get(row.id) ?? [],
    prazo: row.prazo,
    status: row.status,
    atrasada: row.atrasada,
    area: row.area,
  }));

  // Reminder-job run log (LEMB-04) — same ordinary authenticated `supabase`
  // client already used for every other /painel query above; never an
  // elevated-privilege admin client on this page. Coordenador-only via
  // reminder_runs' own RLS SELECT policy (migration 0005) — this query
  // naturally returns rows only because page.tsx has already confirmed the
  // caller's role above (07-RESEARCH.md, 07-03-PLAN.md must_haves).
  const { data: reminderRunRows } = await supabase.from("reminder_runs")
    .select(
      "id, started_at, finished_at, status, sent_count, failed_count, skipped_count, error_message"
    )
    .order("started_at", { ascending: false })
    .limit(20);

  const reminderRuns: ReminderRunRow[] = (reminderRunRows ?? []).map(
    (row) => ({
      id: row.id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      status: row.status,
      sentCount: row.sent_count,
      failedCount: row.failed_count,
      skippedCount: row.skipped_count,
      errorMessage: row.error_message,
    })
  );

  // Sheets-sync run log (FIN-03) — same coordenador-only RLS story as
  // reminder_runs above: this query only returns rows for the coordenador
  // (migration 0006's financeiro/coordenador SELECT policy is a superset).
  const { data: sheetSyncRunRows } = await supabase.from("sheet_sync_runs")
    .select(
      "id, started_at, finished_at, status, entries_count, error_message"
    )
    .order("started_at", { ascending: false })
    .limit(20);

  const sheetSyncRuns: SheetSyncRunRow[] = (sheetSyncRunRows ?? []).map(
    (row) => ({
      id: row.id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      status: row.status,
      entriesCount: row.entries_count,
      errorMessage: row.error_message,
    })
  );

  return (
    <>
      <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Total de demandas"
          value={total}
          Icon={ClipboardList}
          iconClassName="text-zinc-700"
        />
        <StatCard
          label="Atrasadas"
          value={atrasadas}
          Icon={AlertTriangle}
          highlight
        />
        <StatCard
          label="Pendentes"
          value={pendentes}
          Icon={Circle}
          iconClassName="text-amber-700"
        />
        <StatCard
          label="Em andamento"
          value={emAndamento}
          Icon={Clock}
          iconClassName="text-blue-700"
        />
        <StatCard
          label="Concluídas"
          value={concluidas}
          Icon={CheckCircle2}
          iconClassName="text-green-700"
        />
      </div>

      <AreaSummary rows={areaRows} />
      <ResponsavelSummary rows={responsavelRows} />
      <OverduePanel demandas={overduePanelRows} />

      <PainelAreasSection supabase={supabase} />

      <ReminderRunsPanel runs={reminderRuns} />
      <SheetSyncPanel runs={sheetSyncRuns} />
    </>
  );
}

async function PainelAreasSection({
  supabase,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  const { data: areas } = await supabase
    .from("areas_institucionais")
    .select("id, nome, area_mae_id")
    .order("nome");

  return <AreasConfig areas={(areas ?? []) as { id: number; nome: string; area_mae_id: number | null }[]} />;
}
