import Link from "next/link";
import { requireFinanceiro } from "@/lib/role-gates";
import { getEffectiveAIConfig } from "@/lib/ai/ai-client";
import { financeToday } from "@/lib/financeiro/data";
import { loadFinanceContext, type MonthlyAIReport } from "@/lib/financeiro/ai-report";
import PageContainer from "../../page-container";
import FinanceNavigation from "../finance-nav";
import FinanceAIPanel from "./panel";

export const metadata = { title: "Financeiro com IA — EctoDash" };
export default async function FinanceAIPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  let ctx;
  try { ctx = await requireFinanceiro(); } catch { return <PageContainer><h1 className="text-2xl font-semibold">Acesso restrito ao financeiro</h1></PageContainer>; }
  const params = await searchParams;
  const month = typeof params.mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes) ? params.mes : financeToday().slice(0, 7);
  const [config, saved, period, context] = await Promise.all([
    getEffectiveAIConfig(ctx.supabase),
    ctx.supabase.from("finance_ai_reports").select("id,report").eq("competencia", `${month}-01`).maybeSingle(),
    ctx.supabase.from("finance_periods").select("status").eq("competencia", `${month}-01`).maybeSingle(),
    loadFinanceContext(ctx.supabase, month).then((value) => ({ value, error: false })).catch(() => ({ value: null, error: true })),
  ]);
  const error = saved.error || period.error || context.error;
  return <PageContainer>
    <header className="flex w-full flex-col gap-2"><Link href="/financeiro" className="text-sm font-medium text-cyan-800 hover:underline">← Início do financeiro</Link><p className="mt-2 text-sm font-semibold uppercase tracking-wide text-cyan-700">Documentos, conciliação e fechamento</p><h1 className="text-3xl font-bold tracking-tight text-zinc-900">Financeiro com IA</h1><p className="max-w-3xl text-zinc-600">Envie os arquivos do mês. A IA lê os documentos, confere notas e prepara o fechamento, com análise dos dados disponíveis no ano vigente.</p></header>
    <FinanceNavigation />
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900">Não foi possível carregar todos os dados. Recarregue esta página antes de processar o mês.</p> : <FinanceAIPanel key={month} month={month} currentYear={Number(financeToday().slice(0, 4))} configured={Boolean(config.apiKey)} initialReport={saved.data ? { id: saved.data.id, report: saved.data.report as MonthlyAIReport } : null} closed={period.data?.status === "FECHADO"} exceptions={context.value?.exceptions ?? []} imports={context.value?.imports ?? []} />}
  </PageContainer>;
}
