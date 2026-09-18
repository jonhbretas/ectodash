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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaignId = Number(id);
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
