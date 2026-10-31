"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { CAMPOS_CONSULTA, consultarAtas, normalizarConsulta, termosConsulta, trechoConsulta, type AtaConsulta, type CampoConsulta } from "../_lib/consulta-atas";

const controle = "min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";
const porPagina = 20;

function Destaque({ texto, busca }: { texto: string; busca: string }) {
  const termos = termosConsulta(busca).sort((a, b) => b.length - a.length);
  if (!termos.length) return texto;
  const normalizado = normalizarConsulta(texto);
  const partes = [];
  let inicio = 0;
  for (let i = 0; i < texto.length; i++) {
    const termo = termos.find((t) => normalizado.startsWith(t, i));
    if (!termo) continue;
    partes.push(texto.slice(inicio, i));
    partes.push(<mark key={i} className="rounded bg-amber-100 text-zinc-900">{texto.slice(i, i + termo.length)}</mark>);
    i += termo.length - 1;
    inicio = i + 1;
  }
  partes.push(texto.slice(inicio));
  return partes;
}

export default function ConsultaAtas({ atas }: { atas: AtaConsulta[] }) {
  const [busca, setBusca] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [campo, setCampo] = useState<CampoConsulta | "todos">("todos");
  const [pagina, setPagina] = useState(1);
  const buscaAdiada = useDeferredValue(busca);
  const resultados = useMemo(() => consultarAtas(atas, buscaAdiada, inicio, fim, campo), [atas, buscaAdiada, inicio, fim, campo]);
  const periodoInvalido = Boolean(inicio && fim && inicio > fim);
  const totalPaginas = Math.max(1, Math.ceil(resultados.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = resultados.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);

  function limpar() { setBusca(""); setInicio(""); setFim(""); setCampo("todos"); setPagina(1); }

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Filtros da consulta" className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-zinc-200/60 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700 sm:col-span-2 lg:col-span-3">Buscar nas atas
          <input type="search" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Ex.: orçamento, formação, João ou 15/10/2026" className={controle} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">Onde buscar
          <select value={campo} onChange={(e) => { setCampo(e.target.value as CampoConsulta | "todos"); setPagina(1); }} className={controle}>
            <option value="todos">Todo o conteúdo</option>
            {Object.entries(CAMPOS_CONSULTA).map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">Data inicial
          <input type="date" value={inicio} onChange={(e) => { setInicio(e.target.value); setPagina(1); }} aria-invalid={periodoInvalido} aria-describedby={periodoInvalido ? "erro-periodo" : undefined} className={controle} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">Data final
          <input type="date" value={fim} onChange={(e) => { setFim(e.target.value); setPagina(1); }} aria-invalid={periodoInvalido} aria-describedby={periodoInvalido ? "erro-periodo" : undefined} className={controle} />
        </label>
        <button type="button" onClick={limpar} className={`${controle} self-end font-medium hover:bg-zinc-50`}>Limpar filtros</button>
        <p className="text-sm text-zinc-500 sm:col-span-2 lg:col-span-4">Os resultados mostram trechos das atas e o link para conferir o registro completo. A consulta não utiliza IA nem consome créditos da API.</p>
      </section>
      {periodoInvalido && <p id="erro-periodo" role="alert" className="text-base text-red-700">A data inicial deve ser anterior ou igual à data final.</p>}
      <p role="status" className="text-sm text-zinc-600">{resultados.length} {resultados.length === 1 ? "ata encontrada" : "atas encontradas"}{busca !== buscaAdiada ? " · Atualizando…" : ""}</p>
      {!visiveis.length && !periodoInvalido && <p className="rounded-2xl bg-white p-8 text-center text-zinc-600 ring-1 ring-zinc-200/60">{atas.length ? "Nenhuma ata encontrada. Tente outras palavras ou amplie o período." : "Nenhuma ata disponível para consulta."}</p>}
      <div className="flex flex-col gap-4">
        {visiveis.map(({ ata, correspondencias }) => (
          <article key={ata.id} className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-zinc-200/60">
            <header className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-zinc-900"><Link href={`/reunioes/${ata.id}`} className="hover:text-[#2195B9]"><Destaque texto={ata.titulo ?? "Ata sem título"} busca={buscaAdiada} /></Link></h2>
              <time dateTime={ata.data_reuniao} className="text-sm font-medium text-zinc-600">{ata.data_reuniao.split("-").reverse().join("/")}</time>
            </header>
            {correspondencias.map((secao) => (
              <div key={secao.campo} className="space-y-1">
                <h3 className="text-sm font-semibold text-[#28627B]">{CAMPOS_CONSULTA[secao.campo]}</h3>
                <p className="break-words text-sm leading-relaxed text-zinc-700"><Destaque texto={trechoConsulta(secao.texto, buscaAdiada)} busca={buscaAdiada} /></p>
              </div>
            ))}
            <Link href={`/reunioes/${ata.id}`} className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-[#28627B] underline underline-offset-4">Ver ata completa</Link>
          </article>
        ))}
      </div>
      {totalPaginas > 1 && <nav aria-label="Páginas dos resultados" className="flex flex-wrap items-center justify-center gap-4">
        <button type="button" disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)} className={`${controle} w-auto disabled:opacity-50`}>Anterior</button>
        <span className="text-sm text-zinc-600">Página {paginaAtual} de {totalPaginas}</span>
        <button type="button" disabled={paginaAtual === totalPaginas} onClick={() => setPagina(paginaAtual + 1)} className={`${controle} w-auto disabled:opacity-50`}>Próxima</button>
      </nav>}
    </div>
  );
}
