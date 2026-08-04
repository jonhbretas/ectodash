// /analise — institution metrics dashboard (user decision, 2026-08-04):
// tasks done, per event, per área, per volunteer (productivity), events
// realized, and monthly revenue/expense evolution. Everything is computed
// from the SAME role-scoped reads the rest of the app uses — RLS decides
// what rows exist, so a voluntário sees only their own scoped numbers and
// the financeiro section is hidden unless the role can read it.
import { BarChart3, TrendingUp, TrendingDown, CheckCircle2, CalendarDays, ClipboardList, AlertTriangle } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";
import PageContainer from "../page-container";
import StatCard from "@/components/stat-card";

type DemandaRow = {
  id: number;
  titulo: string;
  status: string;
  area: string | null;
  atrasada: boolean;
  criado_por: string;
  created_at: string;
  concluida_em: string | null;
  evento_id: number | null;
};

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default async function AnalisePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [profileResult, demandasResult, eventosResult, linksResult, financeiroResult] =
    await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase
        .from("demandas_com_status")
        .select("id, titulo, status, area, atrasada, criado_por, created_at, concluida_em, evento_id"),
      supabase.from("eventos").select("id, titulo, data_evento"),
      supabase
        .from("demanda_responsaveis")
        .select("demanda_id, profile_id, profiles(email, full_name)"),
      supabase
        .from("financial_entries")
        .select("tipo, valor, data"),
    ]);

  const role = profileResult.data?.role;
  const podeVerFinanceiro =
    role === "coordenador_geral" || role === "financeiro";

  const demandas = (demandasResult.data ?? []) as DemandaRow[];
  const eventos = eventosResult.data ?? [];
  const links = linksResult.data ?? [];

  const eventoById = new Map(eventos.map((e) => [e.id, e.titulo]));
  const hoje = new Date();

  // --- Visão geral ---
  const total = demandas.length;
  const concluidas = demandas.filter((d) => d.status === "concluida").length;
  const atrasadas = demandas.filter((d) => d.atrasada).length;
  const taxaConclusao = total > 0 ? Math.round((concluidas / total) * 100) : 0;
  const eventosRealizados = eventos.filter(
    (e) => new Date(`${e.data_evento}T00:00:00`) < hoje
  ).length;

  // Concluídas neste mês — via concluida_em (migration 0013).
  const inicioMes = startOfMonth(hoje);
  const fimMes = endOfMonth(hoje);
  const concluidasEsteMes = demandas.filter((d) => {
    if (!d.concluida_em) return false;
    const data = new Date(d.concluida_em);
    return data >= inicioMes && data <= fimMes;
  }).length;

  // --- Evolução mensal (criadas vs concluídas), últimos 6 meses ---
  const meses = Array.from({ length: 6 }, (_, i) => subMonths(hoje, 5 - i));
  const evolucao = meses.map((mes) => {
    const inicio = startOfMonth(mes);
    const fim = endOfMonth(mes);
    const criadas = demandas.filter((d) => {
      const data = new Date(d.created_at);
      return data >= inicio && data <= fim;
    }).length;
    const feitas = demandas.filter((d) => {
      if (!d.concluida_em) return false;
      const data = new Date(d.concluida_em);
      return data >= inicio && data <= fim;
    }).length;
    return {
      label: format(mes, "MMM/yy", { locale: ptBR }),
      criadas,
      feitas,
    };
  });
  const maxEvolucao = Math.max(1, ...evolucao.map((m) => Math.max(m.criadas, m.feitas)));

  // --- Tarefas por área ---
  const porArea = new Map<string, { total: number; feitas: number }>();
  for (const d of demandas) {
    const key = d.area?.trim() || "Sem área definida";
    const current = porArea.get(key) ?? { total: 0, feitas: 0 };
    current.total += 1;
    if (d.status === "concluida") current.feitas += 1;
    porArea.set(key, current);
  }
  const areaRows = [...porArea.entries()]
    .map(([area, counts]) => ({ area, ...counts }))
    .sort((a, b) => b.total - a.total);
  const maxArea = Math.max(1, ...areaRows.map((r) => r.total));

  // --- Tarefas por evento ---
  const porEvento = new Map<number, { total: number; feitas: number }>();
  for (const d of demandas) {
    if (!d.evento_id) continue;
    const current = porEvento.get(d.evento_id) ?? { total: 0, feitas: 0 };
    current.total += 1;
    if (d.status === "concluida") current.feitas += 1;
    porEvento.set(d.evento_id, current);
  }
  const eventoRows = [...porEvento.entries()]
    .map(([id, counts]) => ({
      evento: eventoById.get(id) ?? "Evento removido",
      ...counts,
    }))
    .sort((a, b) => b.total - a.total);
  const maxEvento = Math.max(1, ...eventoRows.map((r) => r.total));

  // --- Produtividade por voluntário ---
  const porVoluntario = new Map<string, { nome: string; total: number; feitas: number }>();
  for (const link of links) {
    const profileRow = Array.isArray(link.profiles) ? link.profiles[0] : link.profiles;
    if (!profileRow) continue;
    const nome = displayName(profileRow);
    const demanda = demandas.find((d) => d.id === link.demanda_id);
    if (!demanda) continue;
    const current = porVoluntario.get(link.profile_id) ?? { nome, total: 0, feitas: 0 };
    current.total += 1;
    if (demanda.status === "concluida") current.feitas += 1;
    porVoluntario.set(link.profile_id, current);
  }
  const voluntarioRows = [...porVoluntario.values()].sort((a, b) => b.total - a.total);
  const maxVoluntario = Math.max(1, ...voluntarioRows.map((r) => r.total));

  // --- Financeiro: evolução mensal receita/despesa ---
  const financeiroRows = podeVerFinanceiro
    ? meses.map((mes) => {
        const inicio = startOfMonth(mes);
        const fim = endOfMonth(mes);
        let entradas = 0;
        let saidas = 0;
        for (const entry of (financeiroResult.data ?? []) as Array<{
          tipo: string;
          valor: number;
          data: string;
        }>) {
          const data = new Date(`${entry.data}T00:00:00`);
          if (data < inicio || data > fim) continue;
          if (entry.tipo === "entrada") entradas += entry.valor;
          else saidas += entry.valor;
        }
        return { label: format(mes, "MMM/yy", { locale: ptBR }), entradas, saidas };
      })
    : [];

  return (
    <PageContainer>
      <div className="flex w-full max-w-7xl flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <BarChart3 size={28} aria-hidden="true" />
          Análise
        </h1>
        <p className="text-base text-zinc-700">
          Métricas de produtividade e evolução da instituição.
        </p>
      </div>

      <div className="grid w-full max-w-7xl grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard label="Demandas" value={total} Icon={ClipboardList} />
        <StatCard
          label="Concluídas"
          value={concluidas}
          Icon={CheckCircle2}
          iconClassName="text-green-700"
        />
        <StatCard
          label="Taxa de conclusão"
          value={`${taxaConclusao}%`}
          Icon={TrendingUp}
          iconClassName={taxaConclusao >= 60 ? "text-green-700" : "text-amber-700"}
        />
        <StatCard
          label="Atrasadas"
          value={atrasadas}
          Icon={AlertTriangle}
          highlight={atrasadas > 0}
        />
        <StatCard
          label="Eventos realizados"
          value={eventosRealizados}
          Icon={CalendarDays}
        />
        <StatCard
          label="Concluídas no mês"
          value={concluidasEsteMes}
          Icon={CheckCircle2}
          iconClassName="text-blue-700"
        />
      </div>

      <section className="flex w-full max-w-7xl flex-col gap-3">
        <h2 className="text-2xl font-semibold text-zinc-900">
          Evolução mensal (demandas)
        </h2>
        <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-7 gap-2">
            <div />
            {evolucao.map((mes) => (
              <div key={mes.label} className="flex flex-col items-center gap-1">
                <div className="flex h-32 w-full items-end justify-center gap-1">
                  <div
                    className="w-4 rounded-t-md bg-blue-600"
                    style={{ height: `${Math.max(4, (mes.criadas / maxEvolucao) * 100)}%` }}
                    title={`Criadas: ${mes.criadas}`}
                    role="img"
                    aria-label={`${mes.label}: ${mes.criadas} criadas`}
                  />
                  <div
                    className="w-4 rounded-t-md bg-green-600"
                    style={{ height: `${Math.max(4, (mes.feitas / maxEvolucao) * 100)}%` }}
                    title={`Concluídas: ${mes.feitas}`}
                    role="img"
                    aria-label={`${mes.label}: ${mes.feitas} concluídas`}
                  />
                </div>
                <span className="text-base text-zinc-700">{mes.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-4 text-base text-zinc-700">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-blue-600" aria-hidden="true" />
              Criadas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-green-600" aria-hidden="true" />
              Concluídas
            </span>
          </div>
        </div>
      </section>

      <div className="grid w-full max-w-7xl grid-cols-1 gap-6 lg:grid-cols-2">
        <BarSection
          title="Tarefas por área"
          rows={areaRows.map((r) => ({
            label: r.area,
            total: r.total,
            feitas: r.feitas,
            max: maxArea,
          }))}
        />

        <BarSection
          title="Tarefas por evento"
          rows={eventoRows.map((r) => ({
            label: r.evento,
            total: r.total,
            feitas: r.feitas,
            max: maxEvento,
          }))}
        />
      </div>

      <section className="flex w-full max-w-7xl flex-col gap-3">
        <h2 className="text-2xl font-semibold text-zinc-900">
          Produtividade por voluntário
        </h2>
        {voluntarioRows.length === 0 ? (
          <p className="text-xl text-zinc-700">
            Nenhuma demanda com responsável cadastrado.
          </p>
        ) : (
          <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            {voluntarioRows.map((row, index) => (
              <div
                key={row.nome}
                className={`flex flex-col gap-1 ${
                  index > 0 ? "border-t border-zinc-200 pt-3" : ""
                } ${index < voluntarioRows.length - 1 ? "pb-3" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-lg font-medium text-zinc-900">
                    {row.nome}
                  </span>
                  <span className="text-base text-zinc-700">
                    {row.feitas}/{row.total} concluídas (
                    {row.total > 0 ? Math.round((row.feitas / row.total) * 100) : 0}%)
                  </span>
                </div>
                <div
                  className="h-4 rounded-full bg-green-600"
                  style={{ width: `${(row.total / maxVoluntario) * 100}%` }}
                  role="img"
                  aria-label={`${row.nome}: ${row.total} demandas, ${row.feitas} concluídas`}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {podeVerFinanceiro && (
        <section className="flex w-full max-w-7xl flex-col gap-3">
          <h2 className="text-2xl font-semibold text-zinc-900">
            Evolução financeira
          </h2>
          <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-7 gap-2">
              <div />
              {financeiroRows.map((mes) => {
                const maxValor = Math.max(1, ...financeiroRows.flatMap((m) => [m.entradas, m.saidas]));
                return (
                  <div key={mes.label} className="flex flex-col items-center gap-1">
                    <div className="flex h-32 w-full items-end justify-center gap-1">
                      <div
                        className="w-4 rounded-t-md bg-green-600"
                        style={{ height: `${Math.max(4, (mes.entradas / maxValor) * 100)}%` }}
                        role="img"
                        aria-label={`${mes.label}: ${brl.format(mes.entradas)} de receita`}
                      />
                      <div
                        className="w-4 rounded-t-md bg-red-600"
                        style={{ height: `${Math.max(4, (mes.saidas / maxValor) * 100)}%` }}
                        role="img"
                        aria-label={`${mes.label}: ${brl.format(mes.saidas)} de despesas`}
                      />
                    </div>
                    <span className="text-base text-zinc-700">{mes.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-4 text-base text-zinc-700">
              <span className="flex items-center gap-1.5">
                <TrendingUp size={18} className="text-green-700" aria-hidden="true" />
                Receita
              </span>
              <span className="flex items-center gap-1.5">
                <TrendingDown size={18} className="text-red-700" aria-hidden="true" />
                Despesa
              </span>
            </div>
          </div>
        </section>
      )}
    </PageContainer>
  );
}

function BarSection({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; total: number; feitas: number; max: number }>;
}) {
  if (rows.length === 0) {
    return (
      <section className="flex w-full flex-col gap-3">
        <h2 className="text-2xl font-semibold text-zinc-900">{title}</h2>
        <p className="text-xl text-zinc-700">Nenhum dado ainda.</p>
      </section>
    );
  }

  return (
    <section className="flex w-full flex-col gap-3">
      <h2 className="text-2xl font-semibold text-zinc-900">{title}</h2>
      <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className={`flex flex-col gap-1 ${
              index > 0 ? "border-t border-zinc-200 pt-3" : ""
            } ${index < rows.length - 1 ? "pb-3" : ""}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-lg font-medium text-zinc-900" title={row.label}>
                {row.label}
              </span>
              <span className="shrink-0 text-base text-zinc-700">
                {row.feitas}/{row.total} concluídas
              </span>
            </div>
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-4 bg-green-600"
                style={{ width: `${(row.total / row.max) * 100}%` }}
                role="img"
                aria-label={`${row.label}: ${row.total} demandas, ${row.feitas} concluídas`}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
