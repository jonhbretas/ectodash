"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, ListPlus, CalendarDays, Clock, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { criarPauta, listarReunioesDisponiveis, type CriarPautaState, type ReuniaoDisponivel } from "./pauta-actions";
import { proximaTerca, HORARIO_REUNIAO } from "@/lib/proxima-reuniao";

const initialState: CriarPautaState = { ok: false, message: "" };

const WEEKDAY_ABBR = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatMeetingLabel(m: ReuniaoDisponivel): string {
  const d = new Date(`${m.data_reuniao}T00:00:00`);
  return `${WEEKDAY_ABBR[d.getDay()]}, ${d.getDate()} ${MONTH_ABBR[d.getMonth()]} · ${m.horario ? m.horario.slice(0, 5).replace(":", "h") : "19h00"} — ${m.titulo}`;
}

function proximaLabel(): string {
  const p = proximaTerca();
  const wd = WEEKDAY_ABBR[p.getDay()];
  return `${wd}, ${String(p.getDate()).padStart(2, "0")} ${MONTH_ABBR[p.getMonth()]} · ${HORARIO_REUNIAO.replace(":", "h")}`;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-5 text-base font-medium text-white shadow-[0_1px_3px_rgba(33,149,185,0.25)] transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:opacity-60"
    >
      {pending ? <Loader2 size={18} className="animate-spin" /> : <ListPlus size={18} />}
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
  const formRef = useRef<HTMLFormElement>(null);
  const [reunioes, setReunioes] = useState<ReuniaoDisponivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [reuniaoSel, setReuniaoSel] = useState("");
  const [showHorario, setShowHorario] = useState(false);
  const [tituloLen, setTituloLen] = useState(0);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listarReunioesDisponiveis().then((data) => {
      setReunioes(data);
      setLoading(false);
    });
  }, [open]);

  // toast simples
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (state.ok && state.message) {
      setToast(state.message);
      const t = setTimeout(() => setToast(null), 3000);
      onOpenChange(false);
      formRef.current?.reset();
      setReuniaoSel("");
      setTituloLen(0);
      setShowHorario(false);
      return () => clearTimeout(t);
    }
  }, [state, onOpenChange]);

  const inputClass = "min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-base text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white shadow-lg" role="status">
          {toast}
        </div>
      )}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg bg-white p-0 sm:max-w-[560px]">
          <DialogHeader className="px-6 pt-6 text-left">
            <DialogTitle className="text-xl font-semibold text-zinc-900">Pedir pauta</DialogTitle>
            <DialogDescription className="text-base text-zinc-600">Sugira um assunto para a próxima reunião. Todos os voluntários podem pedir.</DialogDescription>
          </DialogHeader>

          <form
            ref={formRef}
            action={(fd) => formAction(fd)}
            className="flex flex-col gap-4 px-6 pb-6"
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pauta-titulo-modal" className="text-sm font-medium text-zinc-900">
                Assunto <span className="text-red-600">*</span>
              </label>
              <input
                id="pauta-titulo-modal"
                name="titulo"
                required
                maxLength={80}
                autoFocus
                onChange={(e) => setTituloLen(e.target.value.length)}
                placeholder="Sobre o que você quer conversar?"
                className={inputClass}
              />
              <span className="text-right text-xs text-zinc-500">{tituloLen}/80</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="pauta-contexto-modal" className="text-sm font-medium text-zinc-900">
                Contexto (opcional)
              </label>
              <textarea
                id="pauta-contexto-modal"
                name="contexto"
                rows={3}
                maxLength={3000}
                placeholder="Detalhe o assunto para quem for mediar a reunião"
                className={`${inputClass} min-h-20 resize-y`}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="pauta-reuniao-modal" className="text-sm font-medium text-zinc-900">
                Reunião
              </label>
              {loading ? (
                <div className="flex min-h-12 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-500">
                  <Loader2 size={16} className="animate-spin" /> Carregando...
                </div>
              ) : (
                <div className="relative">
                  <select
                    id="pauta-reuniao-modal"
                    name="reuniao_selecionada_id"
                    value={reuniaoSel}
                    onChange={(e) => setReuniaoSel(e.target.value)}
                    className={`${inputClass} appearance-none pr-10`}
                  >
                    <option value="">Próxima reunião — {proximaLabel()}</option>
                    {reunioes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {formatMeetingLabel(r)}
                      </option>
                    ))}
                    <option value="espera">Sem preferência — entrar em espera</option>
                  </select>
                  <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                </div>
              )}
              <p className="text-xs text-zinc-500">Pré-selecionada: próxima terça às 19h. Escolha “Sem preferência” para deixar em espera.</p>
            </div>

            {!showHorario ? (
              <button type="button" onClick={() => setShowHorario(true)} className="self-start text-sm font-medium text-[#2195B9] hover:underline">
                Definir preferência de horário
              </button>
            ) : (
              <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <span className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                  <CalendarDays size={16} className="text-[#2195B9]" /> Quando prefere? (opcional)
                </span>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input type="date" name="data_solicitada" min={format(new Date(), "yyyy-MM-dd")} className={`${inputClass} sm:flex-1`} />
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-zinc-400" />
                    <input type="time" name="horario_solicitado" step={900} defaultValue="19:00" className={`${inputClass} sm:w-36`} />
                  </div>
                </div>
                <button type="button" onClick={() => setShowHorario(false)} className="self-start text-xs text-zinc-500 hover:text-zinc-700">
                  Ocultar
                </button>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={() => onOpenChange(false)} className="min-h-12 rounded-xl border border-zinc-300 bg-white px-5 text-base font-medium text-zinc-700 hover:bg-zinc-50">
                Cancelar
              </button>
              <SubmitButton />
            </div>

            {!state.ok && state.message && <p className="text-sm text-red-600" role="alert">{state.message}</p>}
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
