import Link from "next/link";
import { ArrowRight, BarChart3, FileText, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { obterAcesso } from "@/lib/acesso-server";
import { podeAcessar } from "@/lib/acesso";
import PageContainer from "../../page-container";
import FinanceNavigation from "../finance-nav";

export const metadata = { title: "Análise financeira — EctoDash" };
type Search = { mes?: string | string[] };
type LedgerRow = { id: string; movement_date: string; original_description: string; type: string; inflow: number; outflow: number; net_amount: number; reconciliation_status: string; confidence: number };
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function AnaliseFinanceiroPage({ searchParams }: { searchParams: Promise<Search> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const acesso = await obterAcesso();
  if (!acesso || podeAcessar(acesso, "financeiro") === false) return <PageContainer><h1 className="text-2xl font-semibold">Acesso restrito ao financeiro</h1></PageContainer>;

  const params = await searchParams;
  const rawMonth = Array.isArray(params.mes) ? params.mes[0] : params.mes;
  const selectedMonth = rawMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : "";
  const { data } = await supabase.from("finance_ledger").select("id,movement_date,original_description,type,inflow,outflow,net_amount,reconciliation_status,confidence").order("movement_date", { ascending: false }).limit(2000);
  const allRows = (data ?? []) as LedgerRow[];
  const months = [...new Set(allRows.map((row) => row.movement_date.slice(0, 7)))].sort((a, b) => b.localeCompare(a));
  const rows = allRows.filter((row) => !selectedMonth || row.movement_date.startsWith(selectedMonth));
  const operational = rows.filter((row) => row.type !== "TRANSFERENCIA_INTERNA" && !["SALDO_INICIAL", "SALDO_FINAL"].includes(row.type));
  const income = operational.reduce((sum, row) => sum + Number(row.inflow || 0), 0);
  const expenses = operational.reduce((sum, row) => sum + Number(row.outflow || 0), 0);
  const pending = rows.filter((row) => ["PENDENTE", "DIVERGENTE", "PARCIALMENTE_CONCILIADO"].includes(row.reconciliation_status)).length;
  const formatMonth = (month: string) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));

  return <PageContainer>
    <header className="flex w-full flex-col gap-1"><Link href="/financeiro" className="text-sm font-medium text-cyan-800 hover:underline">← Início do financeiro</Link><p className="mt-2 text-sm font-semibold uppercase tracking-wide text-cyan-700">Consulta de dados</p><h1 className="text-3xl font-bold tracking-tight text-zinc-900">Análise financeira</h1><p className="text-base text-zinc-600">Resumo dos lançamentos importados e conferidos no sistema.</p></header>
    <FinanceNavigation />
    <section className="flex w-full flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-semibold text-zinc-900">Período</h2><p className="text-sm text-zinc-500">Selecione uma competência para filtrar os totais e os lançamentos.</p></div><form action="/financeiro/analise" className="flex items-center gap-2"><select aria-label="Competência" name="mes" defaultValue={selectedMonth} className="min-h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm"><option value="">Todas as competências</option>{months.map((month) => <option key={month} value={month}>{formatMonth(month)}</option>)}</select><button className="min-h-10 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white">Aplicar</button></form></section>
    <section aria-label="Resumo do período" className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Receitas" value={brl.format(income)} tone="green"/><Metric label="Despesas" value={brl.format(expenses)} tone="red"/><Metric label="Resultado" value={brl.format(income - expenses)} tone={income >= expenses ? "green" : "red"}/><Metric label="Aguardando conferência" value={String(pending)} tone="amber"/></section>
    <section className="flex w-full flex-col gap-3"><div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-semibold text-zinc-900">Lançamentos do período</h2><p className="text-sm text-zinc-500">{rows.length} registros{rows.length === 2000 ? " (limite de exibição)" : ""}</p></div><Link href="/financeiro/lancamentos" className="text-sm font-semibold text-cyan-800 hover:underline">Livro financeiro anterior</Link></div>
      {rows.length ? <div className="w-full overflow-x-auto rounded-xl border border-zinc-200 bg-white"><table className="w-full min-w-[42rem] text-left text-sm"><thead className="border-b bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Valor líquido</th></tr></thead><tbody>{rows.slice(0, 100).map((row) => <tr key={row.id} className="border-b last:border-0"><td className="whitespace-nowrap px-4 py-3 text-zinc-500">{new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${row.movement_date}T00:00:00Z`))}</td><td className="max-w-sm truncate px-4 py-3 font-medium text-zinc-900" title={row.original_description}>{row.original_description}</td><td className="px-4 py-3 text-zinc-600">{row.type.replaceAll("_", " ").toLocaleLowerCase("pt-BR")}</td><td className="px-4 py-3"><span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-900">{row.reconciliation_status.replaceAll("_", " ").toLocaleLowerCase("pt-BR")}</span></td><td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-zinc-900">{brl.format(Number(row.net_amount))}</td></tr>)}</tbody></table>{rows.length > 100 && <p className="border-t px-4 py-3 text-xs text-zinc-500">Mostrando os 100 lançamentos mais recentes deste período.</p>}</div> : <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-5 py-12 text-center"><BarChart3 size={30} className="mx-auto text-zinc-400"/><h3 className="mt-3 font-semibold text-zinc-900">Ainda não há dados importados</h3><p className="mt-1 text-sm text-zinc-600">Envie os documentos da competência para gerar esta análise.</p><Link href="/financeiro/importar" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-800 px-4 py-2.5 text-sm font-semibold text-white">Subir arquivos <ArrowRight size={16}/></Link></div>}
    </section>
    <section aria-label="Outras áreas financeiras" className="grid w-full gap-3 sm:grid-cols-2"><SecondaryLink href="/financeiro/lancamentos" title="Lançamentos" description="Consultar registros do fluxo de caixa" Icon={FileText}/><SecondaryLink href="/financeiro/pagar" title="A pagar" description="Despesas e prazos" Icon={WalletCards}/></section>
  </PageContainer>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "green" | "red" | "amber" }) { const colors = { green: "text-emerald-800 bg-emerald-50", red: "text-red-800 bg-red-50", amber: "text-amber-900 bg-amber-50" }; return <article className="rounded-xl border border-zinc-200 bg-white p-4"><p className="text-sm text-zinc-500">{label}</p><p className={`mt-1 text-xl font-bold ${colors[tone].split(" ")[0]}`}>{value}</p></article>; }
function SecondaryLink({ href, title, description, Icon }: { href: string; title: string; description: string; Icon: typeof FileText }) { return <Link href={href} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-cyan-300 hover:bg-cyan-50"><span className="flex size-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700"><Icon size={19}/></span><span className="flex-1"><span className="block font-semibold text-zinc-900">{title}</span><span className="text-sm text-zinc-500">{description}</span></span><ArrowRight size={17} className="text-zinc-400"/></Link>; }
