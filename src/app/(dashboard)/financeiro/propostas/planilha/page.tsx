// /financeiro/propostas/planilha — vínculo com o Google Planilhas:
// puxar as linhas para o sistema, gravar o estado do sistema na planilha
// e ver as planilhas vinculadas por proposta. Mesmo gate do módulo
// (financeiro ou coordenador_geral).
import Link from "next/link";
import { ArrowLeft, ExternalLink, Lock, Table2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../../page-container";
import PropostasSync from "../propostas-sync";
import PropostasTabs from "../propostas-tabs";

export const metadata = { title: "Planilha — Propostas | EctoDash" };

export default async function PlanilhaPage() {
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
    .from("propostas_financeiras")
    .select("aluno_nome, sheet_url, sincronizado_em");

  const vinculadas = ((data ?? []) as Array<Record<string, unknown>>).filter(
    (r) => (r.sheet_url as string | null) ?? false
  );
  const planilhas = [...new Set(vinculadas.map((r) => String(r.sheet_url)))].map((url) => ({
    url,
    alunos: [...new Set(vinculadas.filter((r) => String(r.sheet_url) === url).map((r) => String(r.aluno_nome)))],
  }));

  const ultimaSync = ((data ?? []) as Array<Record<string, unknown>>)
    .map((r) => r.sincronizado_em as string | null)
    .filter((s): s is string => Boolean(s))
    .sort()
    .pop();
  const ultimaSincronizacao = ultimaSync
    ? format(new Date(ultimaSync), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : null;

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
            <Table2 size={28} aria-hidden="true" className="text-[#2195B9]" />
            Planilha Google
          </h1>
          <p className="max-w-2xl text-xl text-zinc-500">
            Sincronize as cobranças com a planilha para acesso externo.
          </p>
        </div>
      </header>

      <PropostasTabs />

      <PropostasSync
        ultimaSincronizacao={ultimaSincronizacao}
        planilhaConfigurada={Boolean(process.env.PROPOSTAS_SHEET_ID)}
      />

      <section
        aria-labelledby="vinculadas-titulo"
        className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
      >
        <h2 id="vinculadas-titulo" className="text-2xl font-semibold text-zinc-900">
          Planilhas vinculadas ({planilhas.length})
        </h2>
        {planilhas.length === 0 ? (
          <p className="text-lg text-zinc-600">
            Nenhuma proposta tem link de planilha ainda. Cadastre o link ao
            registrar ou edite a proposta.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {planilhas.map((p) => (
              <li
                key={p.url}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-50 px-4 py-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-lg font-medium text-zinc-900">
                    {p.alunos.slice(0, 3).join(", ")}
                    {p.alunos.length > 3 ? ` (+${p.alunos.length - 3})` : ""}
                  </span>
                  <span className="truncate text-base text-zinc-500">{p.url}</span>
                </div>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center gap-2 rounded-lg px-4 text-lg font-medium text-[#2195B9] transition-colors hover:bg-[#2195B9]/10"
                >
                  <ExternalLink size={18} aria-hidden="true" />
                  Abrir planilha
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
