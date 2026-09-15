"use client";

// Lista de eventos com busca por texto. Os eventos vêm prontos do servidor
// (eventos/page.tsx) e o filtro é aplicado no cliente, preservando o
// agrupamento mês a mês. Sem termo de busca, o layout é o de antes:
// próximos eventos em aberto + "Eventos anteriores" recolhidos.
//
// Seleção em massa: o botão "Selecionar" ativa checkboxes em cada linha;
// a barra de ações permite editar (local, data, tipo, descrição) ou
// excluir os selecionados via excluir/editarEventosEmMassa (RLS 0008:
// criador ou coordenador_geral).
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  GitMerge,
  MapPin,
  Search,
  Tag,
  X,
  ListChecks,
  Pencil,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateInput } from "@/components/ui/date-input";
import {
  editarEventosEmMassa,
  excluirEventosEmMassa,
} from "./actions";

export type EventoRow = {
  id: number;
  titulo: string;
  descricao: string | null;
  data_evento: string;
  local: string | null;
  tipo_nome: string | null;
};

export type EventoTipoOpcao = { id: number; nome: string };

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
    .replace(/[̀-ͯ]/g, "");
}

export default function EventosLista({
  proximos,
  anteriores,
  today,
  tipos = [],
}: {
  proximos: EventoRow[];
  anteriores: EventoRow[];
  today: string;
  tipos?: EventoTipoOpcao[];
}) {
  const router = useRouter();
  const [termo, setTermo] = useState("");
  const termoLimpo = termo.trim();

  const [selecionando, setSelecionando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [painel, setPainel] = useState<"editar" | "excluir" | null>(null);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const [executando, setExecutando] = useState(false);
  const [, startTransition] = useTransition();

  // Campos da edição em massa — cada campo só é aplicado se o toggle estiver ligado.
  const [usarLocal, setUsarLocal] = useState(false);
  const [usarData, setUsarData] = useState(false);
  const [usarTipo, setUsarTipo] = useState(false);
  const [usarDescricao, setUsarDescricao] = useState(false);
  const [novoLocal, setNovoLocal] = useState("");
  const [novaData, setNovaData] = useState("");
  const [novoTipo, setNovoTipo] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");

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
  const todosVisiveis = useMemo(() => {
    if (resultados) return resultados.flatMap((g) => g.rows);
    return [...proximos, ...anteriores];
  }, [resultados, proximos, anteriores]);

  const todosIds = useMemo(() => todosVisiveis.map((e) => e.id), [todosVisiveis]);
  const todosMarcados = todosIds.length > 0 && todosIds.every((id) => selecionados.has(id));

  function toggleUm(id: number, checked: boolean) {
    setSelecionados((atual) => {
      const prox = new Set(atual);
      if (checked) prox.add(id);
      else prox.delete(id);
      return prox;
    });
  }

  function alternarTodos() {
    setSelecionados((atual) => {
      const todosSelecionadosAgora = todosIds.every((id) => atual.has(id));
      return todosSelecionadosAgora ? new Set() : new Set(todosIds);
    });
  }

  function sairSelecao() {
    setSelecionando(false);
    setSelecionados(new Set());
    setPainel(null);
    setMensagem(null);
  }

  async function executarExclusao() {
    setExecutando(true);
    setMensagem(null);
    const r = await excluirEventosEmMassa([...selecionados]);
    setExecutando(false);
    setMensagem({ ok: r.ok, texto: r.message });
    if (r.ok) {
      setSelecionados(new Set());
      setPainel(null);
      startTransition(() => router.refresh());
    }
  }

  async function executarEdicao() {
    const campos: { local?: string; descricao?: string; data_evento?: string; tipo_evento_id?: number | null } = {};
    if (usarLocal) campos.local = novoLocal.trim();
    if (usarDescricao) campos.descricao = novaDescricao.trim();
    if (usarData) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(novaData)) {
        setMensagem({ ok: false, texto: "Escolha uma data válida para aplicar." });
        return;
      }
      campos.data_evento = novaData;
    }
    if (usarTipo) {
      if (novoTipo === "__remover__") campos.tipo_evento_id = null;
      else if (novoTipo) campos.tipo_evento_id = Number(novoTipo);
      else {
        setMensagem({ ok: false, texto: "Escolha um tipo para aplicar." });
        return;
      }
    }
    if (Object.keys(campos).length === 0) {
      setMensagem({ ok: false, texto: "Marque ao menos um campo para alterar." });
      return;
    }
    setExecutando(true);
    setMensagem(null);
    const r = await editarEventosEmMassa([...selecionados], campos);
    setExecutando(false);
    setMensagem({ ok: r.ok, texto: r.message });
    if (r.ok) {
      setPainel(null);
      startTransition(() => router.refresh());
    }
  }

  const rowProps = (id: number) => ({
    selecionavel: selecionando,
    checked: selecionados.has(id),
    onToggle: (checked: boolean) => toggleUm(id, checked),
  });

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex w-full flex-col gap-3">
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

        <div className="flex flex-wrap items-center gap-2">
          {!selecionando ? (
            <button
              type="button"
              onClick={() => setSelecionando(true)}
              className="flex min-h-12 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-lg font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            >
              <ListChecks size={20} aria-hidden="true" />
              Selecionar eventos
            </button>
          ) : (
            <>
              <span
                aria-live="polite"
                className="rounded-full bg-[#2195B9]/10 px-3 py-1 text-base font-semibold text-[#28627B] ring-1 ring-[#2195B9]/30"
              >
                {selecionados.size} selecionado{selecionados.size === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={alternarTodos}
                className="flex min-h-11 items-center rounded-xl border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                {todosMarcados ? "Desmarcar todos" : "Selecionar todos"}
              </button>
              <button
                type="button"
                disabled={selecionados.size === 0}
                onClick={() => {
                  setPainel("editar");
                  setMensagem(null);
                }}
                className="flex min-h-11 items-center gap-1.5 rounded-xl bg-[#2195B9] px-4 text-base font-semibold text-white transition-colors hover:bg-[#28627B] disabled:opacity-50"
              >
                <Pencil size={17} aria-hidden="true" />
                Editar ({selecionados.size})
              </button>
              <button
                type="button"
                disabled={selecionados.size === 0}
                onClick={() => {
                  setPainel("excluir");
                  setMensagem(null);
                }}
                className="flex min-h-11 items-center gap-1.5 rounded-xl bg-red-700 px-4 text-base font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                <Trash2 size={17} aria-hidden="true" />
                Excluir ({selecionados.size})
              </button>
              <button
                type="button"
                disabled={selecionados.size < 2}
                onClick={() =>
                  document
                    .getElementById("mesclar-eventos")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                title={
                  selecionados.size < 2
                    ? "Selecione ao menos 2 eventos para mesclar"
                    : "Ir à seção Mesclar com os eventos visíveis"
                }
                className="flex min-h-11 items-center gap-1.5 rounded-xl border border-green-700/40 bg-white px-4 text-base font-semibold text-green-800 transition-colors hover:bg-green-50 disabled:opacity-50"
              >
                <GitMerge size={17} aria-hidden="true" />
                Mesclar
              </button>
              <button
                type="button"
                onClick={sairSelecao}
                className="rounded-xl px-3 py-2 text-base text-zinc-600 transition-colors hover:text-zinc-900"
              >
                Cancelar
              </button>
            </>
          )}
        </div>

        {mensagem && (
          <p
            aria-live="polite"
            className={`text-base ${mensagem.ok ? "text-green-800" : "text-red-700"}`}
          >
            {mensagem.texto}
          </p>
        )}

        {selecionando && painel === "editar" && (
          <div className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-[#2195B9]/40">
            <h2 className="text-xl font-semibold text-zinc-900">
              Editar {selecionados.size} evento{selecionados.size === 1 ? "" : "s"} — só os campos marcados são alterados
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 rounded-xl border border-zinc-200 p-3">
                <span className="flex items-center gap-2 text-base font-medium text-zinc-900">
                  <input
                    type="checkbox"
                    checked={usarLocal}
                    onChange={(e) => setUsarLocal(e.target.checked)}
                    className="h-5 w-5 accent-[#2195B9]"
                  />
                  Local
                </span>
                <input
                  value={novoLocal}
                  onChange={(e) => setNovoLocal(e.target.value)}
                  disabled={!usarLocal}
                  placeholder="Ex: ECTOLAB (vazio limpa)"
                  className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900 disabled:opacity-50"
                />
              </label>
              <label className="flex flex-col gap-1.5 rounded-xl border border-zinc-200 p-3">
                <span className="flex items-center gap-2 text-base font-medium text-zinc-900">
                  <input
                    type="checkbox"
                    checked={usarData}
                    onChange={(e) => setUsarData(e.target.checked)}
                    className="h-5 w-5 accent-[#2195B9]"
                  />
                  Data
                </span>
                <DateInput
                  value={novaData}
                  onChange={(e) => setNovaData(e.target.value)}
                  disabled={!usarData}
                  className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900 disabled:opacity-50"
                />
              </label>
              <label className="flex flex-col gap-1.5 rounded-xl border border-zinc-200 p-3">
                <span className="flex items-center gap-2 text-base font-medium text-zinc-900">
                  <input
                    type="checkbox"
                    checked={usarTipo}
                    onChange={(e) => setUsarTipo(e.target.checked)}
                    className="h-5 w-5 accent-[#2195B9]"
                  />
                  Tipo
                </span>
                <select
                  value={novoTipo}
                  onChange={(e) => setNovoTipo(e.target.value)}
                  disabled={!usarTipo}
                  className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900 disabled:opacity-50"
                >
                  <option value="">Escolher tipo...</option>
                  {tipos.map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      {t.nome}
                    </option>
                  ))}
                  <option value="__remover__">Remover vínculo</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 rounded-xl border border-zinc-200 p-3 sm:col-span-2">
                <span className="flex items-center gap-2 text-base font-medium text-zinc-900">
                  <input
                    type="checkbox"
                    checked={usarDescricao}
                    onChange={(e) => setUsarDescricao(e.target.checked)}
                    className="h-5 w-5 accent-[#2195B9]"
                  />
                  Descrição
                </span>
                <textarea
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  disabled={!usarDescricao}
                  rows={2}
                  placeholder="Nova descrição (vazio limpa)"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 disabled:opacity-50"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={executarEdicao}
                disabled={executando || selecionados.size === 0}
                className="flex min-h-12 items-center gap-1.5 rounded-xl bg-[#2195B9] px-5 text-base font-semibold text-white transition-colors hover:bg-[#28627B] disabled:opacity-60"
              >
                {executando ? "Salvando..." : `Aplicar aos ${selecionados.size}`}
              </button>
              <button
                type="button"
                onClick={() => setPainel(null)}
                className="rounded-xl px-3 py-2 text-base text-zinc-600 transition-colors hover:text-zinc-900"
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        {selecionando && painel === "excluir" && (
          <div className="flex w-full flex-col gap-2 rounded-2xl bg-red-50 p-5 ring-1 ring-red-200/70">
            <h2 className="text-xl font-semibold text-red-900">
              Excluir {selecionados.size} evento{selecionados.size === 1 ? "" : "s"}?
            </h2>
            <p className="text-base text-red-800">
              Essa ação não pode ser desfeita. Demandas vinculadas perdem o vínculo; mesclagens e contratos seguem as regras da tela do evento.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={executarExclusao}
                disabled={executando || selecionados.size === 0}
                className="flex min-h-12 items-center gap-1.5 rounded-xl bg-red-700 px-5 text-base font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-60"
              >
                <Trash2 size={17} aria-hidden="true" />
                {executando ? "Excluindo..." : `Confirmar exclusão (${selecionados.size})`}
              </button>
              <button
                type="button"
                onClick={() => setPainel(null)}
                className="rounded-xl px-3 py-2 text-base text-zinc-600 transition-colors hover:text-zinc-900"
              >
                Voltar
              </button>
            </div>
          </div>
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
                  <AgendaRow key={evento.id} evento={evento} today={today} {...rowProps(evento.id)} />
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
                    <AgendaRow key={evento.id} evento={evento} today={today} {...rowProps(evento.id)} />
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
                      <AgendaRow key={evento.id} evento={evento} today={today} {...rowProps(evento.id)} />
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
// Em modo seleção o card vira um label com checkbox e o link vira texto.
function AgendaRow({
  evento,
  today,
  selecionavel = false,
  checked = false,
  onToggle,
}: {
  evento: EventoRow;
  today: string;
  selecionavel?: boolean;
  checked?: boolean;
  onToggle?: (checked: boolean) => void;
}) {
  const date = new Date(`${evento.data_evento}T00:00:00`);
  const isToday = evento.data_evento === today;

  const conteudo = (
    <>
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
      {!selecionavel && (
        <span className="mt-auto pt-1 text-base font-medium text-[#2195B9] underline decoration-[#2195B9]/40 underline-offset-4">
          Gerenciar evento
        </span>
      )}
    </>
  );

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

      {selecionavel ? (
        <label
          className={`flex min-w-0 flex-1 cursor-pointer flex-col gap-2 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 transition-all duration-200 hover:ring-zinc-300 sm:p-5 ${
            checked ? "ring-2 ring-[#2195B9]" : "ring-zinc-200/60"
          }`}
        >
          <span className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onToggle?.(e.target.checked)}
              aria-label={`Selecionar ${evento.titulo}`}
              className="mt-1 h-6 w-6 shrink-0 accent-[#2195B9]"
            />
            <span className="flex min-w-0 flex-1 flex-col gap-2">{conteudo}</span>
          </span>
        </label>
      ) : (
        <Link
          href={`/eventos/${evento.id}`}
          className="flex min-w-0 flex-1 flex-col gap-2 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60 transition-all duration-200 hover:shadow-[0_2px_6px_rgba(0,0,0,0.06)] hover:ring-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] sm:p-5"
        >
          {conteudo}
        </Link>
      )}
    </article>
  );
}
