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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileResult, demandasResult, eventosResult, linksResult, financeiroResult] =
    await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase.from("demandas_com_status")
        .select("id, titulo, status, area, atrasada, criado_por, created_at, concluida_em, evento_id"),
      supabase.from("eventos").select("id, titulo, data_evento"),
      supabase.from("demanda_responsaveis")
        .select("demanda_id, profile_id, profiles(email, full_name)"),
      supabase.from("financial_entries").select("tipo, valor, data"),
    ]);

  const role = profileResult.data?.role;
  const podeVerFinanceiro = role === "coordenador_geral" || role === "financeiro";
  const demandas = (demandasResult.data ?? []) as DemandaRow[];
  const eventos = eventosResult.data ?? [];
  const links = linksResult.data ?? [];
  const eventoById = new Map(eventos.map((e) => [e.id, e.titulo]));
  const hoje = new Date();

  const total = demandas.length;
  const concluidas = demandas.filter((d) => d.status === "concluida").length;
  const atrasadas = demandas.filter((d) => d.atrasada).length;
  const taxaConclusao = total > 0 ? Math.round((concluidas / total) * 100) : 0;
  const eventosRealizados = eventos.filter(
    (e) => new Date(`${e.data_evento}T00:00:00`) < hoje
  ).length;

  const inicioMes = startOfMonth(hoje);
  const fimMes = endOfMonth(hoje);
  const concluidasEsteMes = demandas.filter((d) => {
    if (!d.concluida_em) return false;
    const data = new Date(d.concluida_em);
    return data >= inicioMes && data <= fimMes;
  }).length;

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
    return { label: format(mes, "MMM/yy", { locale: ptBR }), criadas, feitas };
  });
  const maxEvolucao = Math.max(1, ...evolucao.map((m) => Math.max(m.criadas, m.feitas)));

  const porArea = new Map<string, { total: number; feitas: number }>();
  for (const d of demandas) {
    const key = d.area?.trim() || "Sem area definida";
    const current = porArea.get(key) ?? { total: 0, feitas: 0 };
    current.total += 1;
    if (d.status === "concluida") current.feitas += 1;
    porArea.set(key, current);
  }
  const areaRows = [...porArea.entries()]
    .map(([area, counts]) => ({ area, ...counts }))
    .sort((a, b) => b.total - a.total);
  const maxArea = Math.max(1, ...areaRows.map((r) => r.total));

  const porEvento = new Map<number, { total: number; feitas: number }>();
  for (const d of demandas) {
    if (!d.evento_id) continue;
    const current = porEvento.get(d.evento_id) ?? { total: 0, feitas: 0 };
    current.total += 1;
    if (d.status === "concluida") current.feitas += 1;
    porEvento.set(d.evento_id, current);
  }
  const eventoRows = [...porEvento.entries()]
    .map(([id, counts]) => ({ evento: eventoById.get(id) ?? "Evento removido", ...counts }))
    .sort((a, b) => b.total - a.total);
  const maxEvento = Math.max(1, ...eventoRows.map((r) => r.total));

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

  const financeiroRows = podeVerFinanceiro
    ? meses.map((mes) => {
        const inicio = startOfMonth(mes);
        const fim = endOfMonth(mes);
        let entradas = 0;
        let saidas = 0;
        for (const entry of (financeiroResult.data ?? []) as Array<{ tipo: string; valor: number; data: string }>) {
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
      <div className="flex w-full flex-col gap-2">
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-[0_2px_8px_rgba(37,99,235,0.25)]">
            <BarChart3 size={20} className="text-white" aria-hidden="true" strokeWidth={1.75} />
          </div>
          Analise
        </h1>
        <p className="text-sm text-slate-500">Metricas de produtividade e evolucao da instituicao.</p>
      </div>

      <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label="Demandas" value={total} Icon={ClipboardList} />
        <StatCard label="Concluidas" value={concluidas} Icon={CheckCircle2} iconClassName="text-green-600" />
        <StatCard label="Taxa de conclusao" value={`${taxaConclusao}%`} Icon={TrendingUp} iconClassName={taxaConclusao >= 60 ? "text-green-600" : "text-amber-600"} />
        <StatCard label="Atrasadas" value={atrasadas} Icon={AlertTriangle} highlight={atrasadas > 0} />
        <StatCard label="Eventos" value={eventosRealizados} Icon={CalendarDays} />
        <StatCard label="Concluidas no mes" value={concluidasEsteMes} Icon={CheckCircle2} iconClassName="text-blue-600" />
      </div>

      <section className="flex w-full flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Evolucao mensal de demandas</h2>
        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60">
          <div className="grid grid-cols-7 gap-2">
            <div />
            {evolucao.map((mes) => (
              <div key={mes.label} className="flex flex-col items-center gap-1.5">
                <div className="flex h-28 w-full items-end justify-center gap-1">
                  <div className="w-3.5 rounded-t-md bg-blue-500" style={{ height: `${Math.max(4, (mes.criadas / maxEvolucao) * 100)}%` }} title={`Criadas: ${mes.criadas}`} role="img" aria-label={`${mes.label}: ${mes.criadas} criadas`} />
                  <div className="w-3.5 rounded-t-md bg-emerald-500" style={{ height: `${Math.max(4, (mes.feitas / maxEvolucao) * 100)}%` }} title={`Concluidas: ${mes.feitas}`} role="img" aria-label={`${mes.label}: ${mes.feitas} concluidas`} />
                </div>
                <span className="text-xs font-medium text-slate-500">{mes.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" aria-hidden="true" /> Criadas</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden="true" /> Concluidas</span>
          </div>
        </div>
      </section>

      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
        <BarSection title="Tarefas por area" rows={areaRows.map((r) => ({ label: r.area, total: r.total, feitas: r.feitas, max: maxArea }))} />
        <BarSection title="Tarefas por evento" rows={eventoRows.map((r) => ({ label: r.evento, total: r.total, feitas: r.feitas, max: maxEvento }))} />
      </div>

      <section className="flex w-full flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Produtividade por voluntario</h2>
        {voluntarioRows.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma demanda com responsavel cadastrado.</p>
        ) : (
          <div className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60">
            {voluntarioRows.map((row, index) => (
              <div key={row.nome} className={`flex flex-col gap-1.5 ${index > 0 ? "border-t border-slate-100 pt-3" : ""} ${index < voluntarioRows.length - 1 ? "pb-3" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-900">{row.nome}</span>
                  <span className="text-xs text-slate-500">{row.feitas}/{row.total} concluidas ({row.total > 0 ? Math.round((row.feitas / row.total) * 100) : 0}%)</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500" style={{ width: `${(row.total / maxVoluntario) * 100}%` }} role="img" aria-label={`${row.nome}: ${row.total} demandas, ${row.feitas} concluidas`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {podeVerFinanceiro && (
        <section className="flex w-full flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Evolucao financeira</h2>
          <div className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60">
            <div className="grid grid-cols-7 gap-2">
              <div />
              {financeiroRows.map((mes) => {
                const maxValor = Math.max(1, ...financeiroRows.flatMap((m) => [m.entradas, m.saidas]));
                return (
                  <div key={mes.label} className="flex flex-col items-center gap-1.5">
                    <div className="flex h-28 w-full items-end justify-center gap-1">
                      <div className="w-3.5 rounded-t-md bg-emerald-500" style={{ height: `${Math.max(4, (mes.entradas / maxValor) * 100)}%` }} role="img" aria-label={`${mes.label}: ${brl.format(mes.entradas)} de receita`} />
                      <div className="w-3.5 rounded-t-md bg-red-500" style={{ height: `${Math.max(4, (mes.saidas / maxValor) * 100)}%` }} role="img" aria-label={`${mes.label}: ${brl.format(mes.saidas)} de despesas`} />
                    </div>
                    <span className="text-xs font-medium text-slate-500">{mes.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><TrendingUp size={16} className="text-emerald-600" aria-hidden="true" /> Receita</span>
              <span className="flex items-center gap-1.5"><TrendingDown size={16} className="text-red-600" aria-hidden="true" /> Despesa</span>
            </div>
          </div>
        </section>
      )}
    </PageContainer>
  );
}

function BarSection({ title, rows }: { title: string; rows: Array<{ label: string; total: number; feitas: number; max: number }> }) {
  if (rows.length === 0) {
    return (
      <section className="flex w-full flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">Nenhum dado ainda.</p>
      </section>
    );
  }
  return (
    <section className="flex w-full flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
      <div className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60">
        {rows.map((row, index) => (
          <div key={row.label} className={`flex flex-col gap-1.5 ${index > 0 ? "border-t border-slate-100 pt-3" : ""} ${index < rows.length - 1 ? "pb-3" : ""}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-slate-900" title={row.label}>{row.label}</span>
              <span className="shrink-0 text-xs text-slate-500">{row.feitas}/{row.total} concluidas</span>
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500" style={{ width: `${(row.total / row.max) * 100}%` }} role="img" aria-label={`${row.label}: ${row.total} demandas, ${row.feitas} concluidas`} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
