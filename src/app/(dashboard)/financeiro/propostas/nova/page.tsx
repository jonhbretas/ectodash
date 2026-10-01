// /financeiro/propostas/nova — cadastro de proposta do aluno (tela
// isolada; a lista vive em /financeiro/propostas). Mesmo gate do módulo
// (financeiro ou coordenador_geral); RLS da 0110/0111 é o limite real.
import Link from "next/link";
import { ArrowLeft, FileText, Lock, PlusCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../../page-container";
import PropostaForm from "../proposta-form";
import PropostasTabs from "../propostas-tabs";
import type { AlunoSugestao, EventoOpcao } from "../proposta-schema";

export const metadata = { title: "Cadastrar proposta — Financeiro | EctoDash" };

async function gate() {
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
  return allowed ? supabase : null;
}

export default async function NovaPropostaPage() {
  const supabase = await gate();

  if (!supabase) {
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

  const [eventosResult, alunosResult, produtosResult] = await Promise.all([
    supabase.from("eventos").select("id, titulo").order("data_evento", { ascending: false }).limit(100),
    supabase.from("wp_customers").select("first_name, last_name, email").limit(300),
    supabase.from("wp_products").select("name").limit(200),
  ]);

  const eventos: EventoOpcao[] = ((eventosResult.data ?? []) as Array<Record<string, unknown>>).map(
    (e) => ({ id: Number(e.id), titulo: String(e.titulo) })
  );

  const alunos: AlunoSugestao[] = ((alunosResult.data ?? []) as Array<Record<string, unknown>>)
    .map((c) => ({
      nome: `${String(c.first_name ?? "").trim()} ${String(c.last_name ?? "").trim()}`.trim(),
      email: String(c.email ?? "").trim(),
    }))
    .filter((a) => a.nome.length >= 3);

  const cursosSugeridos = [
    ...new Set([
      ...eventos.map((e) => e.titulo),
      ...((produtosResult.data ?? []) as Array<Record<string, unknown>>).map((p) =>
        String(p.name ?? "").trim()
      ).filter(Boolean),
    ]),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <Link
            href="/financeiro/propostas"
            className="inline-flex items-center gap-1.5 text-base font-medium text-[#2195B9] transition-colors hover:text-[#28627B]"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            Voltar às propostas
          </Link>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <PlusCircle size={28} aria-hidden="true" className="text-[#2195B9]" />
            Cadastrar proposta
          </h1>
          <p className="max-w-2xl text-xl text-zinc-500">
            Registre a cobrança do aluno: curso, valor, método, parcelas e prazo.
          </p>
        </div>
      </header>

      <PropostasTabs />

      <section
        aria-labelledby="form-titulo"
        className="flex w-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
      >
        <h2 id="form-titulo" className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <FileText size={24} aria-hidden="true" className="text-[#2195B9]" />
          Dados da proposta
        </h2>
        <PropostaForm alunos={alunos} eventos={eventos} cursosSugeridos={cursosSugeridos} />
      </section>
    </PageContainer>
  );
}
