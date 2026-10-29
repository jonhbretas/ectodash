import Link from "next/link";
import { ArrowRight, BarChart3, LockKeyhole, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { obterAcesso } from "@/lib/acesso-server";
import { podeAcessar } from "@/lib/acesso";
import PageContainer from "../page-container";

export const metadata = { title: "Financeiro — EctoDash" };

export default async function FinanceiroHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const acesso = await obterAcesso();
  if (!acesso || podeAcessar(acesso, "financeiro") === false) {
    return <PageContainer><div className="flex w-full flex-col items-center gap-4 py-16 text-center"><LockKeyhole size={42} className="text-zinc-400"/><h1 className="text-2xl font-semibold text-zinc-900">Acesso restrito ao financeiro</h1><p className="max-w-md text-zinc-600">Este espaço é exclusivo para pessoas com acesso ao módulo financeiro.</p></div></PageContainer>;
  }

  const [{ count: pendentes }, { count: importacoes }] = await Promise.all([
    supabase.from("finance_exceptions").select("id", { count: "exact", head: true }).eq("status", "OPEN"),
    supabase.from("finance_imports").select("id", { count: "exact", head: true }),
  ]);

  return <PageContainer>
    <header className="flex w-full flex-col gap-2"><p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">Área financeira</p><h1 className="text-3xl font-bold tracking-tight text-zinc-900">O que você precisa fazer?</h1><p className="max-w-2xl text-base text-zinc-600">Envie os documentos do mês para organizar e conferir, ou consulte os dados que já estão no sistema.</p></header>
    <section aria-label="Ações principais do financeiro" className="grid w-full gap-4 md:grid-cols-2">
      <ActionCard href="/financeiro/importar" title="Subir arquivos" description="Enviar extratos, notas, faturas e comprovantes. O sistema guarda os originais e prepara os dados para conferência." Icon={Upload} action="Começar envio" tone="cyan" />
      <ActionCard href="/financeiro/analise" title="Analisar dados" description="Consultar o fluxo financeiro, comparar períodos e abrir os lançamentos já registrados." Icon={BarChart3} action="Abrir análise" tone="navy" />
    </section>
    <section className="grid w-full gap-3 sm:grid-cols-2">
      <Link href="/financeiro/conferencia" className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 transition hover:border-amber-300 hover:bg-amber-100"><span><span className="block font-semibold text-zinc-900">Conferência humana</span><span className="text-sm text-zinc-600">Corrigir leituras incertas antes de fechar o mês</span></span><span className="flex size-9 items-center justify-center rounded-full bg-white font-semibold text-amber-800">{pendentes ?? 0}</span></Link>
      <Link href="/financeiro/lancamentos" className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-cyan-200 hover:bg-cyan-50"><span><span className="block font-semibold text-zinc-900">Lançamentos</span><span className="text-sm text-zinc-600">Ver os registros detalhados do financeiro</span></span><span className="flex items-center gap-2 text-sm font-medium text-cyan-800">{importacoes ?? 0} arquivos <ArrowRight size={16}/></span></Link>
    </section>
    <p className="text-sm text-zinc-500">Fluxo recomendado: enviar arquivos → validar os dados → revisar pendências → consultar a análise.</p>
  </PageContainer>;
}

function ActionCard({ href, title, description, action, Icon, tone }: { href: string; title: string; description: string; action: string; Icon: typeof Upload; tone: "cyan" | "navy" }) {
  const colors = tone === "cyan" ? "bg-cyan-700 group-hover:bg-cyan-800" : "bg-[#28627B] group-hover:bg-[#1f4f63]";
  return <Link href={href} className="group flex min-h-52 flex-col justify-between gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 sm:p-7">
    <span className="flex items-start justify-between gap-4"><span><span className="block text-xl font-semibold text-zinc-900">{title}</span><span className="mt-2 block max-w-md text-sm leading-relaxed text-zinc-600">{description}</span></span><span className={`flex size-12 shrink-0 items-center justify-center rounded-xl text-white transition ${colors}`}><Icon size={22}/></span></span>
    <span className="flex items-center gap-2 text-sm font-semibold text-cyan-800">{action}<ArrowRight size={17} className="transition group-hover:translate-x-1"/></span>
  </Link>;
}
