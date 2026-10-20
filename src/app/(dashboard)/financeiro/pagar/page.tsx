// /financeiro/pagar — contas que a Ectolab precisa pagar: título,
// fornecedor, valor, vencimento, método e situação. Mesmo gate do
// /financeiro (financeiro ou coordenador_geral); RLS da 0112 é o limite.
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, Lock, Plus, ReceiptText, SearchX, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../page-container";
import FinanceNavigation from "../finance-nav";
import PagarForm, { type Conta } from "./pagar-form";
import PagarList from "./pagar-list";
import type { METODOS } from "../propostas/proposta-schema";

export const metadata = { title: "A pagar — Financeiro | EctoDash" };

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function adicionarDias(iso: string, dias: number) {
  const data = new Date(`${iso}T00:00:00`);
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

export default async function PagarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowed =
    profile?.role === "coordenador_geral" || profile?.role === "financeiro";

  if (!allowed) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">
            Este painel é exclusivo das finanças
          </h1>
          <p className="max-w-md text-xl text-zinc-700">
            Você não tem acesso ao financeiro da instituição.
          </p>
          <Link
            href="/"
            className="flex min-h-14 items-center justify-center rounded-lg bg-[#2195B9] px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-[#28627B]"
          >
            Voltar ao início
          </Link>
        </div>
      </PageContainer>
    );
  }

  const { data } = await supabase
    .from("pagamentos_ectolab")
    .select("id, titulo, fornecedor, valor, vencimento, status, metodo, observacoes, recorrencia, grupo_recorrencia, debito_id")
    .order("vencimento", { ascending: true, nullsFirst: false })
    .order("id", { ascending: false });

  const contas: Conta[] = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    titulo: String(r.titulo),
    fornecedor: (r.fornecedor as string | null) ?? null,
    valor: Number(r.valor),
    vencimento: (r.vencimento as string | null) ?? null,
    status: r.status as Conta["status"],
    metodo: r.metodo as (typeof METODOS)[number],
    observacoes: (r.observacoes as string | null) ?? null,
    recorrencia: (r.recorrencia as Conta["recorrencia"]) ?? "unica",
    grupo_recorrencia: (r.grupo_recorrencia as string | null) ?? null,
    debito_id: (r.debito_id as number | null) ?? null,
  }));

  const totalPendente = contas
    .filter((c) => c.status === "pendente")
    .reduce((s, c) => s + c.valor, 0);
  const hoje = hojeISO();
  const proximaSemana = adicionarDias(hoje, 7);
  const pendentes = contas.filter((c) => c.status === "pendente");
  const vencidas = pendentes.filter((c) => c.vencimento && c.vencimento < hoje);
  const vencemHoje = pendentes.filter((c) => c.vencimento === hoje);
  const vencemNaSemana = pendentes.filter(
    (c) => c.vencimento && c.vencimento > hoje && c.vencimento <= proximaSemana
  );

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <Link
            href="/financeiro"
            className="inline-flex items-center gap-1.5 text-base font-medium text-[#2195B9] transition-colors hover:text-[#28627B]"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            Voltar ao Financeiro
          </Link>
          <h1 className="text-3xl font-semibold text-zinc-900">A pagar — Ectolab</h1>
          <p className="max-w-2xl text-xl text-zinc-500">
            Contas que a instituição precisa pagar, com vencimento e baixa.
          </p>
        </div>
        <div className="rounded-2xl bg-white px-5 py-4 ring-1 ring-zinc-200/60">
          <p className="text-base text-zinc-500">Em aberto</p>
          <p className="text-2xl font-semibold text-amber-700">{brl.format(totalPendente)}</p>
        </div>
      </header>

      <FinanceNavigation />

      <section aria-label="Resumo de pagamentos" className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ResumoCard icon={AlertTriangle} label="Em atraso" value={String(vencidas.length)} detail={brl.format(vencidas.reduce((s, c) => s + c.valor, 0))} tone="red" />
        <ResumoCard icon={CalendarClock} label="Vencem hoje" value={String(vencemHoje.length)} detail={brl.format(vencemHoje.reduce((s, c) => s + c.valor, 0))} tone="amber" />
        <ResumoCard icon={WalletCards} label="Próximos 7 dias" value={String(vencemNaSemana.length)} detail={brl.format(vencemNaSemana.reduce((s, c) => s + c.valor, 0))} tone="blue" />
        <ResumoCard icon={CheckCircle2} label="Pagas" value={String(contas.filter((c) => c.status === "pago").length)} detail="no período listado" tone="green" />
      </section>

      <details
        aria-labelledby="nova-conta-titulo"
        className="group w-full rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
      >
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-2xl font-semibold text-zinc-900 marker:hidden">
          <span id="nova-conta-titulo" className="flex items-center gap-2">
            <ReceiptText size={24} aria-hidden="true" className="text-[#2195B9]" />
            Registrar nova conta
          </span>
          <span className="inline-flex items-center gap-2 rounded-lg bg-[#2195B9] px-3 py-2 text-base font-medium text-white group-open:hidden">
            <Plus size={17} aria-hidden="true" />
            Nova conta
          </span>
        </summary>
        <div className="border-t border-zinc-100 p-5">
          <PagarForm />
        </div>
      </details>

      {contas.length === 0 ? (
        <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <SearchX size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">Nenhuma conta ainda</h2>
          <p className="max-w-md text-xl text-zinc-700">
            Registre a primeira conta no formulário acima.
          </p>
        </div>
      ) : (
        <section aria-label="Contas" className="flex w-full flex-col gap-4">
          <p className="text-base text-zinc-500">
            {contas.length} {contas.length === 1 ? "conta" : "contas"}
          </p>
          <PagarList contas={contas} />
        </section>
      )}
    </PageContainer>
  );
}

function ResumoCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: string;
  detail: string;
  tone: "red" | "amber" | "blue" | "green";
}) {
  const tones = {
    red: "bg-red-50 text-red-700 ring-red-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    blue: "bg-sky-50 text-sky-700 ring-sky-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  };
  return (
    <div className={`rounded-2xl p-4 ring-1 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-base font-medium">
        <Icon size={18} aria-hidden="true" />
        {label}
      </div>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-base opacity-80">{detail}</p>
    </div>
  );
}
