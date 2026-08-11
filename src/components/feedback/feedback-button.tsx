"use client";

// src/components/feedback/feedback-button.tsx
// Botão flutuante de feedback (bug ou sugestão) exibido no canto inferior
// direito do dashboard. Captura a página atual e o navegador automaticamente
// para facilitar a reprodução do problema.
import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Bug, CheckCircle2, Lightbulb, MessageSquarePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { enviarFeedback, type FeedbackState } from "./actions";

const initialState: FeedbackState = { ok: false, message: "" };

type TipoFeedback = "bug" | "sugestao";

const OPCOES_TIPO: Array<{
  valor: TipoFeedback;
  rotulo: string;
  descricao: string;
  Icone: typeof Bug;
}> = [
  { valor: "bug", rotulo: "Bug", descricao: "Algo não funcionou", Icone: Bug },
  {
    valor: "sugestao",
    rotulo: "Sugestão",
    descricao: "Melhoria, implementação ou otimização",
    Icone: Lightbulb,
  },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-14 w-full rounded-lg bg-[#2195B9] px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Enviando..." : "Enviar feedback"}
    </button>
  );
}

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoFeedback>("sugestao");
  const [pagina, setPagina] = useState("");
  const [navegador, setNavegador] = useState("");
  const [state, formAction] = useActionState(enviarFeedback, initialState);
  const [formKey, setFormKey] = useState(0);

  // Captura a página atual e o navegador no momento do clique — assim o
  // registro reflete a tela em que o usuário estava ao abrir o diálogo.
  function openFeedback() {
    setPagina(window.location.pathname + window.location.search);
    setNavegador(window.navigator.userAgent);
    setOpen(true);
  }

  // Depois de enviar com sucesso, fecha o diálogo sozinho para o usuário
  // retomar o que estava fazendo.
  useEffect(() => {
    if (!state.ok) return;
    const timer = setTimeout(() => setOpen(false), 2200);
    return () => clearTimeout(timer);
  }, [state.ok]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Remonta o formulário para zerar campos, estado e mensagens.
      setFormKey((k) => k + 1);
      setTipo("sugestao");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openFeedback}
        aria-label="Reportar bug ou dar sugestão"
        title="Reportar bug ou dar sugestão"
        className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-[#2195B9] text-white shadow-[0_4px_16px_rgba(33,149,185,0.4)] transition-all hover:bg-[#28627B] hover:shadow-[0_6px_20px_rgba(33,149,185,0.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
      >
        <MessageSquarePlus size={26} aria-hidden="true" />
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl text-zinc-900">
              Fale com a gente
            </DialogTitle>
            <DialogDescription className="text-xl text-zinc-600">
              Encontrou um problema ou tem uma ideia de melhoria? Conte aqui —
              sua mensagem vai direto para o time que cuida do EctoDash.
            </DialogDescription>
          </DialogHeader>

          {state.ok ? (
            <div
              className="flex flex-col items-center gap-3 py-8 text-center"
              role="status"
            >
              <CheckCircle2 size={44} className="text-green-700" aria-hidden="true" />
              <p className="text-xl font-medium text-green-800">{state.message}</p>
            </div>
          ) : (
            <form
              key={formKey}
              action={formAction}
              className="flex flex-col gap-5"
              aria-live="polite"
            >
              <fieldset className="flex flex-col gap-2">
                <legend className="text-xl font-medium text-zinc-900">
                  O que é isso?
                </legend>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de feedback">
                  {OPCOES_TIPO.map(({ valor, rotulo, descricao, Icone }) => (
                    <button
                      key={valor}
                      type="button"
                      role="radio"
                      aria-checked={tipo === valor}
                      onClick={() => setTipo(valor)}
                      className={`flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-lg border-2 px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] ${
                        tipo === valor
                          ? "border-[#2195B9] bg-[#2195B9]/5"
                          : "border-zinc-300 bg-white hover:border-zinc-400"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-xl font-medium text-zinc-900">
                        <Icone
                          size={20}
                          aria-hidden="true"
                          className={tipo === valor ? "text-[#2195B9]" : "text-zinc-500"}
                        />
                        {rotulo}
                      </span>
                      <span className="text-base leading-snug text-zinc-600">
                        {descricao}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <input type="hidden" name="tipo" value={tipo} />
              <input type="hidden" name="pagina" value={pagina} />
              <input type="hidden" name="navegador" value={navegador} />

              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="feedback-mensagem"
                  className="text-xl font-medium text-zinc-900"
                >
                  Mensagem
                </Label>
                <textarea
                  id="feedback-mensagem"
                  name="mensagem"
                  required
                  minLength={5}
                  maxLength={2000}
                  rows={5}
                  placeholder={
                    tipo === "bug"
                      ? "O que aconteceu? Onde você estava na tela?"
                      : "O que você gostaria de ver no EctoDash?"
                  }
                  className="min-h-32 w-full rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
                />
              </div>

              <SubmitButton />

              {!state.ok && state.message && (
                <p className="text-base text-red-700">{state.message}</p>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
