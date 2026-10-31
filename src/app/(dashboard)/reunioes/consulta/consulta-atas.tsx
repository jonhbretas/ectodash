"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Layers, UserRound, Search, ArrowLeft } from "lucide-react";
import { CAMPOS_CONSULTA, consultarAtas, normalizarConsulta, posicoesConsulta, trechosConsulta, trechoConsulta, type AtaConsulta, type CampoConsulta, type ModoCorrespondencia } from "../_lib/consulta-atas";

const foco = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";
const controle = `min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 ${foco}`;
const atalho = `min-h-11 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-[#28627B] hover:bg-sky-50 ${foco}`;
const tipos = [
  { id: "data", titulo: "Data da reunião", pergunta: "Quando foi a reunião?", Icone: CalendarDays },
  { id: "area", titulo: "Área", pergunta: "Qual área você quer consultar?", Icone: Layers },
  { id: "pessoa", titulo: "Pessoa", pergunta: "Quem você quer procurar?", Icone: UserRound },
  { id: "livre", titulo: "Assunto", pergunta: "Qual assunto você quer procurar?", Icone: Search },
] as const;
type TipoPesquisa = typeof tipos[number]["id"];
type Filtros = { busca: string; data: string; inicio: string; fim: string; campo: CampoConsulta | "todos" };
const filtrosVazios: Filtros = { busca: "", data: "", inicio: "", fim: "", campo: "todos" };
const porPagina = 10;

function Destaque({ texto, busca, modo }: { texto: string; busca: string; modo: ModoCorrespondencia }) {
  const partes = [];
  let inicio = 0;
  for (const posicao of posicoesConsulta(texto, busca, modo)) {
    if (posicao.inicio < inicio) continue;
    partes.push(texto.slice(inicio, posicao.inicio));
    partes.push(<mark key={posicao.inicio} className="rounded bg-amber-100 text-zinc-900">{texto.slice(posicao.inicio, posicao.fim)}</mark>);
    inicio = posicao.fim;
  }
  partes.push(texto.slice(inicio));
  return partes;
}

export default function ConsultaAtas({ atas, areas = [], meuNome = "" }: { atas: AtaConsulta[]; areas?: string[]; meuNome?: string }) {
  const [tipo, setTipo] = useState<TipoPesquisa | null>(null);
  const [filtros, setFiltros] = useState(filtrosVazios);
  const [consulta, setConsulta] = useState<Filtros | null>(null);
  const [porPeriodo, setPorPeriodo] = useState(false);
  const [pagina, setPagina] = useState(1);
  const modo = tipo === "pessoa" ? "pessoa" : "palavras";
  const resultados = useMemo(() => consulta ? consultarAtas(atas, consulta.busca, consulta.data || consulta.inicio, consulta.data || consulta.fim, consulta.campo, modo) : [], [atas, consulta, modo]);
  const nomes = useMemo(() => [...new Set(atas.flatMap((ata) => (ata.participantes ?? "").split(/[\n,;]/).map((nome) => nome.replace(/^\s*[-*•\d.)]+\s*/, "").trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b, "pt-BR")), [atas]);
  const datas = useMemo(() => [...new Set(atas.map((ata) => ata.data_reuniao))].sort().reverse().slice(0, 3), [atas]);
  const sugestoes = (tipo === "pessoa" ? nomes : areas).filter((nome) => normalizarConsulta(nome).includes(normalizarConsulta(filtros.busca).trim())).slice(0, tipo === "pessoa" && meuNome.trim() ? 2 : 3);
  const periodoInvalido = Boolean(filtros.inicio && filtros.fim && filtros.inicio > filtros.fim);
  const podeBuscar = tipo === "data" ? Boolean(filtros.data || filtros.inicio || filtros.fim) : Boolean(filtros.busca.trim());
  const totalPaginas = Math.max(1, Math.ceil(resultados.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const escolhido = tipos.find((item) => item.id === tipo);

  function atualizar(alteracao: Partial<Filtros>) {
    setFiltros((atual) => ({ ...atual, ...alteracao }));
    setConsulta(null);
    setPagina(1);
  }
  function buscarAtalho(alteracao: Partial<Filtros>) {
    const novos = { ...filtros, ...alteracao };
    setFiltros(novos);
    setConsulta(novos.inicio && novos.fim && novos.inicio > novos.fim ? null : novos);
    setPagina(1);
  }
  function trocar() {
    setTipo(null); setFiltros(filtrosVazios); setConsulta(null); setPorPeriodo(false); setPagina(1);
  }

  if (!atas.length) return <p className="rounded-2xl bg-white p-6 text-zinc-600 ring-1 ring-zinc-200/60">Nenhuma ata disponível para consulta.</p>;

  return (
    <div className="flex w-full max-w-3xl flex-col gap-5">
      {!escolhido ? (
        <section aria-labelledby="tipo-consulta" className="space-y-4">
          <h2 id="tipo-consulta" className="text-lg font-semibold text-zinc-900">Como você quer buscar?</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tipos.map(({ id, titulo, Icone }) => <button key={id} type="button" onClick={() => setTipo(id)} className={`flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-center font-medium text-zinc-900 hover:border-[#2195B9] hover:bg-sky-50 ${foco}`}>
              <Icone size={24} aria-hidden="true" className="text-[#2195B9]" />{titulo}
            </button>)}
          </div>
        </section>
      ) : (
        <>
          <form onSubmit={(event) => { event.preventDefault(); if (podeBuscar && !periodoInvalido) { setConsulta({ ...filtros }); setPagina(1); } }} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-zinc-200/60 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm text-zinc-500"><escolhido.Icone size={18} aria-hidden="true" />{escolhido.titulo}</span>
              <button type="button" onClick={trocar} className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[#28627B] hover:bg-sky-50 ${foco}`}><ArrowLeft size={15} aria-hidden="true" />Trocar busca</button>
            </div>
            <h2 className="text-xl font-semibold text-zinc-900">{escolhido.pergunta}</h2>
            {tipo === "data" ? (
              <div className="space-y-3">
                {!porPeriodo ? <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">Data da reunião
                  <input type="date" value={filtros.data} onChange={(e) => atualizar({ data: e.target.value })} className={controle} />
                </label> : <Periodo filtros={filtros} atualizar={atualizar} invalido={periodoInvalido} />}
                <button type="button" aria-pressed={porPeriodo} onClick={() => { setPorPeriodo(!porPeriodo); atualizar({ data: "", inicio: "", fim: "" }); }} className={`min-h-11 rounded-lg px-2 text-sm font-medium text-[#28627B] hover:bg-sky-50 ${foco}`}>{porPeriodo ? "Escolher um dia" : "Buscar por período"}</button>
                {!porPeriodo && <div className="flex flex-wrap gap-2" aria-label="Reuniões recentes">{datas.map((data) => <button type="button" key={data} onClick={() => buscarAtalho({ data, inicio: "", fim: "" })} className={atalho}>{data.split("-").reverse().join("/")}</button>)}</div>}
              </div>
            ) : (
              <>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">{tipo === "pessoa" ? "Nome da pessoa" : tipo === "area" ? "Nome da área" : "Assunto"}
                  <input type="search" value={filtros.busca} onChange={(e) => atualizar({ busca: e.target.value })} placeholder={tipo === "pessoa" ? "Ex.: João Silva" : tipo === "area" ? "Ex.: Financeiro" : "Ex.: orçamento da formação"} className={controle} aria-describedby={tipo === "pessoa" ? "ajuda-pessoa" : undefined} />
                </label>
                {tipo === "pessoa" && <p id="ajuda-pessoa" className="text-sm text-zinc-500">Veja onde esse nome aparece nas atas.</p>}
                {(tipo === "pessoa" || tipo === "area") && <div className="flex flex-wrap gap-2" aria-label="Sugestões para buscar">
                  {tipo === "pessoa" && meuNome.trim() && <button type="button" className={atalho} onClick={() => buscarAtalho({ busca: meuNome })}>Buscar meu nome</button>}
                  {sugestoes.map((nome) => <button type="button" key={nome} className={atalho} onClick={() => buscarAtalho({ busca: nome })}>{nome}</button>)}
                </div>}
                <details className="rounded-xl border border-zinc-100 px-3">
                  <summary className={`cursor-pointer rounded-lg py-3 text-sm text-zinc-600 ${foco}`}>Mais opções</summary>
                  <div className="space-y-4 pb-3">
                    <Periodo filtros={filtros} atualizar={atualizar} invalido={periodoInvalido} />
                    {tipo === "livre" && <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">Onde buscar
                      <select value={filtros.campo} onChange={(e) => atualizar({ campo: e.target.value as CampoConsulta | "todos" })} className={controle}>
                        <option value="todos">Toda a ata</option>
                        {Object.entries(CAMPOS_CONSULTA).map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
                      </select>
                    </label>}
                    <button type="button" onClick={() => { setFiltros(filtrosVazios); setConsulta(null); setPagina(1); }} className={`min-h-11 rounded-lg px-2 text-sm text-[#28627B] ${foco}`}>Limpar filtros</button>
                  </div>
                </details>
              </>
            )}
            {periodoInvalido && <p id="erro-periodo" role="alert" className="text-sm text-red-700">A data inicial deve ser anterior ou igual à data final.</p>}
            <button type="submit" disabled={!podeBuscar || periodoInvalido} className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-6 text-base font-semibold text-white hover:bg-[#28627B] disabled:opacity-50 sm:w-auto ${foco}`}><Search size={18} aria-hidden="true" />Buscar</button>
          </form>
          {consulta && <section aria-label="Resultados da busca" className="space-y-4">
            <p role="status" className="text-sm text-zinc-600">{resultados.length} {resultados.length === 1 ? "ata encontrada" : "atas encontradas"}</p>
            {!resultados.length && <p className="rounded-2xl bg-white p-6 text-zinc-600 ring-1 ring-zinc-200/60">Nenhuma ata encontrada. Tente outro nome, assunto ou período.</p>}
            {resultados.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina).map(({ ata, correspondencias }) => {
              const trechos = correspondencias.flatMap((secao) => {
                const encontrados = trechosConsulta(secao.texto, consulta.busca, modo);
                return (encontrados.length ? encontrados : [trechoConsulta(secao.texto, consulta.busca)]).map((texto) => ({ campo: secao.campo, texto }));
              });
              const indicePrincipal = trechos.findIndex((trecho) => trecho.campo !== "titulo" && trecho.campo !== "participantes");
              const principal = trechos[indicePrincipal >= 0 ? indicePrincipal : 0];
              const outros = trechos.filter((trecho) => trecho !== principal);
              return <article key={ata.id} className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-zinc-200/60">
                <header className="space-y-1">
                  <time dateTime={ata.data_reuniao} className="text-sm text-zinc-500">{ata.data_reuniao.split("-").reverse().join("/")}</time>
                  <h3 className="text-lg font-semibold text-zinc-900"><Link href={`/reunioes/${ata.id}`} className={`rounded hover:text-[#2195B9] ${foco}`}><Destaque texto={ata.titulo ?? "Ata sem título"} busca={consulta.busca} modo={modo} /></Link></h3>
                </header>
                {principal && <Trecho trecho={principal} busca={consulta.busca} modo={modo} />}
                {outros.length > 0 && <details>
                  <summary className={`cursor-pointer rounded-lg py-3 text-sm font-medium text-[#28627B] ${foco}`}>Ver mais trechos ({outros.length})</summary>
                  <div className="space-y-4 border-l-2 border-sky-100 pl-3">{outros.map((trecho, i) => <Trecho key={i} trecho={trecho} busca={consulta.busca} modo={modo} />)}</div>
                </details>}
                <Link href={`/reunioes/${ata.id}`} className={`inline-flex min-h-11 items-center rounded text-sm font-medium text-[#28627B] underline underline-offset-4 ${foco}`}>Ver ata completa</Link>
              </article>;
            })}
            {totalPaginas > 1 && <nav aria-label="Páginas dos resultados" className="flex flex-wrap items-center justify-center gap-3">
              <button type="button" disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)} className={`${atalho} disabled:opacity-50`}>Anterior</button>
              <span className="text-sm text-zinc-600">{paginaAtual} de {totalPaginas}</span>
              <button type="button" disabled={paginaAtual === totalPaginas} onClick={() => setPagina(paginaAtual + 1)} className={`${atalho} disabled:opacity-50`}>Próxima</button>
            </nav>}
          </section>}
        </>
      )}
    </div>
  );
}

function Periodo({ filtros, atualizar, invalido }: { filtros: Filtros; atualizar: (alteracao: Partial<Filtros>) => void; invalido: boolean }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">Data inicial
      <input type="date" value={filtros.inicio} onChange={(e) => atualizar({ inicio: e.target.value, data: "" })} aria-invalid={invalido} aria-describedby={invalido ? "erro-periodo" : undefined} className={controle} />
    </label>
    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">Data final
      <input type="date" value={filtros.fim} onChange={(e) => atualizar({ fim: e.target.value, data: "" })} aria-invalid={invalido} aria-describedby={invalido ? "erro-periodo" : undefined} className={controle} />
    </label>
  </div>;
}

function Trecho({ trecho, busca, modo }: { trecho: { campo: CampoConsulta; texto: string }; busca: string; modo: ModoCorrespondencia }) {
  return <div className="space-y-1">
    <h4 className="text-sm font-medium text-zinc-500">{CAMPOS_CONSULTA[trecho.campo]}</h4>
    <p className="break-words text-sm leading-relaxed text-zinc-700"><Destaque texto={trecho.texto} busca={busca} modo={modo} /></p>
  </div>;
}
