import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageContainer from "../../../page-container";
import { requireMarketingGate } from "../../page";
import DispatchClient from "./dispatch-client";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  queued: "Na fila",
  testing: "Testando A/B",
  sending: "Disparando",
  sent: "Enviada",
  failed: "Falhou",
};

export default async function CampanhaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ q?: string; f?: string; p?: string }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const campaignId = Number(id);
  const reportQ = (sp.q ?? "").trim().slice(0, 120);
  const reportF = sp.f ?? "todos";
  const reportPage = Math.max(1, Number(sp.p ?? "1") || 1);
  const gate = await requireMarketingGate();
  if (gate.blocked || !Number.isInteger(campaignId)) {
    return (
      <PageContainer>
        <p className="py-16 text-center text-lg text-zinc-500">Campanha não encontrada ou sem acesso.</p>
      </PageContainer>
    );
  }
  const { supabase } = gate;

  const { data: campaign } = await supabase
    .from("marketing_campaigns")
    .select("id, titulo, assunto, html, status, total, sent_count, failed_count, skipped_count, created_at, ab_test, subjects, winner_subject")
    .eq("id", campaignId)
    .single();

  if (!campaign) {
    return (
      <PageContainer>
        <p className="py-16 text-center text-lg text-zinc-500">Campanha não encontrada.</p>
      </PageContainer>
    );
  }

  // Métricas (só fazem sentido após envios): agregados leves via
  // count + top links agregado em memória (cliques costumam ser poucos
  // milhares — pagina 5000 por vez).
  const [{ count: delivered }, { count: openedUnique }, { data: openCounts }, { count: clicksTotal }, { data: clickRows }] =
    await Promise.all([
      supabase.from("marketing_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).not("delivered_at", "is", null),
      supabase.from("marketing_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).not("opened_at", "is", null),
      supabase.from("marketing_recipients").select("open_count").eq("campaign_id", campaignId).gt("open_count", 0).limit(15000),
      supabase.from("marketing_link_clicks").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId),
      supabase.from("marketing_link_clicks").select("url, recipient_id").eq("campaign_id", campaignId).limit(5000),
    ]);
  const openedTotal = ((openCounts ?? []) as { open_count: number }[]).reduce(
    (a, r) => a + (r.open_count ?? 0),
    0
  );
  const clickRowsTyped = ((clickRows ?? []) as { recipient_id: number | null }[]);
  const clickUniques = new Set(
    clickRowsTyped.map((c, i) => c.recipient_id ?? `anon-${i}`)
  ).size;
  const byUrl = new Map<string, { total: number; uniques: Set<number | string> }>();
  for (const c of ((clickRows ?? []) as { url: string; recipient_id: number | null }[])) {
    const entry = byUrl.get(c.url) ?? { total: 0, uniques: new Set<number | string>() };
    entry.total++;
    entry.uniques.add(c.recipient_id ?? "?");
    byUrl.set(c.url, entry);
  }
  const topLinks = [...byUrl.entries()]
    .map(([url, v]) => ({ url, total: v.total, uniques: v.uniques.size }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
  const sent = (campaign.sent_count as number) ?? 0;
  const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—");

  // ── Relatório por disparo (filtros + busca por e-mail) ─────────────
  // Segmentos: todos · entregues (receberam) · não receberam
  // (delivered_at null: pending/sent sem confirmação, failed, skipped) ·
  // não abriram (entregue sem abertura) · abriram · clicaram · falharam.
  const REPORT_PAGE_SIZE = 50;
  const VALID_F = new Set(["todos", "entregues", "nao_receberam", "nao_abriram", "abriram", "clicaram", "falharam"]);
  const rf = VALID_F.has(reportF) ? reportF : "todos";
  const showReport = ((campaign.total as number) ?? 0) > 0;

  type RecRow = {
    id: number; email: string; status: string; delivered_at: string | null;
    opened_at: string | null; open_count: number | null; error_message: string | null;
    lead_id: number | null; resend_id: string | null; variant: string | null;
  };

  let repCounts: Record<string, number> = { todos: 0, entregues: 0, nao_receberam: 0, nao_abriram: 0, abriram: 0, clicaram: 0, falharam: 0 };
  let repRows: RecRow[] = [];
  let repTotal = 0;
  let repClicksByRec: Map<number, number> = new Map();
  let repLeadStatus: Map<number, string> = new Map();
  if (showReport) {
    const base = (q: string) => {
      let b = supabase.from("marketing_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId);
      if (reportQ) b = b.ilike("email", `%${reportQ.replace(/[%_\\]/g, "")}%`);
      return b;
    };
    // IDs que clicaram (p/ contagem da aba + filtro "clicaram").
    const { data: clickIds } = await supabase
      .from("marketing_link_clicks")
      .select("recipient_id")
      .eq("campaign_id", campaignId)
      .limit(15000);
    const clickedIds = [...new Set(((clickIds ?? []) as { recipient_id: number | null }[]).map((c) => c.recipient_id).filter((v): v is number => v !== null))];
    const [cTodos, cEntreg, cNaoRec, cNaoAb, cAb, cFal] = await Promise.all([
      base("todos"),
      (() => { let b = supabase.from("marketing_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).not("delivered_at", "is", null); if (reportQ) b = b.ilike("email", `%${reportQ.replace(/[%_\\]/g, "")}%`); return b; })(),
      (() => { let b = supabase.from("marketing_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).is("delivered_at", null); if (reportQ) b = b.ilike("email", `%${reportQ.replace(/[%_\\]/g, "")}%`); return b; })(),
      (() => { let b = supabase.from("marketing_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).not("delivered_at", "is", null).is("opened_at", null); if (reportQ) b = b.ilike("email", `%${reportQ.replace(/[%_\\]/g, "")}%`); return b; })(),
      (() => { let b = supabase.from("marketing_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).not("opened_at", "is", null); if (reportQ) b = b.ilike("email", `%${reportQ.replace(/[%_\\]/g, "")}%`); return b; })(),
      (() => { let b = supabase.from("marketing_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).in("status", ["failed", "skipped"]); if (reportQ) b = b.ilike("email", `%${reportQ.replace(/[%_\\]/g, "")}%`); return b; })(),
    ]);
    repCounts = {
      todos: cTodos.count ?? 0,
      entregues: cEntreg.count ?? 0,
      nao_receberam: cNaoRec.count ?? 0,
      nao_abriram: cNaoAb.count ?? 0,
      abriram: cAb.count ?? 0,
      clicaram: reportQ ? 0 : clickedIds.length, // com busca, a contagem exata sai do filtro abaixo
      falharam: cFal.count ?? 0,
    };

    const from = (reportPage - 1) * REPORT_PAGE_SIZE;
    const to = from + REPORT_PAGE_SIZE - 1;
    let q = supabase
      .from("marketing_recipients")
      .select("id, email, status, delivered_at, opened_at, open_count, error_message, lead_id, resend_id, variant", { count: "exact" })
      .eq("campaign_id", campaignId)
      .order("id", { ascending: true })
      .range(from, to);
    if (reportQ) q = q.ilike("email", `%${reportQ.replace(/[%_\\]/g, "")}%`);
    if (rf === "entregues") q = q.not("delivered_at", "is", null);
    else if (rf === "nao_receberam") q = q.is("delivered_at", null);
    else if (rf === "nao_abriram") q = q.not("delivered_at", "is", null).is("opened_at", null);
    else if (rf === "abriram") q = q.not("opened_at", "is", null);
    else if (rf === "falharam") q = q.in("status", ["failed", "skipped"]);
    else if (rf === "clicaram") {
      if (clickedIds.length === 0) {
        repRows = []; repTotal = 0;
      } else {
        // Com busca + filtro cruzado, restringe aos que clicaram.
        q = q.in("id", clickedIds.slice(0, 1000));
      }
    }
    if (!(rf === "clicaram" && clickedIds.length === 0)) {
      const { data, count } = await q;
      repRows = ((data ?? []) as RecRow[]);
      repTotal = count ?? 0;
      if (rf === "clicaram" && reportQ) repCounts.clicaram = repTotal;
    }
    const pageIds = repRows.map((r) => r.id);
    if (pageIds.length > 0) {
      const leadIds = [...new Set(repRows.map((r) => r.lead_id).filter((v): v is number => v !== null))];
      const [{ data: pageClicks }, leadRes] = await Promise.all([
        supabase.from("marketing_link_clicks").select("recipient_id").eq("campaign_id", campaignId).in("recipient_id", pageIds).limit(5000),
        leadIds.length > 0
          ? supabase.from("marketing_leads").select("id, status").in("id", leadIds)
          : Promise.resolve({ data: [] as { id: number; status: string }[], error: null }),
      ]);
      for (const c of ((pageClicks ?? []) as { recipient_id: number | null }[])) {
        if (c.recipient_id == null) continue;
        repClicksByRec.set(c.recipient_id, (repClicksByRec.get(c.recipient_id) ?? 0) + 1);
      }
      for (const l of ((leadRes.data ?? []) as { id: number; status: string }[])) {
        repLeadStatus.set(l.id, l.status);
      }
    }
  }
  const repPages = Math.max(1, Math.ceil(repTotal / REPORT_PAGE_SIZE));
  const repHref = (f: string, p: number, qq?: string) => {
    const s = new URLSearchParams();
    if ((qq ?? reportQ)) s.set("q", qq ?? reportQ);
    if (f !== "todos") s.set("f", f);
    if (p > 1) s.set("p", String(p));
    const qs = s.toString();
    return `/marketing/campanhas/${campaignId}${qs ? `?${qs}` : ""}`;
  };

  return (
    <PageContainer>
      <div className="flex w-full flex-col gap-8">
        <Link href="/marketing" className="inline-flex w-fit items-center gap-1.5 text-base font-medium text-zinc-400 hover:text-zinc-600">
          <ArrowLeft size={16} aria-hidden="true" /> Voltar ao Marketing
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-900">{campaign.titulo as string}</h1>
            <p className="mt-1 text-lg text-zinc-500">Assunto: {campaign.assunto as string}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-1.5 text-base font-medium text-slate-700">
            {STATUS_LABEL[campaign.status as string] ?? campaign.status}
          </span>
        </div>

        {(campaign.status === "sent" || campaign.status === "sending" || campaign.status === "testing") && (
          <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-semibold text-zinc-900">Métricas</h2>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <MetricCard label="Enviados" value={sent.toLocaleString("pt-BR")} />
              <MetricCard label="Entregues" value={(delivered ?? 0).toLocaleString("pt-BR")} sub={pct(delivered ?? 0, sent)} />
              <MetricCard label="Aberturas únicas" value={(openedUnique ?? 0).toLocaleString("pt-BR")} sub={pct(openedUnique ?? 0, delivered ?? sent)} />
              <MetricCard label="Aberturas totais" value={openedTotal.toLocaleString("pt-BR")} />
              <MetricCard label="Cliques únicos" value={clickUniques.toLocaleString("pt-BR")} sub={pct(clickUniques, openedUnique ?? 0)} />
              <MetricCard label="Cliques totais" value={(clicksTotal ?? 0).toLocaleString("pt-BR")} />
            </div>
            {topLinks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-base">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="py-1 pr-3">Link mais clicado</th>
                      <th className="py-1 pr-3">Cliques</th>
                      <th className="py-1">Únicos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topLinks.map((l) => (
                      <tr key={l.url} className="border-t border-slate-100">
                        <td className="max-w-md truncate py-1.5 pr-3 font-mono text-sm text-zinc-700" title={l.url}>{l.url}</td>
                        <td className="py-1.5 pr-3">{l.total}</td>
                        <td className="py-1.5">{l.uniques}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-base text-zinc-500">
                Cliques aparecem aqui quando o tracking de cliques + webhook estiverem ligados no Resend.
              </p>
            )}
          </section>
        )}

        {showReport && (
          <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900">Relatório por e-mail</h2>
              <p className="mt-0.5 text-base text-zinc-500">
                Quem recebeu, quem não recebeu (e por quê), quem não abriu, quem abriu e quem clicou.
                Use a busca para achar um endereço — ex.: o seu, se não recebeu a divulgação.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ["todos", "Todos"],
                ["entregues", "Receberam"],
                ["nao_receberam", "Não receberam"],
                ["nao_abriram", "Não abriram"],
                ["abriram", "Abriram"],
                ["clicaram", "Clicaram"],
                ["falharam", "Falharam"],
              ] as const).map(([f, label]) => (
                <Link
                  key={f}
                  href={repHref(f, 1)}
                  className={`rounded-full px-3.5 py-1.5 text-base font-medium ${rf === f ? "bg-[#2195B9] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                >
                  {label} · {(repCounts[f] ?? 0).toLocaleString("pt-BR")}
                </Link>
              ))}
            </div>
            <form method="get" className="flex flex-col gap-2 sm:flex-row">
              <input
                name="q"
                defaultValue={reportQ}
                placeholder="Buscar por e-mail…"
                autoComplete="off"
                className="h-11 flex-1 rounded-xl border border-slate-300 px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-[#2195B9] focus:outline-none"
              />
              {rf !== "todos" && <input type="hidden" name="f" value={rf} />}
              <button type="submit" className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-5 text-base font-medium text-white hover:bg-zinc-700">
                Buscar
              </button>
              {(reportQ || rf !== "todos") && (
                <Link href={`/marketing/campanhas/${campaignId}`} className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-base font-medium text-slate-600 hover:bg-slate-50">
                  Limpar
                </Link>
              )}
            </form>
            {reportQ && (
              <p className="text-base text-zinc-600">
                {repTotal === 0
                  ? <>Nenhum destinatário <span className="font-medium">“{reportQ}”</span> neste disparo — o e-mail pode não estar na base, ter sido importado depois do snapshot, ou estar com grafia diferente.</>
                  : <><span className="font-medium">{repTotal.toLocaleString("pt-BR")}</span> resultado{repTotal === 1 ? "" : "s"} para <span className="font-medium">“{reportQ}”</span> neste disparo.</>}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-base">
                <thead>
                  <tr className="text-slate-500">
                    <th className="py-1 pr-3">E-mail</th>
                    <th className="py-1 pr-3">Envio</th>
                    <th className="py-1 pr-3">Entregue</th>
                    <th className="py-1 pr-3">Abriu</th>
                    <th className="py-1 pr-3">Cliques</th>
                    <th className="py-1">Motivo / detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {repRows.map((r) => {
                    const clicks = repClicksByRec.get(r.id) ?? 0;
                    const leadStatus = r.lead_id != null ? repLeadStatus.get(r.lead_id) : undefined;
                    const detail =
                      r.error_message ??
                      (r.status === "skipped" ? "Pulado no enfileiramento (descadastrado/inválido na hora do snapshot)." :
                      r.status === "failed" ? "Falha no envio (Resend)." :
                      r.status === "pending" ? "Ainda na fila / não enviado." :
                      r.status === "sent" && !r.delivered_at ? "Enviado, sem confirmação de entrega (webhook pendente ou caixa cheia/filtro)." :
                      r.delivered_at && !r.opened_at ? "Entregue, ainda sem abertura registrada." :
                      leadStatus === "unsubscribed" ? "Lead descadastrado após o disparo." :
                      leadStatus === "invalid" ? "Lead marcado inválido (bounce)." : "—");
                    return (
                      <tr key={r.id} className="border-t border-slate-100 align-top">
                        <td className="max-w-xs break-all py-2 pr-3 font-medium text-zinc-900">
                          {r.email}
                          {r.variant && <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">Variante {r.variant}</span>}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-zinc-700">
                          {r.status === "sent" ? "Enviado" : r.status === "failed" ? "Falhou" : r.status === "skipped" ? "Pulado" : "Pendente"}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-zinc-700">{r.delivered_at ? "Sim" : "Não"}</td>
                        <td className="whitespace-nowrap py-2 pr-3 text-zinc-700">
                          {r.opened_at ? `Sim${(r.open_count ?? 0) > 1 ? ` (${r.open_count}x)` : ""}` : "Não"}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-zinc-700">{clicks > 0 ? `${clicks}x` : "—"}</td>
                        <td className="max-w-md py-2 text-sm text-zinc-500">{detail}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {repRows.length === 0 && (
                <p className="py-4 text-base text-zinc-500">Nada aqui com este filtro{reportQ ? " e busca" : ""}.</p>
              )}
            </div>
            {repPages > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                {reportPage > 1 && (
                  <Link href={repHref(rf, reportPage - 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-50">
                    ← Anterior
                  </Link>
                )}
                <span className="text-base text-zinc-500">Página {reportPage} de {repPages} · {repTotal.toLocaleString("pt-BR")} e-mails</span>
                {reportPage < repPages && (
                  <Link href={repHref(rf, reportPage + 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-50">
                    Próxima →
                  </Link>
                )}
              </div>
            )}
          </section>
        )}

        <DispatchClient
          campaignId={campaignId}
          status={campaign.status as string}
          total={(campaign.total as number) ?? 0}
          sentCount={(campaign.sent_count as number) ?? 0}
          failedCount={(campaign.failed_count as number) ?? 0}
          skippedCount={(campaign.skipped_count as number) ?? 0}
          abTest={(campaign.ab_test as boolean) ?? false}
          subjects={((campaign.subjects as string[] | null) ?? []) as string[]}
          winnerSubject={(campaign.winner_subject as string | null) ?? null}
        />

        <section className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-zinc-900">Conteúdo (com rodapé de descadastro automático no envio)</h2>
          <iframe
            title="Conteúdo da campanha"
            sandbox=""
            srcDoc={(campaign.html as string) || ""}
            className="min-h-[480px] w-full rounded-xl border border-slate-200 bg-white"
          />
        </section>
      </div>
    </PageContainer>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold text-zinc-900">{value}</p>
      {sub && <p className="text-sm text-slate-500">{sub}</p>}
    </div>
  );
}
