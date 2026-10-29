import Link from "next/link";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { obterAcesso } from "@/lib/acesso-server";
import { podeAcessar } from "@/lib/acesso";
import PageContainer from "../../page-container";
import FinanceNavigation from "../finance-nav";
import PeriodClosePanel from "./period-close-panel";

export const metadata = { title: "Fechamento mensal — Financeiro EctoDash" };
type Params = { mes?: string | string[] };
const checklistItems = [
  { key: "extratos", label: "Extratos de todas as contas", help: "Sisprime, outras contas e aplicações do mês." },
  { key: "recebimentos", label: "Relatórios das plataformas", help: "Cielo, PagBank, Stripe e outras fontes de receita usadas no período." },
  { key: "conciliacao", label: "Conciliação e divergências", help: "Recebimentos conferidos ou diferenças identificadas e tratadas." },
  { key: "cartao", label: "Faturas e despesas de cartão", help: "Fatura e documentos de suporte, sem contar a fatura como despesa duplicada." },
  { key: "notas", label: "Notas fiscais recebidas e emitidas", help: "Documentos fiscais necessários para a contabilidade." },
  { key: "pagamentos", label: "Contas pagas e comprovantes", help: "Despesas, comprovantes e pagamentos recorrentes." },
] as const;
const defaultChecklist = { extratos: false, recebimentos: false, conciliacao: false, cartao: false, notas: false, pagamentos: false };

export default async function FechamentoPage({ searchParams }: { searchParams: Promise<Params> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const acesso = await obterAcesso();
  if (!acesso || podeAcessar(acesso, "financeiro") === false) return <PageContainer><h1 className="text-2xl font-semibold">Acesso restrito ao financeiro</h1></PageContainer>;
  const params = await searchParams;
  const raw = Array.isArray(params.mes) ? params.mes[0] : params.mes;
  const competencia = raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : new Date().toISOString().slice(0, 7);
  const [{ data: period }, { data: imports }] = await Promise.all([
    supabase.from("finance_periods").select("id,status,checklist,closed_at").eq("competencia", `${competencia}-01`).maybeSingle(),
    supabase.from("finance_imports").select("id,status,metadata").eq("metadata->>competencia", competencia),
  ]);
  const importIds = (imports ?? []).map((item) => item.id);
  const { count: openExceptions } = importIds.length ? await supabase.from("finance_exceptions").select("id", { count: "exact", head: true }).eq("status", "OPEN").in("import_id", importIds) : { count: 0 };
  const checklist = period?.checklist && typeof period.checklist === "object" ? { ...defaultChecklist, ...(period.checklist as Partial<typeof defaultChecklist>) } : defaultChecklist;
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${competencia}-01T00:00:00Z`));
  return <PageContainer>
    <header className="flex w-full flex-col gap-2"><Link href="/financeiro" className="text-sm font-medium text-cyan-800 hover:underline">← Início do financeiro</Link><p className="mt-2 text-sm font-semibold uppercase tracking-wide text-cyan-700">Etapa 5 do fluxo</p><h1 className="text-3xl font-bold tracking-tight text-zinc-900">Fechamento de {monthLabel}</h1><p className="max-w-3xl text-base text-zinc-600">Confirme a completude dos documentos, resolva as pendências e registre quem aprovou o fechamento. Depois de fechado, o período fica bloqueado para edição.</p></header>
    <FinanceNavigation />
    <section className="grid w-full gap-3 sm:grid-cols-3"><Metric label="Arquivos importados" value={String(imports?.length ?? 0)}/><Metric label="Pendências em aberto" value={String(openExceptions ?? 0)}/><Metric label="Estado do mês" value={period?.status === "FECHADO" ? "Fechado" : "Em andamento"}/></section>
    <form action="/financeiro/fechamento" className="flex w-full flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-end"><label className="text-sm font-medium text-zinc-700">Competência<input type="month" name="mes" defaultValue={competencia} className="mt-1 block min-h-10 rounded-lg border border-zinc-300 px-3"/></label><button className="min-h-10 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white">Abrir mês</button></form>
    <PeriodClosePanel competencia={competencia} checklist={checklist} fechado={period?.status === "FECHADO"} closedAt={period?.closed_at ?? null} imports={imports?.length ?? 0} openExceptions={openExceptions ?? 0} checklistItems={checklistItems}/>
    <section className="flex w-full flex-wrap gap-4 text-sm"><Link href={`/financeiro/importar`} className="inline-flex items-center gap-1 font-semibold text-cyan-800 hover:underline">Enviar arquivos <ArrowRight size={15}/></Link><Link href="/financeiro/conferencia" className="inline-flex items-center gap-1 font-semibold text-cyan-800 hover:underline">Conferir pendências <ArrowRight size={15}/></Link><Link href="/financeiro/analise" className="inline-flex items-center gap-1 font-semibold text-cyan-800 hover:underline">Ver análise <ArrowRight size={15}/></Link></section>
  </PageContainer>;
}
function Metric({ label, value }: { label: string; value: string }) { return <article className="rounded-xl border border-zinc-200 bg-white p-4"><p className="text-sm text-zinc-500">{label}</p><p className="mt-1 text-xl font-bold text-zinc-900">{value}</p></article>; }
