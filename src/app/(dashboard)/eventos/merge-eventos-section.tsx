"use client";

// Merge de eventos duplicados (migration 0046) — a análise automática de
// atas pode extrair o mesmo evento em várias atas; o coordenador escolhe
// o evento definitivo e os duplicados a absorver (um ou vários). Cada
// duplicado tem suas referências (demandas, contratos, turmas PROEP)
// movidas para o definitivo e é removido. Visível apenas para
// coordenador_geral.
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GitMerge, Merge, Search } from "lucide-react";
import { mesclarEventosEmMassa } from "./actions";
import { FormSelect } from "@/components/ui/form-select";
import { SelectGroup, SelectItem, SelectLabel } from "@/components/ui/select";
import { agruparEventosPorMes } from "@/lib/contratos/eventos-por-mes";
import { hojeBRTISO } from "@/lib/proxima-reuniao";

export type EventoMergeOpcao = {
  id: number;
  titulo: string;
  data_evento: string;
  local: string | null;
};

function rotuloEvento(e: EventoMergeOpcao): string {
  const [ano, mes, dia] = e.data_evento.slice(0, 10).split("-");
  const data = e.data_evento ? `${dia}/${mes}/${ano}` : "Sem data";
  return `${data} — ${e.titulo.trim().replace(/\s+/g, " ")}`;
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function semelhanca(a: string, b: string): number {
  const palavras = (texto: string) => new Set(normalizar(texto).match(/[a-z0-9]+/g)?.filter(
    (palavra) => !["a", "o", "as", "os", "de", "da", "do", "das", "dos", "em", "e", "para", "com", "curso", "aula", "evento"].includes(palavra)
  ));
  const primeira = palavras(a);
  const segunda = palavras(b);
  const comuns = [...primeira].filter((palavra) => segunda.has(palavra)).length;
  return primeira.size + segunda.size ? (2 * comuns) / (primeira.size + segunda.size) : 0;
}

export default function MergeEventosSection({
  eventos,
}: {
  eventos: EventoMergeOpcao[];
}) {
  const router = useRouter();
  const [manterId, setManterId] = useState("");
  const [removerIds, setRemoverIds] = useState<Set<number>>(new Set());
  const [busca, setBusca] = useState("");
  const [buscaDefinitivo, setBuscaDefinitivo] = useState("");
  const [mes, setMes] = useState(() => hojeBRTISO().slice(0, 7));
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const [executando, setExecutando] = useState(false);
  const [, startTransition] = useTransition();

  const mesAtual = hojeBRTISO().slice(0, 7);
  const meses = useMemo(() => agruparEventosPorMes([
    ...eventos,
    { id: -1, titulo: "", data_evento: `${mesAtual}-01`, local: null },
  ]), [eventos, mesAtual]);
  const definitivo = eventos.find((evento) => String(evento.id) === manterId);
  const grupos = useMemo(() => {
    const termos = normalizar(buscaDefinitivo).trim().split(/\s+/).filter(Boolean);
    return agruparEventosPorMes(eventos.filter((evento) =>
      String(evento.id) === manterId || (termos.length
        ? termos.every((termo) => normalizar(`${rotuloEvento(evento)} ${evento.local ?? ""}`).includes(termo))
        : mes === "todos" || evento.data_evento.startsWith(mes))
    ));
  }, [eventos, mes, buscaDefinitivo, manterId]);

  const buscaLimpa = busca.trim();
  const candidatos = useMemo(() => {
    if (!definitivo) return [];
    const semDefinitivo = eventos.filter((e) => e.id !== definitivo.id);
    const alvo = normalizar(buscaLimpa);
    return semDefinitivo.filter((e) =>
      buscaLimpa
        ? normalizar(`${rotuloEvento(e)} ${e.local ?? ""} ${e.data_evento}`).includes(alvo)
        : mostrarTodos || semelhanca(definitivo.titulo, e.titulo) >= 0.5
    ).sort((a, b) => {
      const porNome = semelhanca(definitivo.titulo, b.titulo) - semelhanca(definitivo.titulo, a.titulo);
      if (porNome) return porNome;
      const distancia = (evento: EventoMergeOpcao) => evento.data_evento
        ? Math.abs(Date.parse(evento.data_evento) - Date.parse(definitivo.data_evento))
        : Infinity;
      return distancia(a) - distancia(b) || a.titulo.localeCompare(b.titulo, "pt-BR");
    });
  }, [eventos, definitivo, buscaLimpa, mostrarTodos]);

  const todosFiltradosMarcados =
    candidatos.length > 0 && candidatos.every((e) => removerIds.has(e.id));

  function toggleRemover(id: number, checked: boolean) {
    setRemoverIds((atual) => {
      const prox = new Set(atual);
      if (checked) prox.add(id);
      else prox.delete(id);
      return prox;
    });
  }

  function alternarFiltrados() {
    setRemoverIds((atual) => {
      const prox = new Set(atual);
      if (todosFiltradosMarcados) {
        for (const e of candidatos) prox.delete(e.id);
      } else {
        for (const e of candidatos) prox.add(e.id);
      }
      return prox;
    });
  }

  // Cada definitivo inicia uma nova seleção de duplicados.
  function aoTrocarDefinitivo(valor: string) {
    setManterId(valor);
    setRemoverIds(new Set());
    setBusca("");
    setMostrarTodos(false);
  }

  async function executar() {
    setExecutando(true);
    setMensagem(null);
    const r = await mesclarEventosEmMassa(Number(manterId), [...removerIds]);
    setExecutando(false);
    setMensagem({ ok: r.ok, texto: r.message });
    if ((r.mesclados ?? 0) > 0) {
      setRemoverIds(new Set());
      startTransition(() => router.refresh());
    }
  }

  const podeExecutar =
    manterId && removerIds.size > 0 && !executando;

  return (
    <section
      id="mesclar-eventos"
      className="flex w-full scroll-mt-6 flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="h-8 w-1.5 rounded-full bg-green-600" aria-hidden="true" />
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <GitMerge size={22} aria-hidden="true" className="text-green-600" />
          Mesclar eventos duplicados
        </h2>
        {removerIds.size > 0 && (
          <span className="rounded-full bg-green-50 px-3 py-1 text-base font-semibold text-green-800 ring-1 ring-green-200/60">
            {removerIds.size} duplicado{removerIds.size === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <p className="text-base text-zinc-500">
        Junta eventos repetidos (ex.: o mesmo evento extraído em várias atas)
        num único definitivo. As demandas, contratos e turmas PROEP dos
        duplicados são movidas para o definitivo e os duplicados são removidos.
      </p>

      <div className="flex flex-col gap-1.5">
        <span className="text-lg font-medium text-zinc-900">1. Escolha o evento que fica</span>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            type="search"
            value={buscaDefinitivo}
            onChange={(e) => setBuscaDefinitivo(e.target.value)}
            aria-label="Buscar evento definitivo pelo nome"
            placeholder="Digite o nome do curso ou atividade..."
            className="min-h-12 rounded-xl border border-zinc-200 px-4 text-base focus:outline-none focus:ring-2 focus:ring-green-600/25"
          />
          <select aria-label="Mês do evento definitivo" value={mes} onChange={(e) => { setMes(e.target.value); setBuscaDefinitivo(""); }} className="min-h-12 rounded-xl border border-zinc-200 bg-white px-3 text-base">
            <option value="todos">Todos os meses</option>
            {meses.map((grupo) => <option key={grupo.chave} value={grupo.chave}>{grupo.label}{grupo.chave === mesAtual ? " (mês vigente)" : ""}</option>)}
          </select>
        </div>
        <p className="text-sm text-zinc-500">{buscaDefinitivo.trim() ? "Busca pelo nome em todos os meses." : "Mostrando o mês escolhido. Você pode trocar o mês ou buscar pelo nome."}</p>
        <FormSelect
          value={manterId}
          onValueChange={aoTrocarDefinitivo}
          placeholder="Escolha o evento que fica"
          ariaLabel="Escolha o evento definitivo"
          className="text-left data-[size=default]:h-auto [&_[data-slot=select-value]]:line-clamp-none [&_[data-slot=select-value]]:whitespace-normal"
        >
          {grupos.map((grupo) => (
            <SelectGroup key={grupo.chave} className="max-w-[calc(100vw-2rem)]">
              <SelectLabel className="border-b border-zinc-100 px-3 py-2 text-base font-semibold text-[#28627B]">
                {grupo.label}
              </SelectLabel>
              {grupo.eventos.map((evento) => (
                <SelectItem
                  key={evento.id}
                  value={String(evento.id)}
                  textValue={rotuloEvento(evento)}
                  className="rounded-lg px-3 py-2.5 text-base data-[highlighted]:bg-zinc-100"
                >
                  <span className="flex min-w-0 flex-col gap-0.5 whitespace-normal break-words text-left">
                    <span className="font-medium">{rotuloEvento(evento)}</span>
                    {evento.local && <span className="text-sm text-zinc-500">{evento.local}</span>}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </FormSelect>
        {grupos.length === 0 && <p className="text-sm text-zinc-500">Nenhum evento encontrado. Busque pelo nome ou escolha outro mês.</p>}
      </div>

      {!definitivo ? <p className="rounded-xl bg-zinc-50 px-4 py-3 text-base text-zinc-600">Escolha primeiro o evento que fica para ver as sugestões de mesclagem.</p> : <>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-lg font-medium text-zinc-900">
            2. Confira os possíveis duplicados de “{definitivo.titulo}”
          </span>
          {candidatos.length > 0 && (
            <button
              type="button"
              onClick={alternarFiltrados}
              className="flex min-h-10 items-center rounded-xl border border-zinc-300 bg-white px-3.5 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              {todosFiltradosMarcados ? "Desmarcar visíveis" : "Marcar visíveis"}
            </button>
          )}
        </div>
        <p className="text-sm text-zinc-500">Sugestões pelo nome, com as datas mais próximas primeiro. Confira a data e marque apenas os registros da mesma atividade.</p>
        <button type="button" onClick={() => setMostrarTodos(!mostrarTodos)} className="self-start text-sm font-medium text-[#2195B9] underline underline-offset-4">
          {mostrarTodos ? "Ver apenas sugestões pelo nome" : "Ver todos os eventos"}
        </button>

        <div className="relative w-full">
          <Search
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar duplicados por título, local ou data..."
            aria-label="Filtrar eventos duplicados"
            className="min-h-12 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/25"
          />
        </div>

        {candidatos.length === 0 ? (
          <p className="rounded-xl bg-zinc-50 px-4 py-3 text-base text-zinc-600">
            {eventos.length === 0
              ? "Nenhum evento para mesclar."
              : "Nenhuma sugestão encontrada. Busque outro nome ou veja todos os eventos."}
          </p>
        ) : (
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-xl border border-zinc-200 p-2">
            {candidatos.map((e) => (
              <label
                key={e.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-green-50/60 ${
                  removerIds.has(e.id) ? "bg-green-50/80 ring-1 ring-green-600/30" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={removerIds.has(e.id)}
                  onChange={(ev) => toggleRemover(e.id, ev.target.checked)}
                  aria-label={`Marcar ${e.titulo} como duplicado`}
                  className="mt-1 h-5 w-5 shrink-0 accent-green-700"
                />
                <span className="min-w-0 flex-1 text-base text-zinc-800">
                  {rotuloEvento(e)}
                  {e.local && <span className="block text-sm text-zinc-500">{e.local}</span>}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
      </>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={executar}
          disabled={!podeExecutar}
          className="flex min-h-12 items-center gap-2 rounded-xl bg-green-700 px-5 text-lg font-medium text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Merge size={18} aria-hidden="true" />
          {executando
            ? "Mesclando..."
            : removerIds.size > 1
              ? `Mesclar ${removerIds.size} no definitivo`
              : "Mesclar eventos"}
        </button>

        {mensagem && (
          <span className={`text-base ${mensagem.ok ? "text-green-800" : "text-red-700"}`}>
            {mensagem.texto}
          </span>
        )}
      </div>
    </section>
  );
}
