// /financeiro/pagar — contas que a Ectolab precisa pagar: título,
// fornecedor, valor, vencimento, método e situação. Mesmo gate do
// /financeiro (financeiro ou coordenador_geral); RLS da 0112 é o limite.
import Link from "next/link";
import { ArrowLeft, Lock, ReceiptText, SearchX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../page-container";
import PagarForm, { type Conta } from "./pagar-form";
import PagarList from "./pagar-list";
import type { METODOS } from "../propostas/proposta-schema";

export const metadata = { title: "A pagar — Financeiro | EctoDash" };

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

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
    .select("id, titulo, fornecedor, valor, vencimento, status, metodo, observacoes, recorrencia, grupo_recorrencia")
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
  }));

  const totalPendente = contas
    .filter((c) => c.status === "pendente")
    .reduce((s, c) => s + c.valor, 0);

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
          <p className="text-base text-zinc-500">Pendente de pagamento</p>
          <p className="text-2xl font-semibold text-amber-700">{brl.format(totalPendente)}</p>
        </div>
      </header>

      <section
        aria-labelledby="nova-conta-titulo"
        className="flex w-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
      >
        <h2 id="nova-conta-titulo" className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <ReceiptText size={24} aria-hidden="true" className="text-[#2195B9]" />
          Registrar conta
        </h2>
        <PagarForm />
      </section>

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
