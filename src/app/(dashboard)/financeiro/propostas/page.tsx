// /financeiro/propostas — acompanhamento por ALUNO dos cursos, eventos
// e atividades da Ectolab: valor, método de pagamento, prazo, situação
// (pago/pendente) e vínculo com o Google Planilhas (puxar e gravar).
// Mesmo gate do /financeiro (financeiro ou coordenador_geral); a RLS da
// 0110 é o limite real. Alunos sugeridos vêm da loja (wp_customers).
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Lock,
  SearchX,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearch } from "@/lib/utils";
import { cn } from "@/lib/utils";
import PageContainer from "../../page-container";
import PropostaForm from "./proposta-form";
import PropostasList from "./propostas-list";
import PropostasSync from "./propostas-sync";
import {
  parsePropostasFilters,
  type PropostasFilters,
} from "./propostas-filter-schema";
import {
  estaAtrasada,
  type AlunoSugestao,
  type EventoOpcao,
  type Proposta,
} from "./proposta-schema";

export const metadata = { title: "Propostas — Financeiro | EctoDash" };

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const FILTROS: Array<{ valor: NonNullable<PropostasFilters["status"]> | undefined; rotulo: string }> = [
  { valor: undefined, rotulo: "Todas" },
  { valor: "pendente", rotulo: "Pendentes" },
  { valor: "atrasadas", rotulo: "Atrasadas" },
  { valor: "pago", rotulo: "Pagas" },
  { valor: "cancelado", rotulo: "Canceladas" },
];

function filtroHref(filters: PropostasFilters, status: string | undefined): string {
  const params = new URLSearchParams();
  if (filters.busca) params.set("busca", filters.busca);
  if (status) params.set("status", status);
  const qs = params.toString();
  return `/financeiro/propostas${qs ? `?${qs}` : ""}`;
}

export default async function PropostasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const filters = parsePropostasFilters(await searchParams);

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
            Você não tem acesso ao financeiro da instituição. Toque abaixo
            para voltar às suas demandas.
          </p>
          <Link
            href="/"
            className="flex min-h-14 items-center justify-center rounded-lg bg-[#2195B9] px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            Ver minhas demandas
          </Link>
        </div>
      </PageContainer>
    );
  }

  const termo = filters.busca ? sanitizeSearch(filters.busca) : null;

  // Propostas + eventos + alunos da loja + nomes de cursos em paralelo —
  // leituras independentes (RLS 0035 já libera wp_* ao financeiro).
  const [propResult, eventosResult, alunosResult, produtosResult] = await Promise.all([
    (() => {
      let q = supabase
        .from("propostas_financeiras")
        .select(
          "id, titulo, aluno_nome, aluno_email, curso_atividade, evento_id, descricao, valor, metodo, prazo, status, pago_em, sheet_url, observacoes, origem, sincronizado_em, eventos:evento_id (titulo)"
        );
      if (termo) {
        q = q.or(`aluno_nome.ilike.%${termo}%,curso_atividade.ilike.%${termo}%,titulo.ilike.%${termo}%`);
      }
      return q.order("prazo", { ascending: true, nullsFirst: false }).order("id", { ascending: false });
    })(),
    supabase.from("eventos").select("id, titulo").order("data_evento", { ascending: false }).limit(100),
    supabase.from("wp_customers").select("first_name, last_name, email").limit(300),
    supabase.from("wp_products").select("name").limit(200),
  ]);

  if (propResult.error) console.error("propostas: select failed", propResult.error);

  const todas: Proposta[] = ((propResult.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    titulo: String(r.titulo),
    aluno_nome: String(r.aluno_nome),
    aluno_email: (r.aluno_email as string | null) ?? null,
    curso_atividade: String(r.curso_atividade),
    evento_id: (r.evento_id as number | null) ?? null,
    evento_titulo:
      (r.eventos as { titulo?: string } | null)?.titulo ?? null,
    descricao: (r.descricao as string | null) ?? null,
    valor: Number(r.valor),
    metodo: r.metodo as Proposta["metodo"],
    prazo: (r.prazo as string | null) ?? null,
    status: r.status as Proposta["status"],
    pago_em: (r.pago_em as string | null) ?? null,
    sheet_url: (r.sheet_url as string | null) ?? null,
    observacoes: (r.observacoes as string | null) ?? null,
    origem: (r.origem as Proposta["origem"]) ?? "sistema",
    sincronizado_em: (r.sincronizado_em as string | null) ?? null,
    parcelas: [],
  }));

  // Parcelas das propostas listadas (cobrança mês a mês).
  const ids = todas.map((p) => p.id);
  if (ids.length > 0) {
    const { data: parcRows } = await supabase
      .from("proposta_parcelas")
      .select("id, proposta_id, numero, vencimento, valor, status, pago_em")
      .in("proposta_id", ids)
      .order("numero", { ascending: true });
    const porProposta = new Map<number, Proposta["parcelas"]>();
    for (const row of (parcRows ?? []) as Array<Record<string, unknown>>) {
      const pid = Number(row.proposta_id);
      const lista = porProposta.get(pid) ?? [];
      lista.push({
        id: Number(row.id),
        numero: Number(row.numero),
        vencimento: String(row.vencimento),
        valor: Number(row.valor),
        status: row.status as "pendente" | "pago",
        pago_em: (row.pago_em as string | null) ?? null,
      });
      porProposta.set(pid, lista);
    }
    for (const p of todas) p.parcelas = porProposta.get(p.id) ?? [];
  }

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
      ...todas.map((p) => p.curso_atividade),
    ]),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  // Totais sempre sobre TODAS (não sobre o filtro).
  const totalPendente = todas
    .filter((p) => p.status === "pendente")
    .reduce((s, p) => s + p.valor, 0);
  const totalPago = todas
    .filter((p) => p.status === "pago")
    .reduce((s, p) => s + p.valor, 0);
  const qtdAtrasadas = todas.filter(estaAtrasada).length;
  const qtdPendentes = todas.filter((p) => p.status === "pendente").length;

  const statusAtivo = filters.status ?? "todas";
  const visiveis = todas.filter((p) => {
    if (statusAtivo === "pendente") return p.status === "pendente";
    if (statusAtivo === "pago") return p.status === "pago";
    if (statusAtivo === "cancelado") return p.status === "cancelado";
    if (statusAtivo === "atrasadas") return estaAtrasada(p);
    return true;
  });

  const planilhas = [...new Set(todas.map((p) => p.sheet_url).filter(Boolean))] as string[];

  const ultimaSync = todas
    .map((p) => p.sincronizado_em)
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
            href="/financeiro"
            className="inline-flex items-center gap-1.5 text-base font-medium text-[#2195B9] transition-colors hover:text-[#28627B]"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            Voltar ao Financeiro
          </Link>
          <h1 className="text-3xl font-semibold text-zinc-900">Propostas — alunos</h1>
          <p className="max-w-2xl text-xl text-zinc-500">
            Pagamentos dos alunos nos cursos, eventos e atividades: método,
            prazo e situação (pago ou não), vinculados ao Google Planilhas.
          </p>
        </div>
      </header>

      {/* Resumo */}
      <section
        aria-label="Resumo das propostas"
        className="grid w-full grid-cols-2 gap-4 xl:grid-cols-4"
      >
        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <p className="text-base text-zinc-500">A receber / pendente</p>
          <p className="text-2xl font-semibold text-amber-700">{brl.format(totalPendente)}</p>
          <p className="text-base text-zinc-500">
            {qtdPendentes} {qtdPendentes === 1 ? "aluno" : "alunos"}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <p className="text-base text-zinc-500">Recebido / pago</p>
          <p className="text-2xl font-semibold text-green-700">{brl.format(totalPago)}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <p className="text-base text-zinc-500">Atrasadas</p>
          <p className={cn("text-2xl font-semibold", qtdAtrasadas > 0 ? "text-red-700" : "text-zinc-900")}>
            {qtdAtrasadas}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <p className="text-base text-zinc-500">Planilhas vinculadas</p>
          <p className="text-2xl font-semibold text-zinc-900">{planilhas.length}</p>
          {planilhas.slice(0, 2).map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-base font-medium text-[#2195B9] hover:text-[#28627B]"
            >
              <ExternalLink size={15} aria-hidden="true" />
              Abrir planilha
            </a>
          ))}
        </div>
      </section>

      <PropostasSync
        ultimaSincronizacao={ultimaSincronizacao}
        planilhaConfigurada={Boolean(process.env.PROPOSTAS_SHEET_ID)}
      />

      {/* Nova proposta */}
      <section
        aria-labelledby="nova-proposta-titulo"
        className="flex w-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
      >
        <h2 id="nova-proposta-titulo" className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <FileText size={24} aria-hidden="true" className="text-[#2195B9]" />
          Registrar proposta do aluno
        </h2>
        <PropostaForm alunos={alunos} eventos={eventos} cursosSugeridos={cursosSugeridos} />
      </section>

      {/* Filtros */}
      <form
        action="/financeiro/propostas"
        method="get"
        className="flex w-full flex-wrap items-end gap-3"
        role="search"
        aria-label="Filtrar propostas"
      >
        <div className="flex min-w-52 flex-1 flex-col gap-1">
          <label htmlFor="busca" className="text-base font-medium text-zinc-700">
            Buscar aluno ou curso
          </label>
          <input
            id="busca"
            name="busca"
            defaultValue={filters.busca ?? ""}
            placeholder="Nome do aluno ou curso…"
            maxLength={120}
            className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-lg text-zinc-900 placeholder:text-zinc-400"
          />
        </div>
        {filters.status && <input type="hidden" name="status" value={filters.status} />}
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-zinc-900 px-5 text-lg font-medium text-white transition-colors hover:bg-zinc-700"
        >
          Buscar
        </button>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Situação">
          {FILTROS.map((f) => {
            const ativo = statusAtivo === (f.valor ?? "todas");
            return (
              <Link
                key={f.rotulo}
                href={filtroHref(filters, f.valor)}
                aria-current={ativo ? "true" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-full border px-4 text-lg transition-colors",
                  ativo
                    ? "border-[#2195B9] bg-[#2195B9]/10 font-semibold text-[#28627B]"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                )}
              >
                {f.rotulo}
              </Link>
            );
          })}
        </div>
      </form>

      {/* Lista */}
      {visiveis.length === 0 ? (
        <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <SearchX size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            {todas.length === 0 ? "Nenhuma proposta ainda" : "Nada neste filtro"}
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            {todas.length === 0
              ? "Registre a primeira proposta no formulário acima ou puxe da planilha."
              : "Tente outro filtro ou busca."}
          </p>
        </div>
      ) : (
        <section aria-label="Propostas" className="flex w-full flex-col gap-4">
          <p className="text-base text-zinc-500">
            {visiveis.length} {visiveis.length === 1 ? "proposta" : "propostas"}
          </p>
          <PropostasList propostas={visiveis} alunos={alunos} eventos={eventos} cursosSugeridos={cursosSugeridos} />
        </section>
      )}
    </PageContainer>
  );
}
