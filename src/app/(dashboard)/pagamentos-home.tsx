// src/app/(dashboard)/pagamentos-home.tsx
// Seção "Pagamentos e cobranças" da home: contas que a Ectolab precisa
// pagar + contratos aguardando assinatura + cobranças dos alunos
// (parcelas). Visível SÓ a financeiro e coordenador_geral (a RLS de cada
// tabela é o limite real; aqui é UX). Retorna null para os demais.
import Link from "next/link";
import {
  ArrowRight,
  FileSignature,
  GraduationCap,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoMaisDias(baseISO: string, dias: number): string {
  const [y, m, d] = baseISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + dias);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default async function PagamentosHome() {
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

  const pode =
    profile?.role === "coordenador_geral" || profile?.role === "financeiro";
  if (!pode) return null;

  const today = hojeISO();
  const em7 = isoMaisDias(today, 7);

  const [{ data: aPagar }, { data: contratos }, { data: parcelas }] =
    await Promise.all([
      supabase
        .from("pagamentos_ectolab")
        .select("valor, vencimento")
        .eq("status", "pendente"),
      supabase
        .from("contratos")
        .select("id, aluno_nome, status, expira_em")
        .in("status", ["gerado", "assinando"]),
      supabase
        .from("proposta_parcelas")
        .select("valor, vencimento, propostas_financeiras!inner (aluno_nome)")
        .eq("status", "pendente"),
    ]);

  const contas = (aPagar ?? []).map((c) => ({
    valor: Number(c.valor),
    vencimento: (c.vencimento as string | null) ?? null,
  }));
  const contasVencidas = contas.filter((c) => c.vencimento !== null && c.vencimento < today);
  const contasSemana = contas.filter(
    (c) => c.vencimento !== null && c.vencimento >= today && c.vencimento <= em7
  );
  const totalContas = contas.reduce((s, c) => s + c.valor, 0);

  const listaContratos = (contratos ?? []).map((c) => ({
    expira: (c.expira_em as string | null) ?? null,
  }));
  const contratosVencidos = listaContratos.filter(
    (c) => c.expira !== null && c.expira < today
  );

  const cobrancas = (parcelas ?? []).map((p) => ({
    valor: Number(p.valor),
    vencimento: String(p.vencimento),
  }));
  const cobrVencidas = cobrancas.filter((c) => c.vencimento < today);
  const cobrSemana = cobrancas.filter((c) => c.vencimento >= today && c.vencimento <= em7);
  const totalCobrancas = cobrancas.reduce((s, c) => s + c.valor, 0);

  const blocos = [
    {
      href: "/financeiro/pagar",
      titulo: "A pagar — Ectolab",
      Icon: Wallet,
      numero: contasVencidas.length,
      numeroLabel: contasVencidas.length === 1 ? "conta vencida" : "contas vencidas",
      detalhe:
        contas.length === 0
          ? "Nada pendente"
          : `${brl.format(totalContas)} em aberto` +
            (contasSemana.length > 0 ? ` · ${contasSemana.length} vencendo na semana` : ""),
      alerta: contasVencidas.length > 0,
    },
    {
      href: "/utilidades/contratos",
      titulo: "Contratos",
      Icon: FileSignature,
      numero: listaContratos.length,
      numeroLabel:
        listaContratos.length === 1 ? "aguardando assinatura" : "aguardando assinatura",
      detalhe:
        contratosVencidos.length > 0
          ? `${contratosVencidos.length} com prazo estourado`
          : listaContratos.length === 0
            ? "Nada aguardando"
            : "Acompanhe os prazos",
      alerta: contratosVencidos.length > 0,
    },
    {
      href: "/financeiro/propostas",
      titulo: "Cobranças de alunos",
      Icon: GraduationCap,
      numero: cobrVencidas.length,
      numeroLabel: cobrVencidas.length === 1 ? "parcela atrasada" : "parcelas atrasadas",
      detalhe:
        cobrancas.length === 0
          ? "Nada a cobrar"
          : `${brl.format(totalCobrancas)} a receber` +
            (cobrSemana.length > 0 ? ` · ${cobrSemana.length} vencendo na semana` : ""),
      alerta: cobrVencidas.length > 0,
    },
  ];

  return (
    <section aria-label="Pagamentos e cobranças" className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Pagamentos e cobranças</h2>
        <span className="text-sm text-slate-500">Visão do financeiro</span>
      </div>
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        {blocos.map(({ href, titulo, Icon, numero, numeroLabel, detalhe, alerta }) => (
          <Link
            key={titulo}
            href={href}
            className="group flex min-h-24 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-[#2195B9]/30 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            <span
              className={`flex size-12 shrink-0 items-center justify-center rounded-xl text-white ${
                alerta ? "bg-red-600" : "bg-[#28627B]"
              }`}
              aria-hidden="true"
            >
              <Icon size={24} strokeWidth={1.75} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base font-semibold leading-tight text-zinc-900">
                {titulo}
              </span>
              <span className={`text-2xl font-bold tracking-tight ${alerta ? "text-red-700" : "text-slate-900"}`}>
                {numero}{" "}
                <span className="text-sm font-normal text-slate-500">{numeroLabel}</span>
              </span>
              <span className="truncate text-sm text-slate-500">{detalhe}</span>
            </span>
            <ArrowRight
              size={18}
              aria-hidden="true"
              className="shrink-0 text-slate-300 transition-colors group-hover:text-[#2195B9]"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
