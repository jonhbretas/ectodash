// /financeiro/lancamentos — todos os lançamentos financeiros, paginados no
// servidor (25 por página) e com busca rápida por nome/descrição. Mesmo
// gate de papel e mesma disciplina de validação de searchParams do
// /financeiro; a RLS das financial_entries (migration 0006) é o limite real
// de acesso.
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Lock, SearchX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearch } from "@/lib/utils";
import PageContainer from "../../page-container";
import LancamentosToolbar from "./lancamentos-toolbar";
import {
  LANCAMENTOS_POR_PAGINA,
  lancamentosPaginaAtual,
  parseLancamentosFilters,
  type LancamentosFilters,
} from "./lancamentos-filter-schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const metadata = { title: "Lançamentos — Financeiro | EctoDash" };

type EntryRow = {
  id: number;
  tipo: "entrada" | "saida";
  descricao: string;
  valor: number;
  data: string;
  categoria: string | null;
};

// One Intl formatter for the whole page — BRL currency, pt-BR grouping.
const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default async function LancamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // searchParams is untrusted URL input — zod-validated before any value
  // reaches a Supabase query (same discipline as /financeiro).
  const filters: LancamentosFilters = parseLancamentosFilters(await searchParams);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

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

  const pagina = lancamentosPaginaAtual(filters);
  const from = (pagina - 1) * LANCAMENTOS_POR_PAGINA;
  const to = from + LANCAMENTOS_POR_PAGINA - 1;

  // Busca por nome: o termo é sanitizado (escapa wildcards do ILIKE) antes
  // de virar padrão de busca — input cru nunca é emendado no filtro.
  const termo = filters.busca ? sanitizeSearch(filters.busca) : null;

  let query = supabase
    .from("financial_entries")
    .select("id, tipo, descricao, valor, data, categoria", { count: "exact" });
  if (termo) {
    query = query.ilike("descricao", `%${termo}%`);
  }

  const { data: rows, count } = await query
    .order("data", { ascending: false })
    .range(from, to);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LANCAMENTOS_POR_PAGINA));

  // Página pedida além do fim (URL editada à mão, busca que mudou etc.) —
  // recolhe para a última página válida e busca de novo.
  const paginaSegura = Math.min(pagina, totalPages);

  let entries: EntryRow[] = (rows ?? []).map((row) => ({
    id: row.id,
    tipo: row.tipo,
    descricao: row.descricao,
    valor: row.valor,
    data: row.data,
    categoria: row.categoria,
  }));

  if (paginaSegura !== pagina) {
    const safeFrom = (paginaSegura - 1) * LANCAMENTOS_POR_PAGINA;
    const { data: safeRows } = await query
      .order("data", { ascending: false })
      .range(safeFrom, safeFrom + LANCAMENTOS_POR_PAGINA - 1);
    entries = (safeRows ?? []).map((row) => ({
      id: row.id,
      tipo: row.tipo,
      descricao: row.descricao,
      valor: row.valor,
      data: row.data,
      categoria: row.categoria,
    }));
  }

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
          <h1 className="text-3xl font-semibold text-zinc-900">Lançamentos</h1>
          <p className="text-xl text-zinc-500">
            Todos os lançamentos do fluxo de caixa, com busca rápida por
            nome e paginação.
          </p>
        </div>
      </header>

      <LancamentosToolbar
        currentFilters={filters}
        total={total}
        totalPages={totalPages}
      />

      {entries.length === 0 ? (
        <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <SearchX size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            {filters.busca ? "Nenhum lançamento encontrado" : "Nenhum lançamento ainda"}
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            {filters.busca
              ? `Nenhum lançamento tem "${filters.busca}" no nome. Tente outra busca ou veja a lista completa.`
              : "Importe a planilha no Financeiro ou aguarde a sincronização automática com o Google Sheets."}
          </p>
          {filters.busca && (
            <Link
              href="/financeiro/lancamentos"
              className="flex min-h-14 items-center justify-center rounded-lg bg-[#2195B9] px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            >
              Ver todos os lançamentos
            </Link>
          )}
          {!filters.busca && (
            <Link
              href="/financeiro"
              className="flex min-h-14 items-center justify-center rounded-lg bg-[#2195B9] px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            >
              Voltar ao Financeiro
            </Link>
          )}
        </div>
      ) : (
        <section className="flex w-full flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-semibold text-zinc-900">
              Lançamentos
            </h2>
            <span className="text-base text-zinc-500">
              {paginaSegura}/{totalPages} páginas · {total}{" "}
              {total === 1 ? "lançamento" : "lançamentos"}
            </span>
          </div>
          <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
            <table className="w-full min-w-[40rem] text-left">
              <thead>
                <tr className="border-b border-zinc-100 text-sm uppercase tracking-wide text-zinc-500">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Data
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Descrição
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Categoria
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Tipo
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-zinc-100 text-lg text-zinc-900 last:border-b-0 transition-colors hover:bg-zinc-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                      {format(
                        new Date(`${entry.data}T00:00:00`),
                        "dd/MM/yyyy",
                        { locale: ptBR }
                      )}
                    </td>
                    <td className="max-w-[18rem] truncate px-4 py-3 font-medium">
                      {entry.descricao}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {entry.categoria ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-base font-medium ring-1 ${
                          entry.tipo === "entrada"
                            ? "bg-green-50 text-green-700 ring-green-200/60"
                            : "bg-red-50 text-red-700 ring-red-200/60"
                        }`}
                      >
                        {entry.tipo === "entrada" ? "Entrada" : "Saída"}
                      </span>
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${
                        entry.tipo === "entrada" ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {entry.tipo === "entrada" ? "+" : "-"}
                      {brl.format(entry.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação inferior — preserva a busca e nunca sai da página 1
              nem além da última página. */}
          <div className="flex items-center justify-between gap-3 self-end rounded-xl border border-zinc-200 bg-white px-4 py-2">
            <PaginaLink
              href={paginaHref(filters, paginaSegura - 1)}
              disabled={paginaSegura <= 1}
              ariaLabel="Página anterior"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </PaginaLink>
            <span className="text-base text-zinc-600">
              Página <strong className="text-zinc-900">{paginaSegura}</strong>{" "}
              de {totalPages}
            </span>
            <PaginaLink
              href={paginaHref(filters, paginaSegura + 1)}
              disabled={paginaSegura >= totalPages}
              ariaLabel="Próxima página"
            >
              <ChevronRight size={22} aria-hidden="true" />
            </PaginaLink>
          </div>
        </section>
      )}
    </PageContainer>
  );
}

// href da navegação de página — mantém a busca atual, troca só a página.
function paginaHref(filters: LancamentosFilters, paginaAlvo: number): string {
  const params = new URLSearchParams();
  if (filters.busca) params.set("busca", filters.busca);
  params.set("pagina", String(paginaAlvo));
  return `/financeiro/lancamentos?${params.toString()}`;
}

function PaginaLink({
  href,
  disabled,
  ariaLabel,
  children,
}: {
  href: string;
  disabled: boolean;
  ariaLabel: string;
  children: ReactNode;
}) {
  const base =
    "flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";
  if (disabled) {
    return (
      <span
        aria-label={ariaLabel}
        aria-disabled="true"
        className={`${base} cursor-not-allowed text-zinc-300`}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={`${base} text-zinc-700 hover:bg-zinc-100`}
    >
      {children}
    </Link>
  );
}
