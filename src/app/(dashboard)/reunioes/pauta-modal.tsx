"use client";

// "Pedir pauta" em 6 etapas (D-01): assunto+contexto, reunião, prioridade,
// tipo, anexo opcional e revisão. Um único <form> com useActionState(criarPauta)
// mantém a ligação com a server action; Enter avança nas etapas 1-5 e só a
// etapa 6 envia. O anexo (D-02) é enviado ao Drive depois que a pauta existe.
import { useActionState, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, ListPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  buscarPautasSimilares,
  criarPauta,
  listarReunioesDisponiveis,
  type CriarPautaState,
  type PautaSimilar,
  type ReuniaoDisponivel,
} from "./pauta-actions";
import { validarAnexo } from "@/lib/pautas/anexo";
import type { PautaPrioridade, PautaTipo } from "@/lib/pautas/regras";
import { enviarAnexoPauta } from "./_lib/enviar-anexo";
import {
  EtapaAnexo,
  EtapaAssunto,
  EtapaPrioridade,
  EtapaReuniao,
  EtapaRevisao,
  EtapaTipo,
  NOMES_ETAPAS,
  formatMeetingLabel,
  proximaLabel,
} from "./_components/pauta-wizard-etapas";

const initialState: CriarPautaState = { ok: false, message: "" };
const TOTAL_ETAPAS = NOMES_ETAPAS.length;

const botaoPrimario =
  "flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#1d6f8d] px-6 text-lg font-semibold text-white shadow-[0_1px_3px_rgba(33,149,185,0.25)] transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:opacity-60";
const botaoSecundario =
  "flex min-h-14 items-center justify-center rounded-xl border-2 border-zinc-400 bg-white px-6 text-lg font-semibold text-zinc-800 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";

function BotaoEnviar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={botaoPrimario}>
      {pending ? <Loader2 size={22} className="animate-spin" aria-hidden="true" /> : <ListPlus size={22} aria-hidden="true" />}
      {pending ? "Enviando..." : "Enviar pauta"}
    </button>
  );
}

type PautaModalProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export default function PautaModal({ open, onOpenChange }: PautaModalProps) {
  const [state, formAction] = useActionState(criarPauta, initialState);

  const [etapa, setEtapa] = useState(1);
  const [titulo, setTitulo] = useState("");
  const [contexto, setContexto] = useState("");
  const [reuniaoSel, setReuniaoSel] = useState("");
  const [showHorario, setShowHorario] = useState(false);
  const [dataSolicitada, setDataSolicitada] = useState("");
  const [horarioSolicitado, setHorarioSolicitado] = useState("19:00");
  const [prioridade, setPrioridade] = useState<PautaPrioridade>("media");
  const [tipo, setTipo] = useState<PautaTipo>("informativa");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erroEtapa, setErroEtapa] = useState<string | null>(null);

  const [reunioesCarregadas, setReunioesCarregadas] = useState<ReuniaoDisponivel[] | null>(null);
  const reunioes = reunioesCarregadas ?? [];
  const loading = reunioesCarregadas === null;
  const [similares, setSimilares] = useState<PautaSimilar[]>([]);
  const [erroDispensado, setErroDispensado] = useState(false);

  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const tituloEtapaRef = useRef<HTMLHeadingElement>(null);
  const etapaAnteriorRef = useRef(1);
  const tratadoRef = useRef<number | null>(null);
  const arquivoRef = useRef<File | null>(null);

  useEffect(() => {
    arquivoRef.current = arquivo;
  }, [arquivo]);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    listarReunioesDisponiveis().then((data) => {
      if (!cancelado) setReunioesCarregadas(data);
    });
    return () => {
      cancelado = true;
    };
  }, [open]);

  // Foco no título da etapa a cada mudança (leitores de tela + teclado).
  useEffect(() => {
    if (etapaAnteriorRef.current !== etapa) {
      tituloEtapaRef.current?.focus();
      etapaAnteriorRef.current = etapa;
    }
  }, [etapa]);

  // Ao chegar na revisão, avisa (sem bloquear) sobre pautas parecidas.
  useEffect(() => {
    if (etapa !== TOTAL_ETAPAS) return;
    let cancelado = false;
    buscarPautasSimilares(titulo).then((r) => {
      if (!cancelado) setSimilares(r);
    });
    return () => {
      cancelado = true;
    };
  }, [etapa, titulo]);

  const reiniciar = useCallback(() => {
    setEtapa(1);
    etapaAnteriorRef.current = 1;
    setTitulo("");
    setContexto("");
    setReuniaoSel("");
    setShowHorario(false);
    setDataSolicitada("");
    setHorarioSolicitado("19:00");
    setPrioridade("media");
    setTipo("informativa");
    setArquivo(null);
    setErroEtapa(null);
    setSimilares([]);
    setErroDispensado(true);
    setEnviandoAnexo(false);
    setProgresso(0);
  }, []);

  const fechar = useCallback(() => {
    reiniciar();
    onOpenChange(false);
  }, [onOpenChange, reiniciar]);

  const mostrarToast = useCallback((mensagem: string) => {
    setToast(mensagem);
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Pauta criada: envia o anexo (se houver) e só então fecha o assistente.
  useEffect(() => {
    if (!state.ok || !state.pautaId) return;
    if (tratadoRef.current === state.pautaId) return;
    tratadoRef.current = state.pautaId;
    const pautaId = state.pautaId;
    const mensagem = state.message;
    const arq = arquivoRef.current;

    if (!arq) {
      fechar();
      mostrarToast(mensagem);
      return;
    }

    setEnviandoAnexo(true);
    setProgresso(0);
    enviarAnexoPauta(pautaId, arq, setProgresso).then((r) => {
      fechar();
      mostrarToast(
        r.ok
          ? mensagem
          : `Pauta enviada, mas o anexo não foi salvo: ${r.message} Você pode anexar depois pelo cartão da pauta.`
      );
    });
  }, [state, fechar, mostrarToast]);

  function validarEtapaAtual(): string | null {
    if (etapa === 1) {
      const t = titulo.trim();
      if (t.length < 1) return "Descreva o assunto da pauta.";
      if (t.length > 80) return "O assunto pode ter no máximo 80 letras.";
      if (contexto.length > 3000) return "O contexto pode ter no máximo 3000 letras.";
    }
    if (etapa === 5 && arquivo) {
      return validarAnexo({ nome: arquivo.name, tamanho: arquivo.size });
    }
    return null;
  }

  function avancar() {
    const erro = validarEtapaAtual();
    setErroEtapa(erro);
    if (erro) return;
    setEtapa((e) => Math.min(TOTAL_ETAPAS, e + 1));
  }

  function voltar() {
    setErroEtapa(null);
    setEtapa((e) => Math.max(1, e - 1));
  }

  function irParaEtapa(n: number) {
    setErroEtapa(null);
    setEtapa(n);
  }

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    if (etapa < TOTAL_ETAPAS) {
      e.preventDefault();
      avancar();
      return;
    }
    setErroDispensado(false);
  }

  const reuniaoSelecionada = reunioes.find((r) => String(r.id) === reuniaoSel);
  const reuniaoRotulo =
    reuniaoSel === "espera"
      ? "Sem preferência — entra em espera"
      : reuniaoSelecionada
        ? formatMeetingLabel(reuniaoSelecionada)
        : `Próxima reunião — ${proximaLabel()}`;
  const dataHorarioRotulo =
    showHorario && dataSolicitada
      ? `Preferência: ${dataSolicitada.split("-").reverse().join("/")}${horarioSolicitado ? ` às ${horarioSolicitado}` : ""}`
      : null;

  return (
    <>
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-xl bg-zinc-900 px-5 py-4 text-base font-medium text-white shadow-lg"
          role="status"
        >
          {toast}
        </div>
      )}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (v) {
            onOpenChange(true);
            return;
          }
          if (enviandoAnexo) return; // não fecha no meio do envio do anexo
          fechar();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-white p-0 sm:max-w-[620px]">
          <DialogHeader className="px-6 pt-6 text-left">
            <DialogTitle className="text-2xl font-semibold text-zinc-900">Pedir pauta</DialogTitle>
            <DialogDescription className="text-base text-zinc-700">
              Sugira um assunto para a reunião de terça às 19h. Todos os voluntários podem pedir.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6">
            <p className="text-base font-semibold text-zinc-900" aria-live="polite">
              Etapa {etapa} de {TOTAL_ETAPAS} — {NOMES_ETAPAS[etapa - 1]}
            </p>
            <div
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={TOTAL_ETAPAS}
              aria-valuenow={etapa}
              aria-label={`Progresso do pedido de pauta: etapa ${etapa} de ${TOTAL_ETAPAS}`}
              className="mt-2 h-3 w-full overflow-hidden rounded-full bg-zinc-200"
            >
              <div
                className="h-full rounded-full bg-[#1d6f8d] transition-all"
                style={{ width: `${(etapa / TOTAL_ETAPAS) * 100}%` }}
              />
            </div>
          </div>

          <form action={(fd) => formAction(fd)} onSubmit={aoEnviar} className="flex flex-col gap-6 px-6 pb-6">
            <input type="hidden" name="titulo" value={titulo.trim()} />
            <input type="hidden" name="contexto" value={contexto.trim()} />
            <input type="hidden" name="reuniao_selecionada_id" value={reuniaoSel} />
            <input type="hidden" name="prioridade" value={prioridade} />
            <input type="hidden" name="tipo" value={tipo} />
            {showHorario && dataSolicitada && <input type="hidden" name="data_solicitada" value={dataSolicitada} />}
            {showHorario && horarioSolicitado && (
              <input type="hidden" name="horario_solicitado" value={horarioSolicitado} />
            )}

            {enviandoAnexo ? (
              <div className="flex flex-col gap-3 py-6" role="status" aria-live="polite">
                <p className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
                  <Loader2 size={22} className="animate-spin" aria-hidden="true" />
                  Enviando anexo… {progresso}%
                </p>
                <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-200">
                  <div className="h-full rounded-full bg-[#1d6f8d] transition-all" style={{ width: `${progresso}%` }} />
                </div>
                <p className="text-base text-zinc-700">Sua pauta já foi criada. Aguarde só mais um instante.</p>
              </div>
            ) : (
              <>
                <h3
                  ref={tituloEtapaRef}
                  tabIndex={-1}
                  className="text-xl font-semibold text-zinc-900 outline-none"
                >
                  {NOMES_ETAPAS[etapa - 1]}
                </h3>

                {etapa === 1 && (
                  <EtapaAssunto
                    titulo={titulo}
                    setTitulo={setTitulo}
                    contexto={contexto}
                    setContexto={setContexto}
                    erro={erroEtapa}
                  />
                )}
                {etapa === 2 && (
                  <EtapaReuniao
                    loading={loading}
                    reunioes={reunioes}
                    reuniaoSel={reuniaoSel}
                    setReuniaoSel={setReuniaoSel}
                    showHorario={showHorario}
                    setShowHorario={setShowHorario}
                    dataSolicitada={dataSolicitada}
                    setDataSolicitada={setDataSolicitada}
                    horarioSolicitado={horarioSolicitado}
                    setHorarioSolicitado={setHorarioSolicitado}
                  />
                )}
                {etapa === 3 && <EtapaPrioridade valor={prioridade} setValor={setPrioridade} />}
                {etapa === 4 && <EtapaTipo valor={tipo} setValor={setTipo} />}
                {etapa === 5 && <EtapaAnexo arquivo={arquivo} setArquivo={(f) => { setArquivo(f); setErroEtapa(null); }} erro={erroEtapa} />}
                {etapa === 6 && (
                  <EtapaRevisao
                    titulo={titulo.trim()}
                    contexto={contexto}
                    reuniaoRotulo={reuniaoRotulo}
                    dataHorarioRotulo={dataHorarioRotulo}
                    prioridade={prioridade}
                    tipo={tipo}
                    arquivo={arquivo}
                    similares={similares}
                    onEditar={irParaEtapa}
                  />
                )}

                {etapa === TOTAL_ETAPAS && !erroDispensado && !state.ok && state.message && (
                  <p className="flex items-center gap-2 text-base font-medium text-red-700" role="alert">
                    {state.message}
                  </p>
                )}

                <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  {etapa === 1 ? (
                    <button key="cancelar" type="button" onClick={fechar} className={botaoSecundario}>
                      Cancelar
                    </button>
                  ) : (
                    <button key="voltar" type="button" onClick={voltar} className={botaoSecundario}>
                      Voltar
                    </button>
                  )}
                  {etapa < TOTAL_ETAPAS ? (
                    <button key="avancar" type="submit" className={botaoPrimario}>
                      Avançar
                    </button>
                  ) : (
                    <BotaoEnviar key="enviar" />
                  )}
                </div>
              </>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Trigger button (usado no header e FAB mobile)
export function PedirPautaTrigger({ className, variant = "primary" }: { className?: string; variant?: "primary" | "fab" }) {
  const [open, setOpen] = useState(false);
  if (variant === "fab") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Pedir pauta"
          className={`fixed bottom-6 right-6 z-30 flex size-14 items-center justify-center rounded-full bg-[#2195B9] text-white shadow-[0_4px_16px_rgba(33,149,185,0.4)] hover:bg-[#28627B] lg:hidden ${className ?? ""}`}
        >
          <ListPlus size={26} />
        </button>
        <PautaModal open={open} onOpenChange={setOpen} />
      </>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-5 text-xl font-medium text-white shadow-[0_1px_3px_rgba(33,149,185,0.25)] hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] ${className ?? ""}`}
      >
        <ListPlus size={22} /> Pedir pauta
      </button>
      <PautaModal open={open} onOpenChange={setOpen} />
    </>
  );
}
