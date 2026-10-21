// src/app/(dashboard)/utilidades/contratos/lote/lote-client.tsx
// Tela de contratos em massa em 4 passos: (1) modelo/evento, (2) alunos —
// colar planilha, subir CSV ou digitar —, (3) conferência com duplicados,
// pré-visualização e envio de teste, (4) confirmação e envio um a um com
// progresso. Nada vai para a Assinafy sem confirmação explícita.
"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileUp,
  Loader2,
  Plus,
  Send,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import {
  ALUNO_CAMPOS,
  ALUNO_VAZIO,
  validarAluno,
  type AlunoContrato,
} from "@/lib/contratos/aluno";
import { lerPlanilha } from "@/lib/contratos/planilha";
import { agruparEventosPorMes, diaMes } from "@/lib/contratos/eventos-por-mes";
import type { SaldoCota } from "@/lib/contratos/cota";
import {
  consultarCota,
  criarContratosLote,
  enviarTesteLote,
  finalizarLote,
  previsualizarContratoLote,
  processarContratoLote,
  verificarDuplicadosLote,
  type ContratoExistente,
} from "../lote-actions";
import PdfPreviewDialog, { type PdfAberto } from "../pdf-preview-dialog";

type Props = {
  modelos: Array<{ id: number; titulo: string; variaveis: string[] }>;
  eventos: Array<{ id: number; titulo: string; data_evento: string | null }>;
  saldoInicial: SaldoCota | null;
  emailUsuario: string;
};

type Decisao = "pular" | "atualizar" | "novo";

type Linha = {
  key: number;
  aluno: AlunoContrato;
  existente?: ContratoExistente | null;
  decisao?: Decisao;
};

type Progresso = { nome: string; ok: boolean | null; message: string };

const MAX_LOTE = 100;

/** Variável do modelo → campo do aluno (para avisar campo usado e vazio). */
const VARIAVEL_CAMPO: Record<string, keyof AlunoContrato> = {
  "{{aluno_nome}}": "nome",
  "{{aluno_email}}": "email",
  "{{aluno_documento}}": "documento",
  "{{aluno_telefone}}": "telefone",
  "{{aluno_rg}}": "rg",
  "{{aluno_nascimento}}": "nascimento",
  "{{aluno_endereco}}": "endereco",
  "{{aluno_nacionalidade}}": "nacionalidade",
  "{{aluno_estado_civil}}": "estadoCivil",
  "{{aluno_profissao}}": "profissao",
};

const STATUS_LABEL: Record<string, string> = {
  gerado: "Gerado",
  assinando: "Em assinatura",
  assinado: "Assinado",
  recusado: "Recusado",
};

const INPUT =
  "w-full min-h-14 rounded-xl border border-zinc-200 bg-white px-4 text-lg text-zinc-900 placeholder:text-zinc-400 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30";
const CELL_INPUT =
  "w-full min-h-11 rounded-lg border border-zinc-200 bg-white px-2.5 text-base text-zinc-900 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30";
const BTN_PRIMARY =
  "flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-5 text-lg font-medium text-white transition-colors hover:bg-[#28627B] disabled:cursor-not-allowed disabled:opacity-50";
const BTN_SECONDARY =
  "flex min-h-12 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50";

function decisaoPadrao(existente: ContratoExistente): Decisao {
  return existente.status === "assinado" ? "pular" : "atualizar";
}

function abrirPdf(base64: string, filename: string): PdfAberto {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  return { url, filename };
}

/** Lê CSV em UTF-8; se vier com caracteres quebrados (Excel salva em
 *  Windows-1252), relê nessa codificação. */
async function lerArquivoTexto(arquivo: File): Promise<string> {
  const buffer = await arquivo.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (!utf8.includes("�")) return utf8;
  return new TextDecoder("windows-1252").decode(buffer);
}

export default function LoteClient({ modelos, eventos, saldoInicial, emailUsuario }: Props) {
  const [modeloId, setModeloId] = useState("");
  const [eventoId, setEventoId] = useState("");
  const [prazoDias, setPrazoDias] = useState("15");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [colado, setColado] = useState("");
  const [avisoPlanilha, setAvisoPlanilha] = useState("");
  const [saldo, setSaldo] = useState<SaldoCota | null>(saldoInicial);
  const [verificado, setVerificado] = useState(false);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const [emailTeste, setEmailTeste] = useState(emailUsuario);
  const [teste, setTeste] = useState<{ ok: boolean; message: string; url?: string } | null>(null);
  const [pularTeste, setPularTeste] = useState(false);
  const [conferido, setConferido] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [progresso, setProgresso] = useState<Progresso[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pdf, setPdf] = useState<PdfAberto | null>(null);
  const [previewKey, setPreviewKey] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const proximaKey = useRef(1);

  const modelo = modelos.find((m) => String(m.id) === modeloId) ?? null;
  const base = useMemo(
    () => ({ modeloId: Number(modeloId), eventoId: eventoId ? Number(eventoId) : null }),
    [modeloId, eventoId]
  );
  const camposDoModelo = useMemo(
    () =>
      new Set(
        (modelo?.variaveis ?? [])
          .map((v) => VARIAVEL_CAMPO[v.replace(/\s/g, "")])
          .filter(Boolean)
      ),
    [modelo]
  );

  // Evita fechar a aba no meio do envio.
  useEffect(() => {
    if (!enviando) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enviando]);

  useEffect(() => () => {
    if (pdf) URL.revokeObjectURL(pdf.url);
  }, [pdf]);

  const validacoes = useMemo(
    () =>
      linhas.map((l) => {
        const v = validarAluno(l.aluno);
        const vazios = [...camposDoModelo].filter((c) => !l.aluno[c].trim());
        if (vazios.length > 0) {
          const labels = vazios.map((c) => ALUNO_CAMPOS.find((x) => x.campo === c)?.label);
          v.avisos.push(`Modelo usa e está vazio: ${labels.join(", ")}`);
        }
        return v;
      }),
    [linhas, camposDoModelo]
  );

  // Duplicados dentro do próprio lote (mesmo CPF ou e-mail em 2 linhas).
  const repetidas = useMemo(() => {
    const vistos = new Map<string, number>();
    const rep = new Set<number>();
    linhas.forEach((l, i) => {
      const chaves = [
        l.aluno.documento.replace(/\D/g, "").length === 11 ? `cpf:${l.aluno.documento.replace(/\D/g, "")}` : "",
        l.aluno.email.trim() ? `email:${l.aluno.email.trim().toLowerCase()}` : "",
      ].filter(Boolean);
      for (const chave of chaves) {
        if (vistos.has(chave)) {
          rep.add(i);
          rep.add(vistos.get(chave)!);
        } else {
          vistos.set(chave, i);
        }
      }
    });
    return rep;
  }, [linhas]);

  const aEnviar = linhas.filter((l) => l.decisao !== "pular");
  const comErro = validacoes.filter((v, i) => v.erros.length > 0 && linhas[i].decisao !== "pular").length;
  const comAviso = validacoes.filter((v) => v.avisos.length > 0).length;
  const duplicados = linhas.filter((l) => l.existente).length;
  const restantesDepois = saldo ? saldo.restantes - aEnviar.length : null;
  const estouraCota = restantesDepois !== null && restantesDepois < 0;
  const primeiraValida = linhas.find(
    (l, i) => l.decisao !== "pular" && validacoes[i].erros.length === 0
  );

  // Trocar modelo/evento invalida a verificação de duplicados e o teste.
  function trocarBase(campo: "modelo" | "evento", valor: string) {
    if (campo === "modelo") setModeloId(valor);
    else setEventoId(valor);
    setVerificado(false);
    setTeste(null);
    setConfirmando(false);
    setLinhas((atual) => atual.map((l) => ({ ...l, existente: undefined, decisao: undefined })));
  }

  function novaLinha(aluno: AlunoContrato = { ...ALUNO_VAZIO }): Linha {
    return { key: proximaKey.current++, aluno };
  }

  function alterarLinhas(fn: (atual: Linha[]) => Linha[]) {
    setLinhas(fn);
    setVerificado(false);
    setConfirmando(false);
  }

  function adicionarAlunos(alunos: AlunoContrato[], origem: string, colunasLidas: string) {
    if (alunos.length === 0) {
      setAvisoPlanilha("Nenhum aluno encontrado no texto.");
      return;
    }
    const espaco = MAX_LOTE - linhas.length;
    const aceitos = alunos.slice(0, Math.max(0, espaco));
    alterarLinhas((atual) => [...atual.filter((l) => Object.values(l.aluno).some(Boolean)), ...aceitos.map((a) => novaLinha(a))]);
    setAvisoPlanilha(
      `${aceitos.length} aluno(s) adicionados de ${origem}. Colunas reconhecidas: ${colunasLidas || "nenhuma"}.` +
        (aceitos.length < alunos.length ? ` Limite de ${MAX_LOTE} por lote — ${alunos.length - aceitos.length} ficaram de fora.` : "")
    );
  }

  function lerTexto(texto: string, origem: string) {
    const r = lerPlanilha(texto);
    const colunas = r.colunas
      .filter(Boolean)
      .map((c) => ALUNO_CAMPOS.find((x) => x.campo === c)?.label)
      .join(", ");
    adicionarAlunos(r.alunos, origem, r.comCabecalho ? colunas : `sem cabeçalho (ordem padrão)`);
  }

  function atualizarCampo(key: number, campo: keyof AlunoContrato, valor: string) {
    alterarLinhas((atual) =>
      atual.map((l) =>
        l.key === key
          ? {
              ...l,
              aluno: { ...l.aluno, [campo]: valor },
              // CPF/e-mail mudou: o duplicado encontrado pode não valer mais.
              ...(campo === "documento" || campo === "email" ? { existente: undefined, decisao: undefined } : {}),
            }
          : l
      )
    );
  }

  function verificar(depois?: () => void) {
    if (!modeloId) {
      setMensagem({ ok: false, texto: "Escolha o modelo do contrato primeiro." });
      return;
    }
    startTransition(async () => {
      const achados = await verificarDuplicadosLote(
        base,
        linhas.map((l) => ({ documento: l.aluno.documento, email: l.aluno.email }))
      );
      setLinhas((atual) =>
        atual.map((l, i) => {
          const existente = achados[i] ?? null;
          if (!existente) return { ...l, existente: null, decisao: l.decisao === "pular" ? "pular" : undefined };
          const mesma = l.existente?.id === existente.id && l.decisao;
          return { ...l, existente, decisao: mesma ? l.decisao : decisaoPadrao(existente) };
        })
      );
      setVerificado(true);
      setMensagem(null);
      consultarCota().then(setSaldo).catch(() => undefined);
      depois?.();
    });
  }

  function previsualizar(linha: Linha) {
    if (!modeloId) {
      setMensagem({ ok: false, texto: "Escolha o modelo do contrato primeiro." });
      return;
    }
    setPreviewKey(linha.key);
    startTransition(async () => {
      const r = await previsualizarContratoLote(base, linha.aluno);
      setPreviewKey(null);
      if (r.ok) setPdf(abrirPdf(r.base64, r.filename));
      else setMensagem({ ok: false, texto: r.message });
    });
  }

  function enviarTeste() {
    if (!primeiraValida) return;
    startTransition(async () => {
      const r = await enviarTesteLote(base, primeiraValida.aluno, emailTeste);
      setTeste(r);
      consultarCota().then(setSaldo).catch(() => undefined);
    });
  }

  async function enviarLote() {
    setConfirmando(false);
    setEnviando(true);
    setMensagem(null);
    const itens = aEnviar.map((l) => ({
      aluno: l.aluno,
      atualizarId: l.decisao === "atualizar" ? l.existente?.id ?? null : null,
    }));
    const criados = await criarContratosLote(base, Number(prazoDias), itens);
    if (!criados.ok) {
      setMensagem({ ok: false, texto: criados.message });
      setEnviando(false);
      return;
    }

    const lista: Progresso[] = aEnviar.map((l) => ({ nome: l.aluno.nome, ok: null, message: "Aguardando…" }));
    setProgresso([...lista]);
    for (let i = 0; i < criados.contratoIds.length; i++) {
      lista[i] = { ...lista[i], message: "Enviando…" };
      setProgresso([...lista]);
      const r = await processarContratoLote(criados.contratoIds[i], base.eventoId).catch(() => ({
        ok: false,
        message: "Falha de conexão.",
      }));
      lista[i] = { nome: lista[i].nome, ok: r.ok, message: r.message };
      setProgresso([...lista]);
    }

    await finalizarLote();
    setSaldo(await consultarCota().catch(() => saldo));
    setEnviando(false);
    const falhas = lista.filter((p) => !p.ok).length;
    setMensagem({
      ok: falhas === 0,
      texto:
        falhas === 0
          ? `${lista.length} contratos enviados para assinatura.`
          : `${lista.length - falhas} enviados, ${falhas} com falha. Os que falharam ficam como "Gerado" na lista de contratos e podem ser reenviados pelo card.`,
    });
  }

  const podeRevisar = Boolean(modeloId) && aEnviar.length > 0 && comErro === 0 && !estouraCota && !enviando;
  const testeOk = Boolean(teste?.ok) || pularTeste;

  return (
    <div className="flex w-full flex-col gap-8">
      {/* Saldo da cota */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4 ring-1 ${
          estouraCota ? "bg-red-50 ring-red-200" : "bg-[#e8f4f8] ring-[#2195B9]/20"
        }`}
        role="status"
      >
        <p className="text-lg text-zinc-800">
          <strong>Cota Assinafy deste mês:</strong>{" "}
          {saldo ? `${saldo.usados} de ${saldo.limite} usados — restam ${saldo.restantes}` : "indisponível"}
        </p>
        {aEnviar.length > 0 && restantesDepois !== null && (
          <p className={`text-lg font-medium ${estouraCota ? "text-red-800" : "text-zinc-700"}`}>
            {estouraCota
              ? `Este lote (${aEnviar.length}) passa da cota em ${-restantesDepois}.`
              : `Depois deste lote: restam ${restantesDepois}`}
          </p>
        )}
      </div>

      {/* 1. Modelo e evento */}
      <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-zinc-200/60">
        <h2 className="text-2xl font-semibold text-zinc-900">1. Modelo e evento</h2>
        <div className="grid gap-4 md:grid-cols-[2fr_2fr_1fr]">
          <label className="flex flex-col gap-2">
            <span className="text-lg font-medium text-zinc-800">Modelo do contrato</span>
            <select value={modeloId} onChange={(e) => trocarBase("modelo", e.target.value)} className={INPUT} disabled={enviando}>
              <option value="">Selecione o modelo...</option>
              {modelos.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.titulo}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-lg font-medium text-zinc-800">
              Evento / atividade <span className="text-zinc-400">(opcional)</span>
            </span>
            <select value={eventoId} onChange={(e) => trocarBase("evento", e.target.value)} className={INPUT} disabled={enviando}>
              <option value="">Sem evento vinculado</option>
              {agruparEventosPorMes(eventos).map((grupo) => (
                <optgroup key={grupo.chave} label={grupo.label}>
                  {grupo.eventos.map((ev) => (
                    <option key={ev.id} value={String(ev.id)}>
                      {ev.data_evento ? `${diaMes(ev.data_evento)} — ` : ""}
                      {ev.titulo}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-lg font-medium text-zinc-800">Prazo (dias)</span>
            <input
              type="number"
              min={1}
              max={90}
              value={prazoDias}
              onChange={(e) => setPrazoDias(e.target.value)}
              className={INPUT}
              disabled={enviando}
            />
          </label>
        </div>
        {modelo && (
          <p className="text-base text-zinc-600">
            Dados do aluno usados por este modelo:{" "}
            {camposDoModelo.size > 0
              ? [...camposDoModelo].map((c) => ALUNO_CAMPOS.find((x) => x.campo === c)?.label).join(", ")
              : "nenhuma variável de aluno (só o card de partes do PDF)"}
            .
          </p>
        )}
      </section>

      {/* 2. Alunos */}
      <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-zinc-200/60">
        <h2 className="text-2xl font-semibold text-zinc-900">2. Alunos</h2>
        <label className="flex flex-col gap-2">
          <span className="text-lg font-medium text-zinc-800">Colar da planilha (Excel ou Google Sheets)</span>
          <span className="text-base text-zinc-500">
            Copie as linhas <strong>com o cabeçalho</strong> (Nome, CPF, RG, Nascimento, E-mail, Telefone,
            Endereço, Nacionalidade, Estado civil, Profissão) e cole aqui. A ordem das colunas não importa.
          </span>
          <textarea
            value={colado}
            onChange={(e) => setColado(e.target.value)}
            rows={5}
            className="w-full rounded-xl border border-zinc-200 bg-white p-4 font-mono text-base text-zinc-900 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30"
            placeholder={"Nome\tCPF\tE-mail\tTelefone\nMaria da Silva\t529.982.247-25\tmaria@exemplo.com\t(45) 99999-0000"}
            disabled={enviando}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={!colado.trim() || enviando}
            onClick={() => {
              lerTexto(colado, "colagem");
              setColado("");
            }}
          >
            Adicionar alunos colados
          </button>
          <label className={`${BTN_SECONDARY} cursor-pointer`}>
            <FileUp size={18} aria-hidden="true" />
            Subir arquivo .csv
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              className="sr-only"
              disabled={enviando}
              onChange={async (e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) lerTexto(await lerArquivoTexto(arquivo), arquivo.name);
              }}
            />
          </label>
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={linhas.length >= MAX_LOTE || enviando}
            onClick={() => alterarLinhas((atual) => [...atual, novaLinha()])}
          >
            <Plus size={18} aria-hidden="true" />
            Adicionar linha
          </button>
          {linhas.length > 0 && (
            <button
              type="button"
              className={`${BTN_SECONDARY} text-red-700`}
              disabled={enviando}
              onClick={() => {
                if (window.confirm(`Remover os ${linhas.length} alunos da tabela?`)) alterarLinhas(() => []);
              }}
            >
              <Trash2 size={18} aria-hidden="true" />
              Limpar tabela
            </button>
          )}
        </div>
        {avisoPlanilha && <p className="text-base text-zinc-700">{avisoPlanilha}</p>}

        {linhas.length > 0 && (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[1500px] border-separate border-spacing-y-2 text-left">
              <thead>
                <tr className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="w-10 px-1">#</th>
                  {ALUNO_CAMPOS.map((c) => (
                    <th key={c.campo} className="px-1">
                      {c.label}
                      {camposDoModelo.has(c.campo) && <span className="text-[#2195B9]"> •</span>}
                    </th>
                  ))}
                  <th className="w-24 px-1">Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha, i) => {
                  const v = validacoes[i];
                  const pulada = linha.decisao === "pular";
                  return (
                    <LinhaTabela
                      key={linha.key}
                      indice={i}
                      linha={linha}
                      erros={v.erros}
                      avisos={[...v.avisos, ...(repetidas.has(i) ? ["CPF ou e-mail repetido em outra linha"] : [])]}
                      pulada={pulada}
                      desabilitado={enviando}
                      previewCarregando={isPending && previewKey === linha.key}
                      onCampo={(campo, valor) => atualizarCampo(linha.key, campo, valor)}
                      onRemover={() => alterarLinhas((atual) => atual.filter((l) => l.key !== linha.key))}
                      onPreview={() => previsualizar(linha)}
                      onDecisao={(d) =>
                        setLinhas((atual) => atual.map((l) => (l.key === linha.key ? { ...l, decisao: d } : l)))
                      }
                    />
                  );
                })}
              </tbody>
            </table>
            <p className="mt-1 text-sm text-zinc-500">
              <span className="text-[#2195B9]">•</span> coluna usada no texto do modelo. Role a tabela para o lado
              para ver todas as colunas.
            </p>
          </div>
        )}
      </section>

      {/* 3. Conferência e teste */}
      {linhas.length > 0 && (
        <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-zinc-200/60">
          <h2 className="text-2xl font-semibold text-zinc-900">3. Conferência e teste</h2>
          <ul className="grid gap-2 text-lg sm:grid-cols-2">
            <li>
              <strong>{aEnviar.length}</strong> contrato(s) a enviar
              {linhas.length - aEnviar.length > 0 ? ` · ${linhas.length - aEnviar.length} pulado(s)` : ""}
            </li>
            <li className={comErro ? "text-red-700" : "text-emerald-700"}>
              {comErro ? `${comErro} linha(s) com erro — corrija antes de enviar` : "Nenhum erro nos dados"}
            </li>
            <li className={comAviso ? "text-amber-700" : "text-zinc-600"}>
              {comAviso} linha(s) com aviso para conferir
            </li>
            <li className={duplicados ? "text-sky-800" : "text-zinc-600"}>
              {verificado
                ? `${duplicados} aluno(s) já com contrato deste modelo${eventoId ? "/evento" : ""}`
                : "Duplicados ainda não verificados"}
            </li>
          </ul>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={BTN_SECONDARY} disabled={isPending || enviando || !modeloId} onClick={() => verificar()}>
              {isPending && previewKey === null ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : null}
              Verificar duplicados
            </button>
          </div>

          <div className="flex flex-col gap-3 rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
            <h3 className="text-xl font-semibold text-zinc-900">Envio de teste</h3>
            <p className="text-base text-zinc-600">
              Envia o contrato de <strong>{primeiraValida?.aluno.nome || "—"}</strong> (primeira linha válida),
              marcado como TESTE, para assinatura no e-mail abaixo. Você recebe o e-mail da Assinafy exatamente
              como o aluno vai receber. <strong>Usa 1 envio da cota.</strong>
            </p>
            <div className="flex flex-wrap gap-3">
              <input
                type="email"
                value={emailTeste}
                onChange={(e) => setEmailTeste(e.target.value)}
                aria-label="E-mail que recebe o teste"
                className={`${INPUT} max-w-md flex-1`}
              />
              <button
                type="button"
                className={BTN_SECONDARY}
                disabled={!primeiraValida || !modeloId || isPending || enviando || (saldo?.restantes ?? 1) < 1}
                onClick={enviarTeste}
              >
                <Send size={18} aria-hidden="true" />
                Enviar teste
              </button>
            </div>
            {teste && (
              <p className={`text-base ${teste.ok ? "text-emerald-800" : "text-red-700"}`} role="status">
                {teste.message}{" "}
                {teste.url && (
                  <a href={teste.url} target="_blank" rel="noreferrer" className="font-medium underline">
                    Abrir link de assinatura
                  </a>
                )}
              </p>
            )}
            <label className="flex items-center gap-3 text-base text-zinc-700">
              <input
                type="checkbox"
                checked={pularTeste}
                onChange={(e) => setPularTeste(e.target.checked)}
                className="h-6 w-6 accent-[#2195B9]"
              />
              Já testei este modelo antes — pular o teste
            </label>
          </div>
        </section>
      )}

      {/* 4. Envio */}
      {linhas.length > 0 && (
        <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-zinc-200/60">
          <h2 className="text-2xl font-semibold text-zinc-900">4. Enviar para assinatura</h2>
          <label className="flex items-start gap-3 text-lg text-zinc-800">
            <input
              type="checkbox"
              checked={conferido}
              onChange={(e) => setConferido(e.target.checked)}
              className="mt-1 h-6 w-6 accent-[#2195B9]"
              disabled={enviando}
            />
            Conferi nomes, CPFs e e-mails da tabela e a pré-visualização do contrato.
          </label>

          {!confirmando && !progresso && (
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={!podeRevisar || !conferido || !testeOk || isPending}
              onClick={() => verificar(() => setConfirmando(true))}
            >
              <Send size={20} aria-hidden="true" />
              Revisar e enviar {aEnviar.length} contrato(s)
            </button>
          )}
          {!testeOk && aEnviar.length > 0 && (
            <p className="text-base text-amber-700">Faça o envio de teste (ou marque que já testou) para liberar o envio.</p>
          )}

          {confirmando && (
            <div className="flex flex-col gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200" role="alertdialog" aria-labelledby="confirmar-lote">
              <h3 id="confirmar-lote" className="text-xl font-semibold text-amber-900">
                Confirmar envio de {aEnviar.length} contrato(s)?
              </h3>
              <ul className="list-disc pl-6 text-base text-amber-900">
                <li>Cada aluno recebe o e-mail da Assinafy para assinar.</li>
                <li>
                  Usa {aEnviar.length} da cota — restarão {restantesDepois ?? "?"} neste mês.
                </li>
                {linhas.some((l) => l.decisao === "atualizar") && (
                  <li>
                    {linhas.filter((l) => l.decisao === "atualizar").length} contrato(s) existente(s) serão
                    atualizados com os dados novos e reenviados (não duplicados).
                  </li>
                )}
                {duplicados > 0 && <li>Revise as linhas marcadas como &quot;já tem contrato&quot; na tabela.</li>}
              </ul>
              <div className="flex flex-wrap gap-3">
                <button type="button" className={BTN_PRIMARY} onClick={enviarLote} disabled={estouraCota || comErro > 0}>
                  Sim, enviar agora
                </button>
                <button type="button" className={BTN_SECONDARY} onClick={() => setConfirmando(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {progresso && (
            <div className="flex flex-col gap-2">
              <p className="text-lg font-medium text-zinc-800" role="status">
                {enviando
                  ? `Enviando ${progresso.filter((p) => p.ok !== null).length + 1} de ${progresso.length}… não feche esta página.`
                  : "Envio concluído."}
              </p>
              <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full bg-[#2195B9] transition-all"
                  style={{ width: `${(progresso.filter((p) => p.ok !== null).length / progresso.length) * 100}%` }}
                />
              </div>
              <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                {progresso.map((p, i) => (
                  <li key={i} className="flex items-center gap-2 text-base">
                    {p.ok === null ? (
                      <Loader2 size={18} className={p.message === "Enviando…" ? "animate-spin text-[#2195B9]" : "text-zinc-300"} aria-hidden="true" />
                    ) : p.ok ? (
                      <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />
                    ) : (
                      <XCircle size={18} className="text-red-600" aria-hidden="true" />
                    )}
                    <span className="font-medium text-zinc-900">{p.nome}</span>
                    <span className="text-zinc-500">— {p.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {mensagem && (
        <p
          className={`rounded-xl px-4 py-3 text-lg ${mensagem.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
          role="status"
        >
          {mensagem.texto}
        </p>
      )}

      <PdfPreviewDialog pdf={pdf} onClose={() => setPdf(null)} />
    </div>
  );
}

function LinhaTabela({
  indice,
  linha,
  erros,
  avisos,
  pulada,
  desabilitado,
  previewCarregando,
  onCampo,
  onRemover,
  onPreview,
  onDecisao,
}: {
  indice: number;
  linha: Linha;
  erros: string[];
  avisos: string[];
  pulada: boolean;
  desabilitado: boolean;
  previewCarregando: boolean;
  onCampo: (campo: keyof AlunoContrato, valor: string) => void;
  onRemover: () => void;
  onPreview: () => void;
  onDecisao: (d: Decisao) => void;
}) {
  const temErro = erros.length > 0 && !pulada;
  const existente = linha.existente;
  return (
    <>
      <tr className={pulada ? "opacity-50" : ""}>
        <td className="px-1 align-top pt-3 text-base font-semibold text-zinc-500">{indice + 1}</td>
        {ALUNO_CAMPOS.map((c) => (
          <td key={c.campo} className="px-1 align-top">
            <input
              value={linha.aluno[c.campo]}
              onChange={(e) => onCampo(c.campo, e.target.value)}
              aria-label={`${c.label} — linha ${indice + 1}`}
              className={`${CELL_INPUT} ${
                c.campo === "endereco" ? "min-w-[260px]" : c.campo === "nome" || c.campo === "email" ? "min-w-[200px]" : "min-w-[120px]"
              } ${temErro && erros.some((e) => e.toLowerCase().includes(c.label.toLowerCase().split(" ")[0])) ? "border-red-400 bg-red-50" : ""}`}
              disabled={desabilitado}
            />
          </td>
        ))}
        <td className="px-1 align-top">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onPreview}
              disabled={desabilitado || previewCarregando}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100"
              aria-label={`Pré-visualizar contrato da linha ${indice + 1}`}
              title="Pré-visualizar PDF"
            >
              {previewCarregando ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />}
            </button>
            <button
              type="button"
              onClick={onRemover}
              disabled={desabilitado}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
              aria-label={`Remover linha ${indice + 1}`}
              title="Remover linha"
            >
              <X size={18} />
            </button>
          </div>
        </td>
      </tr>
      {(erros.length > 0 || avisos.length > 0 || existente) && (
        <tr>
          <td />
          <td colSpan={ALUNO_CAMPOS.length + 1} className="px-1 pb-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {!pulada &&
                erros.map((e) => (
                  <span key={e} className="flex items-center gap-1 font-medium text-red-700">
                    <XCircle size={15} aria-hidden="true" /> {e}
                  </span>
                ))}
              {avisos.map((a) => (
                <span key={a} className="flex items-center gap-1 text-amber-700">
                  <AlertTriangle size={15} aria-hidden="true" /> {a}
                </span>
              ))}
              {existente && (
                <span className="flex flex-wrap items-center gap-2 rounded-lg bg-sky-50 px-2 py-1 text-sky-900 ring-1 ring-sky-200">
                  Já tem contrato nº {existente.id} ({STATUS_LABEL[existente.status] ?? existente.status}) — {existente.aluno_nome}.
                  <select
                    value={linha.decisao ?? decisaoPadrao(existente)}
                    onChange={(e) => onDecisao(e.target.value as Decisao)}
                    className="min-h-9 rounded-md border border-sky-300 bg-white px-2 text-sm"
                    aria-label={`O que fazer com o contrato existente da linha ${indice + 1}`}
                    disabled={desabilitado}
                  >
                    {existente.status !== "assinado" && <option value="atualizar">Atualizar e reenviar o existente</option>}
                    <option value="pular">Pular este aluno</option>
                    <option value="novo">Criar outro contrato</option>
                  </select>
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
