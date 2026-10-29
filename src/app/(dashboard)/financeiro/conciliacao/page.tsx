import Link from "next/link";
import { ArrowRightLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { obterAcesso } from "@/lib/acesso-server";
import { podeAcessar } from "@/lib/acesso";
import PageContainer from "../../page-container";
import FinanceNavigation from "../finance-nav";
import ReconciliationSuggestions, { type SuggestedMatch } from "./suggestions";

export const metadata = { title: "Conciliação — Financeiro EctoDash" };
type Entry = { id: string; movement_date: string; expected_date: string | null; original_description: string; net_amount: number; provider_id: string | null; reconciliation_status: string };
type Provider = { id: string; name: string };
const cents = (value: number) => Math.round(Number(value) * 100);
const day = (value: string) => Date.parse(`${value}T00:00:00Z`);

export default async function ConciliacaoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const acesso = await obterAcesso();
  if (!acesso || podeAcessar(acesso, "financeiro") === false) return <PageContainer><h1 className="text-2xl font-semibold">Acesso restrito ao financeiro</h1></PageContainer>;

  const [{ data: billedData }, { data: receivedData }, { data: linkedData }] = await Promise.all([
    supabase.from("finance_ledger").select("id,movement_date,expected_date,original_description,net_amount,provider_id,reconciliation_status").eq("type", "RECEITA_FATURADA").in("reconciliation_status", ["PENDENTE", "DIVERGENTE"]).order("movement_date", { ascending: false }).limit(1000),
    supabase.from("finance_ledger").select("id,movement_date,expected_date,original_description,net_amount,provider_id,reconciliation_status").eq("type", "RECEITA_RECEBIDA").in("reconciliation_status", ["PENDENTE", "DIVERGENTE"]).order("movement_date", { ascending: false }).limit(1000),
    supabase.from("finance_reconciliation_items").select("ledger_id"),
  ]);
  const billed = (billedData ?? []) as Entry[];
  const received = (receivedData ?? []) as Entry[];
  const linked = new Set((linkedData ?? []).map((item: { ledger_id: string }) => item.ledger_id));
  const unlinkedBilled = billed.filter((row) => !linked.has(row.id));
  const unlinkedReceived = received.filter((row) => !linked.has(row.id));
  const billedProviderIds = [...new Set(unlinkedBilled.map((row) => row.provider_id).filter((id): id is string => Boolean(id)))];
  const { data: providers } = billedProviderIds.length ? await supabase.from("finance_entities").select("id,name").in("id", billedProviderIds) : { data: [] };
  const providerNames = new Map(((providers ?? []) as Provider[]).map((provider) => [provider.id, provider.name]));
  const suggestionPool: Array<{ billed: Entry; received: Entry; dayDistance: number }> = [];
  for (const sale of unlinkedBilled) for (const deposit of unlinkedReceived) {
    const targetDate = sale.expected_date ?? sale.movement_date;
    const distance = Math.abs(day(targetDate) - day(deposit.movement_date)) / 86400000;
    if (cents(sale.net_amount) === cents(deposit.net_amount) && distance <= 7) suggestionPool.push({ billed: sale, received: deposit, dayDistance: distance });
  }
  const billedCounts = new Map<string, number>(); const receivedCounts = new Map<string, number>();
  for (const pair of suggestionPool) { billedCounts.set(pair.billed.id, (billedCounts.get(pair.billed.id) ?? 0) + 1); receivedCounts.set(pair.received.id, (receivedCounts.get(pair.received.id) ?? 0) + 1); }
  const suggestions: SuggestedMatch[] = suggestionPool.filter(({ billed: sale, received: deposit }) => billedCounts.get(sale.id) === 1 && receivedCounts.get(deposit.id) === 1).map(({ billed: sale, received: deposit, dayDistance }) => ({ billedId: sale.id, receivedId: deposit.id, provider: sale.provider_id ? providerNames.get(sale.provider_id) ?? "Plataforma" : "Plataforma", amount: Number(sale.net_amount), billedDate: sale.movement_date, receivedDate: deposit.movement_date, billedDescription: sale.original_description, receivedDescription: deposit.original_description, dayDistance }));

  return <PageContainer>
    <header className="flex w-full flex-col gap-2"><Link href="/financeiro" className="text-sm font-medium text-cyan-800 hover:underline">← Início do financeiro</Link><p className="mt-2 text-sm font-semibold uppercase tracking-wide text-cyan-700">Etapa 3 do fechamento</p><h1 className="text-3xl font-bold tracking-tight text-zinc-900">Conciliação de recebimentos</h1><p className="max-w-3xl text-base text-zinc-600">Compare vendas de Cielo e Stripe com os créditos nos extratos. O sistema só sugere pares com valor líquido igual e datas próximas; confirme cada par depois de conferir os documentos.</p></header>
    <FinanceNavigation />
    <section className="grid w-full gap-3 sm:grid-cols-3"><Metric label="Vendas aguardando depósito" value={String(unlinkedBilled.length)}/><Metric label="Créditos ainda sem venda ligada" value={String(unlinkedReceived.length)}/><Metric label="Correspondências exatas sugeridas" value={String(suggestions.length)}/></section>
    <ReconciliationSuggestions suggestions={suggestions}/>
    <section className="flex w-full items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950"><ArrowRightLeft size={19} className="mt-0.5 shrink-0"/><p>A correspondência automática é conservadora: diferença de valor, datas distantes ou mais de um candidato ficam sem conciliação automática e exigem análise humana. Lançamentos vinculados mantêm o arquivo e a linha de origem.</p></section>
  </PageContainer>;
}
function Metric({ label, value }: { label: string; value: string }) { return <article className="rounded-xl border border-zinc-200 bg-white p-4"><p className="text-sm text-zinc-500">{label}</p><p className="mt-1 text-2xl font-bold text-zinc-900">{value}</p></article>; }
