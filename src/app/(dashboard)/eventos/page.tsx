// /eventos — agenda-style event list, full-width like the demandas screen.
// Events are grouped by month with prominent month headers; each event is
// a date-box + card row (classic agenda layout) that links to its
// management screen. "Próximos eventos" is the agenda proper; past events
// collapse into a details block, also grouped by month.
import Link from "next/link";
import {
  CalendarDays,
  MapPin,
  Settings2,
  Tag,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import ImportEventosToggle from "./import-toggle";

type EventoRow = {
  id: number;
  titulo: string;
  descricao: string | null;
  data_evento: string;
  local: string | null;
  tipo_nome: string | null;
};

const WEEKDAY_ABBR = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTH_ABBR = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function monthKey(iso: string): string {
  return format(new Date(`${iso}T00:00:00`), "MM/yyyy", { locale: ptBR });
}

function monthLabel(key: string): string {
  const [month, year] = key.split("/");
  const label = format(
    new Date(Number(year), Number(month) - 1, 1),
    "MMMM 'de' yyyy",
    { locale: ptBR }
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Preserves input order, so ascending data -> chronological month groups
// and descending data -> most-recent month first.
function groupByMonth(rows: EventoRow[]): Array<{ key: string; rows: EventoRow[] }> {
  const groups = new Map<string, EventoRow[]>();
  for (const row of rows) {
    const key = monthKey(row.data_evento);
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }
  return [...groups.entries()].map(([key, items]) => ({ key, rows: items }));
}

export default async function EventosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isCoordenador = profile?.role === "coordenador_geral";

  // RLS (migration 0008): every authenticated volunteer reads every event.
  const [proximosResult, anterioresResult, tiposResult] = await Promise.all([
    supabase
      .from("eventos")
      .select("id, titulo, descricao, data_evento, local, tipo_evento_id")
      .gte("data_evento", today)
      .order("data_evento", { ascending: true })
      .limit(200),
    supabase
      .from("eventos")
      .select("id, titulo, descricao, data_evento, local, tipo_evento_id")
      .lt("data_evento", today)
      .order("data_evento", { ascending: false })
      .limit(50),
    supabase.from("evento_tipos").select("id, nome"),
  ]);

  const tipoNomeById = new Map(
    (tiposResult.data ?? []).map((tipo) => [tipo.id, tipo.nome])
  );

  const toRow = (row: {
    id: number;
    titulo: string;
    descricao: string | null;
    data_evento: string;
    local: string | null;
    tipo_evento_id: number | null;
  }): EventoRow => ({
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    data_evento: row.data_evento,
    local: row.local,
    tipo_nome: row.tipo_evento_id
      ? (tipoNomeById.get(row.tipo_evento_id) ?? null)
      : null,
  });

  const proximos: EventoRow[] = (proximosResult.data ?? []).map(toRow);
  const anteriores: EventoRow[] = (anterioresResult.data ?? []).map(toRow);
  const proximosPorMes = groupByMonth(proximos);
  const anterioresPorMes = groupByMonth(anteriores);
  const mesAtualKey = monthKey(today);

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <CalendarDays size={30} aria-hidden="true" />
            Eventos
          </h1>
          <p className="text-xl text-zinc-500">
            Agenda da instituição — próximos eventos por mês.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isCoordenador && (
            <Link
              href="/eventos/modelos"
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-xl font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            >
              <Settings2 size={22} aria-hidden="true" />
              Modelos
            </Link>
          )}
          <ImportEventosToggle />
        </div>
      </header>

      {proximos.length === 0 && anteriores.length === 0 ? (
        <>
          <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
            <CalendarDays size={48} className="text-zinc-400" aria-hidden="true" />
            <h2 className="text-3xl font-semibold text-zinc-900">
              Nenhum evento cadastrado ainda
            </h2>
            <p className="max-w-md text-xl text-zinc-700">
              Cadastre os eventos pela planilha acima — e lembre que uma
              demanda pode ser vinculada a um evento na hora de criá-la.
            </p>
            <Link
              href="/demandas/nova"
              className="flex min-h-14 items-center justify-center rounded-lg bg-[#2195B9] px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            >
              Criar demanda
            </Link>
          </div>
        </>
      ) : (
        <div className="flex w-full flex-col gap-10">
          <section className="flex w-full flex-col gap-8" aria-label="Próximos eventos">
            {proximos.length === 0 ? (
              <p className="rounded-2xl bg-white px-5 py-4 text-xl text-zinc-700 ring-1 ring-zinc-200/60">
                Nenhum evento futuro cadastrado.
              </p>
            ) : (
              proximosPorMes.map((group) => (
                <MonthSection
                  key={group.key}
                  label={monthLabel(group.key)}
                  count={group.rows.length}
                  isCurrentMonth={group.key === mesAtualKey}
                >
                  {group.rows.map((evento) => (
                    <AgendaRow key={evento.id} evento={evento} today={today} />
                  ))}
                </MonthSection>
              ))
            )}
          </section>

          {anteriores.length > 0 && (
            <details className="group w-full">
              <summary className="flex min-h-14 w-full cursor-pointer list-none items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4 ring-1 ring-zinc-200/60 marker:hidden transition-colors hover:ring-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] [&::-webkit-details-marker]:hidden">
                <span className="text-2xl font-semibold text-zinc-900">
                  Eventos anteriores ({anteriores.length})
                </span>
                <ChevronDown
                  size={24}
                  aria-hidden="true"
                  className="text-zinc-500 transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <div className="mt-6 flex w-full flex-col gap-8">
                {anterioresPorMes.map((group) => (
                  <MonthSection
                    key={group.key}
                    label={monthLabel(group.key)}
                    count={group.rows.length}
                    isCurrentMonth={false}
                  >
                    {group.rows.map((evento) => (
                      <AgendaRow key={evento.id} evento={evento} today={today} />
                    ))}
                  </MonthSection>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </PageContainer>
  );
}

function MonthSection({
  label,
  count,
  isCurrentMonth,
  children,
}: {
  label: string;
  count: number;
  isCurrentMonth: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="h-8 w-1.5 rounded-full bg-[#2195B9]" aria-hidden="true" />
        <h2 className="text-2xl font-semibold text-zinc-900 sm:text-3xl">
          {label}
        </h2>
        <span className="rounded-full bg-[#E6E6E6] px-3 py-1 text-base font-medium text-[#28627B]">
          {count} {count === 1 ? "evento" : "eventos"}
        </span>
        {isCurrentMonth && (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-base text-zinc-600">
            Este mês
          </span>
        )}
      </div>
      <div className="flex w-full flex-col gap-3">
        {children}
      </div>
    </div>
  );
}

// One agenda entry — a date box (weekday / day / month) beside the event
// card. The box highlights today; the card links to the management screen.
function AgendaRow({ evento, today }: { evento: EventoRow; today: string }) {
  const date = new Date(`${evento.data_evento}T00:00:00`);
  const isToday = evento.data_evento === today;

  return (
    <article className="flex items-stretch gap-3 sm:gap-4">
      <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 self-stretch rounded-2xl bg-white px-2 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60 sm:w-20">
        <span className="text-sm font-medium uppercase text-zinc-500">
          {WEEKDAY_ABBR[date.getDay()]}
        </span>
        <span
          className={`text-2xl font-semibold sm:text-3xl ${
            isToday ? "text-[#2195B9]" : "text-zinc-900"
          }`}
        >
          {date.getDate()}
        </span>
        <span className="text-base font-medium text-zinc-500">
          {MONTH_ABBR[date.getMonth()]}
        </span>
        {isToday && (
          <span className="mt-1 rounded-full bg-[#2195B9] px-2 py-0.5 text-sm font-semibold text-white">
            Hoje
          </span>
        )}
      </div>

      <Link
        href={`/eventos/${evento.id}`}
        className="flex min-w-0 flex-1 flex-col gap-2 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60 transition-all duration-200 hover:shadow-[0_2px_6px_rgba(0,0,0,0.06)] hover:ring-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="min-w-0 text-xl font-semibold text-zinc-900">
            {evento.titulo}
          </h3>
          {evento.tipo_nome && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-base font-medium text-purple-800 ring-1 ring-purple-200/60">
              <Tag size={14} aria-hidden="true" />
              {evento.tipo_nome}
            </span>
          )}
        </div>
        {evento.local && (
          <p className="flex items-center gap-1.5 text-base text-zinc-600">
            <MapPin size={16} aria-hidden="true" />
            {evento.local}
          </p>
        )}
        {evento.descricao && (
          <p className="line-clamp-2 text-base leading-relaxed text-zinc-600">
            {evento.descricao}
          </p>
        )}
        <span className="mt-auto pt-1 text-base font-medium text-[#2195B9] underline decoration-[#2195B9]/40 underline-offset-4">
          Gerenciar evento
        </span>
      </Link>
    </article>
  );
}
