"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Layers, UserRound, Search } from "lucide-react";
import { CAMPOS_CONSULTA, consultarAtas, normalizarConsulta, posicoesConsulta, trechosConsulta, trechoConsulta, type AtaConsulta, type CampoConsulta, type ModoCorrespondencia } from "../_lib/consulta-atas";

const controle = "min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";
const porPagina = 20;
const tipos = [
  { id: "data", titulo: "Data da reunião", descricao: "Encontre uma reunião ou consulte um período.", Icone: CalendarDays },
  { id: "area", titulo: "Área", descricao: "Veja o que foi citado sobre uma área.", Icone: Layers },
  { id: "pessoa", titulo: "Pessoa", descricao: "Localize menções a um nome em todas as atas.", Icone: UserRound },
  { id: "livre", titulo: "Palavra-chave", descricao: "Pesquise um assunto, decisão ou termo.", Icone: Search },
] as const;
type TipoPesquisa = typeof tipos[number]["id"];
const atalho = "min-h-11 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-[#28627B] hover:border-[#2195B9] hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";

function Destaque({ texto, busca, modo = "palavras" }: { texto: string; busca: string; modo?: ModoCorrespondencia }) {
  const posicoes = posicoesConsulta(texto, busca, modo);
  const partes = [];
  let inicio = 0;
  for (const posicao of posicoes) {
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
  const [dataExata, setDataExata] = useState("");
  const [busca, setBusca] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [campo, setCampo] = useState<CampoConsulta | "todos">("todos");
  const [pagina, setPagina] = useState(1);
  const buscaAdiada = useDeferredValue(busca);
  const pesquisaPronta = tipo === "livre" || ((tipo === "pessoa" || tipo === "area") ? Boolean(buscaAdiada.trim()) : Boolean(dataExata || inicio || fim));
  const modo = tipo === "pessoa" ? "pessoa" : "palavras";
  const resultados = useMemo(() => consultarAtas(atas, buscaAdiada, dataExata || inicio, dataExata || fim, campo, modo), [atas, buscaAdiada, inicio, fim, dataExata, campo, modo]);
  const sugestoesPessoas = useMemo(() => [...new Set(atas.flatMap((ata) => (ata.participantes ?? "").split(/[\n,;]/).map((nome) => nome.replace(/^\s*[-*•\d.)]+\s*/, "").trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b, "pt-BR")), [atas]);
  const datas = useMemo(() => [...new Set(atas.map((ata) => ata.data_reuniao))].sort().reverse(), [atas]);
  const sugestoes = (tipo === "pessoa" ? sugestoesPessoas : areas).filter((nome) => normalizarConsulta(nome).includes(normalizarConsulta(busca).trim())).slice(0, 6);
  const periodoInvalido = Boolean(inicio && fim && inicio > fim);
  const totalPaginas = Math.max(1, Math.ceil(resultados.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = resultados.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);

  function limpar() { setBusca(""); setInicio(""); setFim(""); setDataExata(""); setCampo("todos"); setPagina(1); }
  function escolherTipo(novoTipo: TipoPesquisa) { limpar(); setTipo(novoTipo); }
  function pesquisar(valor: string) { setBusca(valor); setPagina(1); }

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="tipo-consulta" className="space-y-4">
        <h2 id="tipo-consulta" className="text-lg font-semibold text-zinc-900">1. Como você quer buscar?</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tipos.map(({ id, titulo, descricao, Icone }) => <button key={id} type="button" aria-pressed={tipo === id} onClick={() => escolherTipo(id)} className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] ${tipo === id ? "border-[#2195B9] bg-sky-50 ring-1 ring-[#2195B9]" : "border-zinc-200 bg-white hover:border-[#2195B9]"}`}>
            <Icone size={22} aria-hidden="true" className="text-[#2195B9]" />
            <span className="font-semibold text-zinc-900">{titulo}</span><span className="text-sm text-zinc-600">{descricao}</span>
          </button>)}
        </div>
      </section>
      {tipo && <>
      <h2 className="text-lg font-semibold text-zinc-900">2. {tipo === "pessoa" ? "De quem você quer encontrar menções?" : tipo === "area" ? "Qual área você quer consultar?" : tipo === "data" ? "Qual data ou período?" : "O que você quer encontrar?"}</h2>
      <section aria-label="Filtros da consulta" className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-zinc-200/60 sm:grid-cols-2 lg:grid-cols-4">
        {tipo === "data" ? <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700 sm:col-span-2">Data da reunião
          <input type="date" value={dataExata} onChange={(e) => { setDataExata(e.target.value); setInicio(""); setFim(""); setPagina(1); }} className={controle} />
        </label> : <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700 sm:col-span-2 lg:col-span-3">{tipo === "pessoa" ? "Nome da pessoa" : tipo === "area" ? "Nome da área" : "Buscar nas atas"}
          <input type="search" value={busca} onChange={(e) => pesquisar(e.target.value)} placeholder={tipo === "pessoa" ? "Digite o nome como aparece nas atas" : tipo === "area" ? "Ex.: Financeiro, Comunicação, Ensino" : "Ex.: orçamento, formação ou 15/10/2026"} className={controle} />
        </label>}
        {tipo === "livre" && <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">Onde buscar
          <select value={campo} onChange={(e) => { setCampo(e.target.value as CampoConsulta | "todos"); setPagina(1); }} className={controle}>
            <option value="todos">Todo o conteúdo</option>
            {Object.entries(CAMPOS_CONSULTA).map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
          </select>
        </label>}
        {tipo === "data" && <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4" aria-label="Datas das reuniões">
          {datas.slice(0, 6).map((data) => <button type="button" key={data} aria-pressed={dataExata === data} onClick={() => { setDataExata(data); setInicio(""); setFim(""); setPagina(1); }} className={atalho}>{data.split("-").reverse().join("/")}</button>)}
        </div>}
        {(tipo === "pessoa" || tipo === "area") && <div className="space-y-2 sm:col-span-2 lg:col-span-4">
          <p className="text-sm text-zinc-600">{tipo === "pessoa" ? "A busca procura o nome em todo o conteúdo, incluindo assuntos, decisões e texto original. Os atalhos abaixo vêm dos participantes registrados." : "A busca localiza menções ao nome da área no conteúdo das atas."}</p>
          <div className="flex flex-wrap gap-2" aria-label={tipo === "pessoa" ? "Sugestões de pessoas" : "Sugestões de áreas"}>
            {tipo === "pessoa" && meuNome.trim() && <button type="button" className={atalho} onClick={() => pesquisar(meuNome)}>Buscar meu nome</button>}
            {sugestoes.map((nome) => <button type="button" key={nome} onClick={() => pesquisar(nome)} className={atalho}>{nome}</button>)}
          </div>
        </div>}
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">Data inicial
          <input type="date" value={inicio} onChange={(e) => { setInicio(e.target.value); setDataExata(""); setPagina(1); }} aria-invalid={periodoInvalido} aria-describedby={periodoInvalido ? "erro-periodo" : undefined} className={controle} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">Data final
          <input type="date" value={fim} onChange={(e) => { setFim(e.target.value); setDataExata(""); setPagina(1); }} aria-invalid={periodoInvalido} aria-describedby={periodoInvalido ? "erro-periodo" : undefined} className={controle} />
        </label>
        <button type="button" onClick={limpar} className={`${controle} self-end font-medium hover:bg-zinc-50`}>Limpar filtros</button>
        <p className="text-sm text-zinc-500 sm:col-span-2 lg:col-span-4">Os resultados mostram trechos das atas e o link para conferir o registro completo. A consulta não utiliza IA nem consome créditos da API.</p>
      </section>
      <h2 className="text-lg font-semibold text-zinc-900">3. Confira os resultados</h2>
      {!pesquisaPronta ? <p className="rounded-xl bg-sky-50 p-5 text-base text-[#28627B]">{tipo === "data" ? "Escolha uma data de reunião ou informe um período para ver as atas." : tipo === "pessoa" ? "Digite ou selecione um nome para encontrar as menções nas atas." : "Digite ou selecione uma área para consultar as menções nas atas."}</p> : <>
      {periodoInvalido && <p id="erro-periodo" role="alert" className="text-base text-red-700">A data inicial deve ser anterior ou igual à data final.</p>}
      <p role="status" className="text-sm text-zinc-600">{resultados.length} {resultados.length === 1 ? "ata encontrada" : "atas encontradas"}{busca !== buscaAdiada ? " · Atualizando…" : ""}</p>
      {!visiveis.length && !periodoInvalido && <p className="rounded-2xl bg-white p-8 text-center text-zinc-600 ring-1 ring-zinc-200/60">{atas.length ? "Nenhuma ata encontrada. Tente outras palavras ou amplie o período." : "Nenhuma ata disponível para consulta."}</p>}
      <div className="flex flex-col gap-4">
        {visiveis.map(({ ata, correspondencias }) => (
          <article key={ata.id} className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-zinc-200/60">
            <header className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-lg font-semibold text-zinc-900"><Link href={`/reunioes/${ata.id}`} className="hover:text-[#2195B9]"><Destaque texto={ata.titulo ?? "Ata sem título"} busca={buscaAdiada} modo={modo} /></Link></h3>
              <time dateTime={ata.data_reuniao} className="text-sm font-medium text-zinc-600">{ata.data_reuniao.split("-").reverse().join("/")}</time>
            </header>
            {correspondencias.map((secao) => {
              const trechos = trechosConsulta(secao.texto, buscaAdiada, modo);
              return (
              <div key={secao.campo} className="space-y-1">
                <h4 className="text-sm font-semibold text-[#28627B]">{CAMPOS_CONSULTA[secao.campo]}</h4>
                <p className="break-words text-sm leading-relaxed text-zinc-700"><Destaque texto={trechos[0] ?? trechoConsulta(secao.texto, buscaAdiada)} busca={buscaAdiada} modo={modo} /></p>
                {trechos.length > 1 && <details className="pt-2">
                  <summary className="cursor-pointer py-2 text-sm font-medium text-[#28627B]">Ver mais {trechos.length - 1} {trechos.length === 2 ? "trecho" : "trechos"} em {CAMPOS_CONSULTA[secao.campo]}</summary>
                  <div className="space-y-3 border-l-2 border-sky-100 pl-3">{trechos.slice(1).map((trecho, i) => <p key={i} className="break-words text-sm leading-relaxed text-zinc-700"><Destaque texto={trecho} busca={buscaAdiada} modo={modo} /></p>)}</div>
                </details>}
              </div>
            ); })}
            <Link href={`/reunioes/${ata.id}`} className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-[#28627B] underline underline-offset-4">Ver ata completa</Link>
          </article>
        ))}
      </div>
      {totalPaginas > 1 && <nav aria-label="Páginas dos resultados" className="flex flex-wrap items-center justify-center gap-4">
        <button type="button" disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)} className={`${controle} w-auto disabled:opacity-50`}>Anterior</button>
        <span className="text-sm text-zinc-600">Página {paginaAtual} de {totalPaginas}</span>
        <button type="button" disabled={paginaAtual === totalPaginas} onClick={() => setPagina(paginaAtual + 1)} className={`${controle} w-auto disabled:opacity-50`}>Próxima</button>
      </nav>}
      </>}
      </>}
    </div>
  );
}
