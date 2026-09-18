import Link from "next/link";
import { ArrowLeft, Mail, BellRing } from "lucide-react";
import PageContainer from "../../page-container";
import { requireMarketingGate } from "../page";
import ReminderRunsPanel, {
  type ReminderRunRow,
} from "../../painel/reminder-runs-panel";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  queued: "Na fila",
  testing: "Testando A/B",
  sending: "Disparando",
  sent: "Enviada",
  failed: "Falhou",
};

export default async function HistoricoPage() {
  const gate = await requireMarketingGate();
  if (gate.blocked) {
    return (
      <PageContainer>
        <p className="py-16 text-center text-lg text-zinc-500">Acesso restrito ao coordenador geral ou à comunicação.</p>
      </PageContainer>
    );
  }
  const { supabase } = gate;

  // Aba Transacionais (lembretes automáticos) é exclusiva do geral —
  // a RLS de reminder_runs também só libera para ele.
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  const { data: profile } = user
    ? await userClient.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const isGeral = profile?.role === "coordenador_geral";

  const [campanhas, mkSent, mkOpened, mkClicks, runs] = await Promise.all([
    supabase
      .from("marketing_campaigns")
      .select("id, titulo, status, ab_test, winner_subject, total, sent_count, failed_count, skipped_count, created_at, sent_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("marketing_recipients").select("id", { count: "exact", head: true }).eq("status", "sent"),
    supabase.from("marketing_recipients").select("id", { count: "exact", head: true }).not("opened_at", "is", null),
    supabase.from("marketing_link_clicks").select("id", { count: "exact", head: true }),
    isGeral
      ? supabase
          .from("reminder_runs")
          .select("id, started_at, finished_at, status, sent_count, failed_count, skipped_count, error_message")
          .order("started_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const campRows = (campanhas.data ?? []) as Record<string, unknown>[];
  const mkTaxa =
    (mkSent.count ?? 0) > 0
      ? (((mkOpened.count ?? 0) / (mkSent.count ?? 1)) * 100).toFixed(1)
      : "0,0";

  const runRows: ReminderRunRow[] = ((runs.data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as number,
    startedAt: r.started_at as string,
    finishedAt: (r.finished_at as string | null) ?? null,
    status: r.status as ReminderRunRow["status"],
    sentCount: (r.sent_count as number) ?? 0,
    failedCount: (r.failed_count as number) ?? 0,
    skippedCount: (r.skipped_count as number) ?? 0,
    errorMessage: (r.error_message as string | null) ?? null,
  }));
  const txEnviados = runRows.reduce((a, r) => a + r.sentCount, 0);
  const txFalhas = runRows.reduce((a, r) => a + r.failedCount, 0);

  return (
    <PageContainer>
      <div className="flex w-full flex-col gap-10">
        <Link href="/marketing" className="inline-flex w-fit items-center gap-1.5 text-base font-medium text-zinc-400 hover:text-zinc-600">
          <ArrowLeft size={16} aria-hidden="true" /> Voltar ao Marketing
        </Link>
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900">Histórico de disparos</h1>
          <p className="mt-1 text-lg text-zinc-500">Marketing (campanhas) separado dos transacionais (lembretes automáticos).</p>
        </div>

        <section className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
            <Mail size={24} aria-hidden="true" /> Marketing — via contato@ectolab.org
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-base text-slate-500">E-mails enviados</p>
              <p className="mt-1 text-4xl font-semibold text-zinc-900">{(mkSent.count ?? 0).toLocaleString("pt-BR")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-base text-slate-500">Aberturas registradas</p>
              <p className="mt-1 text-4xl font-semibold text-zinc-900">{(mkOpened.count ?? 0).toLocaleString("pt-BR")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-base text-slate-500">Cliques em links</p>
              <p className="mt-1 text-4xl font-semibold text-zinc-900">{(mkClicks.count ?? 0).toLocaleString("pt-BR")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-base text-slate-500">Taxa de abertura geral</p>
              <p className="mt-1 text-4xl font-semibold text-zinc-900">{mkTaxa}%</p>
            </div>
          </div>
          {campRows.length === 0 && (
            <p className="text-lg text-zinc-500">Nenhuma campanha ainda.</p>
          )}
          {campRows.map((c) => (
            <Link key={c.id as number} href={`/marketing/campanhas/${c.id as number}`} className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-[#2195B9]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-medium text-zinc-900">
                    {c.titulo as string}
                    {(c.ab_test as boolean) && (
                      <span className="ml-2 rounded-full bg-violet-100 px-2.5 py-0.5 text-sm font-medium text-violet-700">A/B</span>
                    )}
                  </p>
                  <p className="text-base text-zinc-500">
                    {c.sent_count as number}/{c.total as number} enviados
                    {(c.failed_count as number) > 0 && ` · ${c.failed_count} falharam`}
                    {(c.winner_subject as string | null) ? ` · Vencedora: ${c.winner_subject}` : ""}
                    {" · "}
                    {c.sent_at
                      ? format(new Date(c.sent_at as string), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : `criada em ${format(new Date(c.created_at as string), "dd/MM/yyyy", { locale: ptBR })}`}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                  {STATUS_LABEL[c.status as string] ?? c.status}
                </span>
              </div>
            </Link>
          ))}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
            <BellRing size={24} aria-hidden="true" /> Transacionais — lembretes automáticos de demandas
          </h2>
          {!isGeral ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-5 text-lg text-zinc-500">
              Visível só para o coordenador geral. O detalhe por execução está no Painel do coordenador.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-base text-slate-500">Lembretes enviados (últimas 30 execuções)</p>
                  <p className="mt-1 text-4xl font-semibold text-zinc-900">{txEnviados.toLocaleString("pt-BR")}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-base text-slate-500">Falhas (últimas 30 execuções)</p>
                  <p className="mt-1 text-4xl font-semibold text-zinc-900">{txFalhas.toLocaleString("pt-BR")}</p>
                </div>
              </div>
              <ReminderRunsPanel runs={runRows} />
            </>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
