import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PageContainer from "../../page-container";
import FinanceNavigation from "../finance-nav";
import FinancialAutomationPanel from "../automation-panel";

export const metadata = { title: "Subir arquivos — Financeiro EctoDash" };

export default function ImportarFinanceiroPage() {
  return <PageContainer>
    <header className="flex w-full flex-col gap-1"><Link href="/financeiro" className="text-sm font-medium text-cyan-800 hover:underline">← Voltar ao início do financeiro</Link><h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">Subir arquivos</h1><p className="text-base text-zinc-600">Siga as etapas para preparar os documentos do mês.</p></header>
    <FinanceNavigation />
    <FinancialAutomationPanel />
    <aside className="flex w-full flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 sm:flex-row sm:items-center sm:justify-between"><p>Depois do envio, lançamentos incertos ficam em <strong>Conferência</strong>. Os dados lidos já aparecem em Análise e Lançamentos.</p><Link href="/financeiro/conferencia" className="inline-flex shrink-0 items-center gap-1 font-semibold text-cyan-800 hover:underline">Abrir conferência <ArrowRight size={15}/></Link></aside>
  </PageContainer>;
}
