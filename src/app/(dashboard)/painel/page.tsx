import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, Circle, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import StatCard from "@/components/stat-card";
import PageContainer from "../page-container";
import type { DemandaTableRow } from "../demandas/demanda-table";
import AreaSummary, { type AreaSummaryRow } from "./area-summary";
import ResponsavelSummary, { type ResponsavelSummaryRow } from "./responsavel-summary";
import OverduePanel from "./overdue-panel";
import ReminderRunsPanel, { type ReminderRunRow } from "./reminder-runs-panel";
import SheetSyncPanel, { type SheetSyncRunRow } from "./sheet-sync-panel";
import AreasConfig from "./areas-config";
import PainelTabs from "./painel-tabs";

const SEM_AREA_DEFINIDA = "Sem area definida";

export default async function PainelPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles")
    .select("role").eq("id", user.id).single();

  if (profile?.role !== "coordenador_geral") {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-slate-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-slate-900">Este painel e exclusivo do coordenador</h1>
          <p className="max-w-md text-lg text-slate-600">Voce nao tem acesso ao painel geral da instituicao. Toque abaixo para voltar as suas demandas.</p>
          <Link href="/" className="flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)] transition-all duration-200 hover:from-blue-700 hover:to-blue-600">
            Ver minhas demandas
          </Link>
        </div>
      </PageContainer>
    );
  }

  const { data: rows } = await supabase.from("demandas_com_status")
    .select("id, titulo, prazo, status, area, atrasada");
  const allRows = rows ?? [];

  return (
    <PageContainer>
      <div className="flex w-full flex-col gap-2">
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-[0_2px_8px_rgba(37,99,235,0.25)]">
            <ClipboardList size={20} className="text-white" aria-hidden="true" strokeWidth={1.75} />
          </div>
          Painel do coordenador
        </h1>
        <p className="text-sm text-slate-500">Visao geral de todas as demandas da instituicao.</p>
      </div>

      {allRows.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <ClipboardList size={48} className="text-slate-300" aria-hidden="true" />
          <h2 className="text-2xl font-semibold text-slate-900">Nenhuma demanda cadastrada na instituicao ainda</h2>
          <p className="max-w-md text-sm text-slate-600">Quando as areas comecarem a cadastrar demandas, o resumo da instituicao vai aparecer aqui.</p>
          <Link href="/" className="flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)] transition-all duration-200 hover:from-blue-700 hover:to-blue-600">
            Ver demandas
          </Link>
        </div>
      ) : (
        <PainelContent rows={allRows} supabase={supabase} />
      )}
    </PageContainer>
  );
}

type PainelRow = { id: number; titulo: string; prazo: string; status: "pendente" | "em_andamento" | "concluida"; area: string | null; atrasada: boolean };

async function PainelContent({ rows, supabase }: { rows: PainelRow[]; supabase: Awaited<ReturnType<typeof createClient>> }) {
  const total = rows.length;
  const pendentes = rows.filter((r) => r.status === "pendente").length;
  const emAndamento = rows.filter((r) => r.status === "em_andamento").length;
  const concluidas = rows.filter((r) => r.status === "concluida").length;
  const atrasadas = rows.filter((r) => r.atrasada).length;

  const areaCounts = new Map<string, { count: number; overdueCount: number }>();
  for (const row of rows) {
    const key = row.area?.trim() || SEM_AREA_DEFINIDA;
    const existing = areaCounts.get(key) ?? { count: 0, overdueCount: 0 };
    existing.count += 1;
    if (row.atrasada) existing.overdueCount += 1;
    areaCounts.set(key, existing);
  }
  const areaRows: AreaSummaryRow[] = [...areaCounts.entries()].map(([area, { count, overdueCount }]) => ({ area, count, overdueCount }));

  const overdueRows = rows.filter((row) => row.atrasada).sort((a, b) => a.prazo.localeCompare(b.prazo));
  const atrasadaByDemandaId = new Map<number, boolean>(rows.map((row) => [row.id, row.atrasada]));

  const { data: responsaveisRows } = await supabase.from("demanda_responsaveis")
    .select("demanda_id, profile_id, voluntario_id, profiles(email, full_name, voluntario_id), voluntarios(nome)");

  type RowResponsavel = { demanda_id: number; profile_id: string | null; voluntario_id: number | null; profiles: { email: string; full_name: string | null; voluntario_id: number | null } | null; voluntarios: { nome: string } | null };

  const countsByResponsavel = new Map<string, { email: string; count: number; overdueCount: number }>();
  for (const row of (responsaveisRows ?? []) as unknown as RowResponsavel[]) {
    const voluntarioId = row.voluntario_id ?? row.profiles?.voluntario_id;
    if (voluntarioId === null || voluntarioId === undefined) continue;
    const label = row.voluntarios?.nome ?? row.profiles?.full_name?.trim() ?? row.profiles?.email;
    if (!label) continue;
    const key = String(voluntarioId);
    const existing = countsByResponsavel.get(key) ?? { email: label, count: 0, overdueCount: 0 };
    existing.count += 1;
    if (atrasadaByDemandaId.get(row.demanda_id)) existing.overdueCount += 1;
    countsByResponsavel.set(key, existing);
  }
  const responsavelRows: ResponsavelSummaryRow[] = [...countsByResponsavel.entries()].map(([profileId, { email, count, overdueCount }]) => ({ profileId, email, count, overdueCount }));

  const emailsByDemandaId = new Map<number, string[]>();
  for (const row of (responsaveisRows ?? []) as unknown as RowResponsavel[]) {
    const label = row.voluntarios?.nome ?? row.profiles?.full_name?.trim() ?? row.profiles?.email;
    if (!label) continue;
    const emails = emailsByDemandaId.get(row.demanda_id) ?? [];
    emails.push(label);
    emailsByDemandaId.set(row.demanda_id, emails);
  }
  const overduePanelRows: DemandaTableRow[] = overdueRows.map((row) => ({ id: row.id, titulo: row.titulo, responsavelEmails: emailsByDemandaId.get(row.id) ?? [], prazo: row.prazo, status: row.status, atrasada: row.atrasada, area: row.area }));

  const { data: reminderRunRows } = await supabase.from("reminder_runs")
    .select("id, started_at, finished_at, status, sent_count, failed_count, skipped_count, error_message")
    .order("started_at", { ascending: false }).limit(20);
  const reminderRuns: ReminderRunRow[] = (reminderRunRows ?? []).map((row) => ({ id: row.id, startedAt: row.started_at, finishedAt: row.finished_at, status: row.status, sentCount: row.sent_count, failedCount: row.failed_count, skippedCount: row.skipped_count, errorMessage: row.error_message }));

  const { data: sheetSyncRunRows } = await supabase.from("sheet_sync_runs")
    .select("id, started_at, finished_at, status, entries_count, error_message")
    .order("started_at", { ascending: false }).limit(20);
  const sheetSyncRuns: SheetSyncRunRow[] = (sheetSyncRunRows ?? []).map((row) => ({ id: row.id, startedAt: row.started_at, finishedAt: row.finished_at, status: row.status, entriesCount: row.entries_count, errorMessage: row.error_message }));

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total de demandas" value={total} Icon={ClipboardList} iconClassName="text-slate-600" />
        <StatCard label="Atrasadas" value={atrasadas} Icon={AlertTriangle} highlight />
        <StatCard label="Pendentes" value={pendentes} Icon={Circle} iconClassName="text-amber-600" />
        <StatCard label="Em andamento" value={emAndamento} Icon={Clock} iconClassName="text-blue-600" />
        <StatCard label="Concluidas" value={concluidas} Icon={CheckCircle2} iconClassName="text-green-600" />
      </div>

      <PainelTabs
        tabs={[
          {
            id: "visao-geral",
            label: "Visão geral",
            content: (
              <>
                <AreaSummary rows={areaRows} />
                <ResponsavelSummary rows={responsavelRows} />
              </>
            ),
          },
          {
            id: "atrasadas",
            label: "Atrasadas",
            badge: atrasadas,
            content: <OverduePanel demandas={overduePanelRows} />,
          },
          {
            id: "areas",
            label: "Áreas",
            content: <PainelAreasSection supabase={supabase} />,
          },
          {
            id: "lembretes",
            label: "Lembretes",
            content: <ReminderRunsPanel runs={reminderRuns} />,
          },
          {
            id: "planilha",
            label: "Planilha",
            content: <SheetSyncPanel runs={sheetSyncRuns} />,
          },
        ]}
      />
    </div>
  );
}

async function PainelAreasSection({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
  const { data: areas } = await supabase.from("areas_institucionais").select("id, nome, area_mae_id").order("nome");
  return <AreasConfig areas={(areas ?? []) as { id: number; nome: string; area_mae_id: number | null }[]} />;
}
