"use client";

// Lista de eventos com busca por texto. Os eventos vêm prontos do servidor
// (eventos/page.tsx) e o filtro é aplicado no cliente, preservando o
// agrupamento mês a mês. Sem termo de busca, o layout é o de antes:
// próximos eventos em aberto + "Eventos anteriores" recolhidos.
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, MapPin, Search, Tag, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type EventoRow = {
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

// Ignora acentos e caixa ao buscar.
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function EventosLista({
  proximos,
  anteriores,
  today,
}: {
  proximos: EventoRow[];
  anteriores: EventoRow[];
  today: string;
}) {
  const [termo, setTermo] = useState("");
  const termoLimpo = termo.trim();

  const resultados = useMemo(() => {
    if (!termoLimpo) {
      return null;
    }
    const alvo = normalizar(termoLimpo);
    const todos = [...proximos, ...anteriores].filter((e) =>
      [e.titulo, e.local ?? "", e.descricao ?? "", e.tipo_nome ?? ""].some((c) =>
        normalizar(c).includes(alvo)
      )
    );
    todos.sort((a, b) => (a.data_evento < b.data_evento ? 1 : -1));
    return groupByMonth(todos);
  }, [termoLimpo, proximos, anteriores]);

  const mesAtualKey = monthKey(today);

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="relative w-full">
        <Search
          size={22}
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <input
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar evento por título, local ou descrição..."
          aria-label="Buscar evento"
          className="min-h-14 w-full rounded-2xl bg-white pl-12 pr-12 text-xl text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60 transition-shadow placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#2195B9]"
        />
        {termo && (
          <button
            type="button"
            onClick={() => setTermo("")}
            aria-label="Limpar busca"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      {resultados ? (
        <section
          className="flex w-full flex-col gap-8"
          aria-label="Resultados da busca"
        >
          {resultados.length === 0 ? (
            <p className="rounded-2xl bg-white px-5 py-4 text-xl text-zinc-700 ring-1 ring-zinc-200/60">
              Nenhum evento encontrado para “{termoLimpo}”.
            </p>
          ) : (
            resultados.map((group) => (
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
      ) : (
        <>
          <section
            className="flex w-full flex-col gap-8"
            aria-label="Próximos eventos"
          >
            {proximos.length === 0 ? (
              <p className="rounded-2xl bg-white px-5 py-4 text-xl text-zinc-700 ring-1 ring-zinc-200/60">
                Nenhum evento futuro cadastrado.
              </p>
            ) : (
              groupByMonth(proximos).map((group) => (
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
              <summary className="flex min-h-14 w-full cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4 ring-1 ring-zinc-200/60 marker:hidden transition-colors hover:ring-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] [&::-webkit-details-marker]:hidden">
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
                {groupByMonth(anteriores).map((group) => (
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
        </>
      )}
    </div>
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
      <div className="flex flex-wrap items-center gap-3">
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
