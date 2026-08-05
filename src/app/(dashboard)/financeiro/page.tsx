// /financeiro — Phase 10's financial dashboard (FIN-02/FIN-04): only
// coordenador_geral and financeiro can view it. The role branch below is a
// UX-layer convenience — financial_entries and sheet_sync_runs carry their
// own financeiro/coordenador-only SELECT RLS policies (migration 0006), so
// a wrongly-rendered page would still return zero rows to any other role.
//
// Layout mirrors the demandas screen: full-width sections, a collapsible
// filter bar (Mês / Tipo / Categoria) driven by searchParams, modern
// white/ring stat pills, and a per-month table that highlights the
// selected month. The month filter re-centers every section — stats and
// charts describe the selected period, "Caixa acumulado" becomes the
// running balance at the end of that month, and "Mês a mês" still shows
// every month (highlighting the selection).
import Link from "next/link";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Lock,
  Scale,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import ImportFinanceiroToggle from "./import-toggle";
import FinanceiroFilters from "./financeiro-filters";
import {
  labelMes,
  parseFinanceiroFilters,
  type FinanceiroFilters as FinanceiroFilterState,
} from "./financeiro-filter-schema";
import SheetSyncPanel, {
  type SheetSyncRunRow,
} from "../painel/sheet-sync-panel";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const metadata = { title: "Financeiro — EctoDash" };

// AI didactic summary (importarFinanceiro) may run past the default 10s
// function budget on long imports — give the page's server actions room.
export const maxDuration = 60;

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

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // searchParams is untrusted URL input — zod-validated before any value
  // reaches an aggregation or a Supabase query (05-RESEARCH.md Pattern 5).
  const filters: FinanceiroFilterState = parseFinanceiroFilters(
    await searchParams
  );

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
            className="flex min-h-14 items-center justify-center rounded-lg bg-[#d4883a] px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-[#c07828] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]"
          >
            Ver minhas demandas
          </Link>
        </div>
      </PageContainer>
    );
  }

  // Both reads in parallel — the page's data never depends on the run-log
  // read, so awaiting them sequentially would only add latency.
  const [entriesResult, runsResult] = await Promise.all([
    supabase
      .from("financial_entries")
      .select("id, tipo, descricao, valor, data, categoria")
      .order("data", { ascending: false }),
    supabase
      .from("sheet_sync_runs")
      .select(
        "id, started_at, finished_at, status, entries_count, error_message"
      )
      .order("started_at", { ascending: false })
      .limit(20),
  ]);

  const entries: EntryRow[] = (entriesResult.data ?? []).map((row) => ({
    id: row.id,
    tipo: row.tipo,
    descricao: row.descricao,
    valor: row.valor,
    data: row.data,
    categoria: row.categoria,
  }));

  const syncRuns: SheetSyncRunRow[] = (runsResult.data ?? []).map((row) => ({
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status,
    entriesCount: row.entries_count,
    errorMessage: row.error_message,
  }));

  if (entries.length === 0) {
    return (
      <PageContainer>
        <Header />
        <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <Wallet size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhum dado financeiro sincronizado ainda
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            Importe a planilha acima ou aguarde a sincronização automática
            com o Google Sheets.
          </p>
        </div>
        <SheetSyncPanel runs={syncRuns} className="max-w-none" />
      </PageContainer>
    );
  }

  // Filter-option pools come from the UNFILTERED entry set, so a filter
  // never disappears an option it isn't filtering on (same contract as the
  // demandas screen's base read). Months newest-first; categories sorted.
  const mesOptions = [
    ...new Set(entries.map((entry) => monthKey(entry.data))),
  ].sort((a, b) => b.localeCompare(a));
  const categoriaOptions = [
    ...new Set(
      entries
        .map((entry) => entry.categoria?.trim())
        .filter((categoria): categoria is string => Boolean(categoria))
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  // The filtered working set — every section below reads from it.
  const filtered = entries.filter((entry) => {
    if (filters.mes && monthKey(entry.data) !== filters.mes) return false;
    if (filters.tipo && entry.tipo !== filters.tipo) return false;
    if (
      filters.categoria &&
      (entry.categoria?.trim() || "Sem categoria") !== filters.categoria
    ) {
      return false;
    }
    return true;
  });

  const entradas = sumByTipo(filtered, "entrada");
  const saidas = sumByTipo(filtered, "saida");
  const resultado = entradas - saidas;

  // Caixa: with a month selected it is the running balance at the END of
  // that month (all-time entries, tipo/categoria filters don't change the
  // real balance); without one, the running total across everything.
  const caixaAcumulado = filters.mes
    ? caixaAteFimDoMes(filters.mes, entries)
    : computeSummary(entries).caixaAtual;

  // "Mês a mês" ignores the month filter (it IS the per-month view) but
  // honors tipo/categoria so the table answers "saídas por mês" etc.
  const tableEntries = filters.tipo || filters.categoria ? filtered : entries;
  const { monthlyRows } = computeSummary(tableEntries);

  // Saídas por categoria — from the filtered set (so the month filter
  // applies), only when the tipo filter isn't already "entrada".
  const saidasPorCategoria = new Map<string, number>();
  for (const entry of filtered) {
    if (entry.tipo !== "saida") continue;
    const key = entry.categoria?.trim() || "Sem categoria";
    saidasPorCategoria.set(key, (saidasPorCategoria.get(key) ?? 0) + entry.valor);
  }
  const categoriaRows = [...saidasPorCategoria.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);
  const totalSaidasCategorias = categoriaRows.reduce(
    (sum, row) => sum + row.total,
    0
  );

  const ultimosLancamentos = filtered.slice(0, 20);

  const stats = {
    entradasLabel: filters.mes ? "Entradas do mês" : "Entradas no período",
    saidasLabel: filters.mes ? "Saídas do mês" : "Saídas no período",
    resultadoLabel: filters.mes ? "Resultado do mês" : "Resultado no período",
    caixaLabel: filters.mes ? "Caixa no fim do mês" : "Caixa acumulado",
  };

  return (
    <PageContainer>
      <Header />

      <FinanceiroFilters
        mesOptions={mesOptions}
        categoriaOptions={categoriaOptions}
        currentFilters={filters}
      />

      {/* Stats — modern pills with semantic grouping, like the demandas
          screen. Values describe the filtered period. */}
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatPill
          label={stats.entradasLabel}
          value={brl.format(entradas)}
          Icon={ArrowUpCircle}
          iconClassName="text-green-600"
        />
        <StatPill
          label={stats.saidasLabel}
          value={brl.format(saidas)}
          Icon={ArrowDownCircle}
          iconClassName="text-red-600"
        />
        <StatPill
          label={stats.resultadoLabel}
          value={brl.format(resultado)}
          Icon={Scale}
          iconClassName={resultado < 0 ? "text-red-600" : "text-[#d4883a]"}
        />
        <StatPill
          label={stats.caixaLabel}
          value={brl.format(caixaAcumulado)}
          Icon={TrendingUp}
          iconClassName={caixaAcumulado < 0 ? "text-red-600" : "text-green-600"}
        />
      </div>

      {/* Mês a mês — full-width table, selected month highlighted. */}
      <section className="flex w-full flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-semibold text-zinc-900">Mês a mês</h2>
          <span className="text-base text-zinc-500">
            {monthlyRows.length} {monthlyRows.length === 1 ? "mês" : "meses"}
          </span>
        </div>
        <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <table className="w-full min-w-[36rem] text-left">
            <thead>
              <tr className="border-b border-zinc-100 text-sm uppercase tracking-wide text-zinc-500">
                <th scope="col" className="px-4 py-3 font-medium">
                  Mês
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Entradas
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Saídas
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Resultado
                </th>
              </tr>
            </thead>
            <tbody>
              {monthlyRows.map((row) => {
                const selected = row.mes === filters.mes;
                return (
                  <tr
                    key={row.mes}
                    className={`border-b border-zinc-100 text-lg text-zinc-900 last:border-b-0 transition-colors hover:bg-zinc-50 ${
                      selected ? "bg-[#f5f0eb]/70 ring-1 ring-inset ring-[#f0e0cf]" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium">
                      <span className="flex items-center gap-2">
                        {labelMes(row.mes)}
                        {selected && (
                          <span className="rounded-full bg-[#d4883a] px-2 py-0.5 text-sm font-semibold text-white">
                            Selecionado
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-green-700">
                      {brl.format(row.entradas)}
                    </td>
                    <td className="px-4 py-3 text-red-700">
                      {brl.format(row.saidas)}
                    </td>
                    <td
                      className={`px-4 py-3 ${
                        row.resultado < 0 ? "text-red-700" : "text-zinc-900"
                      }`}
                    >
                      {brl.format(row.resultado)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid w-full grid-cols-1 gap-5 xl:grid-cols-2">
        {categoriaRows.length > 0 && (
          <section className="flex w-full flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl font-semibold text-zinc-900">
                Saídas por categoria
              </h2>
              <span className="text-base text-zinc-500">
                {totalSaidasCategorias > 0
                  ? brl.format(totalSaidasCategorias)
                  : ""}
              </span>
            </div>
            <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
              {categoriaRows.map((row) => (
                <div key={row.categoria} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="truncate text-lg font-medium text-zinc-900">
                      {row.categoria}
                    </span>
                    <span className="shrink-0 text-lg font-semibold text-red-700">
                      {brl.format(row.total)}
                    </span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-zinc-100"
                    role="progressbar"
                    aria-label={`${row.categoria}: ${Math.round(
                      (row.total / totalSaidasCategorias) * 100
                    )}% das saídas`}
                    aria-valuenow={Math.round(
                      (row.total / totalSaidasCategorias) * 100
                    )}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-red-500/80 transition-all duration-300"
                      style={{
                        width: `${(row.total / totalSaidasCategorias) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="flex w-full flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-semibold text-zinc-900">
              Últimos lançamentos
            </h2>
            <span className="text-base text-zinc-500">
              {filtered.length} {filtered.length === 1 ? "lançamento" : "lançamentos"}
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
                {ultimosLancamentos.map((entry) => (
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
        </section>
      </div>

      <SheetSyncPanel runs={syncRuns} className="max-w-none" />
    </PageContainer>
  );
}

function Header() {
  return (
    <header className="flex w-full flex-wrap items-start justify-between gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-zinc-900">Financeiro</h1>
        <p className="text-xl text-zinc-500">
          Fluxo de caixa da instituição, sincronizado com a planilha.
        </p>
      </div>
      <ImportFinanceiroToggle />
    </header>
  );
}

// Stat pill in the same visual language as the demandas screen's stat
// cards — white, soft ring, icon+label paired, value below.
function StatPill({
  label,
  value,
  Icon,
  iconClassName,
}: {
  label: string;
  value: string;
  Icon: typeof ArrowUpCircle;
  iconClassName: string;
}) {
  return (
    <div
      role="group"
      aria-label={`${label}: ${value}`}
      className="flex min-w-0 items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
    >
      <Icon size={24} aria-hidden="true" className={`shrink-0 ${iconClassName}`} />
      <div className="flex min-w-0 flex-col">
        <span className="text-base font-medium text-zinc-500">{label}</span>
        <span className="truncate text-xl font-semibold text-zinc-900 sm:text-2xl">
          {value}
        </span>
      </div>
    </div>
  );
}

function monthKey(data: string): string {
  return format(new Date(`${data}T00:00:00`), "MM/yyyy", { locale: ptBR });
}

function sumByTipo(entries: EntryRow[], tipo: "entrada" | "saida"): number {
  return entries
    .filter((entry) => entry.tipo === tipo)
    .reduce((sum, entry) => sum + entry.valor, 0);
}

// Running balance at the end of the given month (MM/yyyy) — entries on or
// before the month's last day, in the global (tipo/categoria-agnostic)
// sense the word "caixa" implies.
function caixaAteFimDoMes(mes: string, entries: EntryRow[]): number {
  const [month, year] = mes.split("/");
  const lastDay = format(new Date(Number(year), Number(month), 0), "yyyy-MM-dd");
  let total = 0;
  for (const entry of entries) {
    if (entry.data <= lastDay) {
      total += entry.tipo === "entrada" ? entry.valor : -entry.valor;
    }
  }
  return total;
}

// Pure aggregation — one pass over the entries, no per-month queries:
// running total (caixa atual) is the sum of ALL entries ever synced; the
// monthly rows span the oldest to the newest entry date, always
// chronologically ascending.
function computeSummary(entries: EntryRow[]) {
  const monthly = new Map<string, { entradas: number; saidas: number }>();

  let caixaAtual = 0;
  for (const entry of entries) {
    const key = monthKey(entry.data);
    const bucket = monthly.get(key) ?? { entradas: 0, saidas: 0 };
    if (entry.tipo === "entrada") {
      bucket.entradas += entry.valor;
      caixaAtual += entry.valor;
    } else {
      bucket.saidas += entry.valor;
      caixaAtual -= entry.valor;
    }
    monthly.set(key, bucket);
  }

  const monthlyRows = [...monthly.keys()].sort().map((mes) => {
    const { entradas, saidas } = monthly.get(mes) ?? { entradas: 0, saidas: 0 };
    return { mes, entradas, saidas, resultado: entradas - saidas };
  });

  return { monthlyRows, caixaAtual };
}
