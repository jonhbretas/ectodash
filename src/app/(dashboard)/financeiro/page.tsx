// /financeiro — Phase 10's financial dashboard (FIN-02/FIN-04): only
// coordenador_geral and financeiro can view it. The role branch below is a
// UX-layer convenience — financial_entries and sheet_sync_runs carry their
// own financeiro/coordenador-only SELECT RLS policies (migration 0006), so
// a wrongly-rendered page would still return zero rows to any other role.
import Link from "next/link";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Lock,
  Scale,
  Wallet,
  TrendingUp,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import StatCard from "@/components/stat-card";
import SheetSyncPanel, {
  type SheetSyncRunRow,
} from "../painel/sheet-sync-panel";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const metadata = { title: "Financeiro — EctoDash" };

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

export default async function FinanceiroPage() {
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
            className="flex min-h-14 items-center justify-center rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
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
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Wallet size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhum dado financeiro sincronizado ainda
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            Os lançamentos da planilha de fluxo de caixa aparecem aqui
            automaticamente após a primeira sincronização.
          </p>
          <SheetSyncPanel runs={syncRuns} />
        </div>
      </PageContainer>
    );
  }

  const { monthlyRows, totalEntradas, totalSaidas, caixaAtual } =
    computeSummary(entries);

  const mesAtual = format(new Date(), "MM/yyyy", { locale: ptBR });
  const mesAtualRow = monthlyRows.find((row) => row.mes === mesAtual);
  const entradasMes = mesAtualRow?.entradas ?? 0;
  const saidasMes = mesAtualRow?.saidas ?? 0;
  const resultadoMes = entradasMes - saidasMes;

  // Saídas agrupadas por categoria (sem categoria vira "Sem categoria"),
  // ordenadas do maior para o menor valor.
  const saidasPorCategoria = new Map<string, number>();
  for (const entry of entries) {
    if (entry.tipo !== "saida") continue;
    const key = entry.categoria?.trim() || "Sem categoria";
    saidasPorCategoria.set(key, (saidasPorCategoria.get(key) ?? 0) + entry.valor);
  }
  const categoriaRows = [...saidasPorCategoria.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);

  return (
    <PageContainer>
      
      <Header />

      <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Entradas do mês"
          value={brl.format(entradasMes)}
          Icon={ArrowUpCircle}
          iconClassName="text-green-700"
        />
        <StatCard
          label="Saídas do mês"
          value={brl.format(saidasMes)}
          Icon={ArrowDownCircle}
          iconClassName="text-red-700"
        />
        <StatCard
          label="Resultado do mês"
          value={brl.format(resultadoMes)}
          Icon={Scale}
          iconClassName={resultadoMes < 0 ? "text-red-700" : "text-blue-700"}
        />
        <StatCard
          label="Caixa atual"
          value={brl.format(caixaAtual)}
          Icon={TrendingUp}
          iconClassName={caixaAtual < 0 ? "text-red-700" : "text-green-700"}
        />
      </div>

      <section className="flex w-full max-w-4xl flex-col gap-2">
        <h2 className="text-2xl font-semibold text-zinc-900">Mês a mês</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-300 bg-white">
          <table className="w-full min-w-[36rem] text-left">
            <thead>
              <tr className="border-b border-zinc-300 text-xl text-zinc-700">
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
              {monthlyRows.map((row) => (
                <tr
                  key={row.mes}
                  className="border-b border-zinc-200 text-xl text-zinc-900 last:border-b-0"
                >
                  <td className="px-4 py-3 font-medium">{row.mes}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {categoriaRows.length > 0 && (
        <section className="flex w-full max-w-4xl flex-col gap-2">
          <h2 className="text-2xl font-semibold text-zinc-900">
            Saídas por categoria
          </h2>
          <div className="flex flex-col rounded-xl border border-zinc-300 bg-white">
            {categoriaRows.map((row) => (
              <div
                key={row.categoria}
                className="flex items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3 last:border-b-0"
              >
                <span className="text-xl text-zinc-900">{row.categoria}</span>
                <span className="text-xl font-medium text-red-700">
                  {brl.format(row.total)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex w-full max-w-4xl flex-col gap-2">
        <h2 className="text-2xl font-semibold text-zinc-900">
          Últimos lançamentos
        </h2>
        <div className="flex flex-col rounded-xl border border-zinc-300 bg-white">
          {entries.slice(0, 10).map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3 last:border-b-0"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-xl text-zinc-900">
                  {entry.descricao}
                </span>
                <span className="text-base text-zinc-700">
                  {format(new Date(`${entry.data}T00:00:00`), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}
                  {entry.categoria ? ` · ${entry.categoria}` : ""}
                </span>
              </div>
              <span
                className={`shrink-0 text-xl font-semibold ${
                  entry.tipo === "entrada" ? "text-green-700" : "text-red-700"
                }`}
              >
                {entry.tipo === "entrada" ? "+" : "-"}
                {brl.format(entry.valor)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <SheetSyncPanel runs={syncRuns} />
    </PageContainer>
  );
}

function Header() {
  return (
    <div className="flex w-full max-w-4xl flex-col gap-2">
      <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
        <FileText size={28} aria-hidden="true" />
        Financeiro
      </h1>
      <p className="text-base text-zinc-700">
        Fluxo de caixa da instituição, sincronizado com a planilha.
      </p>
    </div>
  );
}

// Pure aggregation — one pass over the entries, no per-month queries:
// running total (caixa atual) is the sum of ALL entries ever synced; the
// monthly rows span the oldest to the newest entry date, always
// chronologically ascending.
function computeSummary(entries: EntryRow[]) {
  const monthly = new Map<string, { entradas: number; saidas: number }>();

  let caixaAtual = 0;
  for (const entry of entries) {
    const key = format(new Date(`${entry.data}T00:00:00`), "MM/yyyy", {
      locale: ptBR,
    });
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

  const totalEntradas = entries
    .filter((e) => e.tipo === "entrada")
    .reduce((sum, e) => sum + e.valor, 0);
  const totalSaidas = entries
    .filter((e) => e.tipo === "saida")
    .reduce((sum, e) => sum + e.valor, 0);

  return { monthlyRows, totalEntradas, totalSaidas, caixaAtual };
}
