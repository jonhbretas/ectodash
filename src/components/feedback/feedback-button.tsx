"use client";

// src/components/feedback/feedback-button.tsx
// Botão flutuante de feedback (bug ou sugestão) exibido no canto inferior
// direito do dashboard. Captura a página atual e o navegador automaticamente
// para facilitar a reprodução do problema, e aceita até 3 imagens anexadas
// (JPG, PNG, WebP ou GIF) — validadas no cliente e no servidor.
//
// Upload direto do navegador: as imagens vão do navegador ao bucket privado
// feedback-anexos via RLS (migration 0069) sem passar pela Vercel; a server
// action recebe apenas os caminhos já enviados e valida o formato antes de
// gravar na tabela feedback.
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useActionState } from "react";
import {
  Bug,
  CheckCircle2,
  ImagePlus,
  Lightbulb,
  MessageSquarePlus,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { enviarFeedback, type FeedbackState } from "./actions";

const initialState: FeedbackState = { ok: false, message: "" };

type TipoFeedback = "bug" | "sugestao";

const ANEXOS_MAX = 3;
const ANEXO_MAX_BYTES = 5 * 1024 * 1024;
const MIME_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const EXTENSAO_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Validação espelhada no servidor (actions.ts) — o usuário descobre erros
// antes de enviar, sem round-trip.
function anexosValidos(files: File[]): string | null {
  if (files.length > ANEXOS_MAX) {
    return `Você pode anexar no máximo ${ANEXOS_MAX} imagens por envio.`;
  }
  for (const arquivo of files) {
    if (!MIME_ACEITOS.includes(arquivo.type)) {
      return "Anexe apenas imagens (JPG, PNG, WebP ou GIF).";
    }
    if (arquivo.size > ANEXO_MAX_BYTES) {
      return "Cada imagem pode ter no máximo 5 MB.";
    }
  }
  return null;
}

// Envia as imagens direto do navegador ao bucket privado feedback-anexos.
// O RLS exige caminho {user_id}/... — quem não está autenticado falha aqui.
async function enviarAnexosParaStorage(
  files: File[]
): Promise<{ ok: true; caminhos: string[] } | { ok: false; erro: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, erro: "Sessão expirada. Entre novamente e tente de novo." };
  }

  const caminhos: string[] = [];
  for (const arquivo of files) {
    const caminho = `${user.id}/${crypto.randomUUID()}.${EXTENSAO_POR_MIME[arquivo.type]}`;
    const { error } = await supabase.storage
      .from("feedback-anexos")
      .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
    if (error) {
      if (caminhos.length > 0) {
        await supabase.storage.from("feedback-anexos").remove(caminhos);
      }
      return {
        ok: false,
        erro: "Não foi possível enviar as imagens. Tente novamente em instantes.",
      };
    }
    caminhos.push(caminho);
  }
  return { ok: true, caminhos };
}

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

function SubmitButton({ desabilitado }: { desabilitado: boolean }) {
  return (
    <button
      type="submit"
      disabled={desabilitado}
      className="min-h-14 w-full rounded-lg bg-[#2195B9] px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {desabilitado ? "Enviando..." : "Enviar feedback"}
    </button>
  );
}

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoFeedback>("sugestao");
  const [pagina, setPagina] = useState("");
  const [navegador, setNavegador] = useState("");
  const [state, formAction, isPending] = useActionState(enviarFeedback, initialState);
  const [formKey, setFormKey] = useState(0);
  const [anexos, setAnexos] = useState<File[]>([]);
  const [erroAnexos, setErroAnexos] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const caminhosEnviadosRef = useRef<string[]>([]);

  // Previews revogados quando a lista muda ou o diálogo fecha — evita vazamento
  // de memória com URLs de objeto.
  const previews = useMemo(
    () => anexos.map((arquivo) => URL.createObjectURL(arquivo)),
    [anexos]
  );
  useEffect(() => {
    return () => previews.forEach(URL.revokeObjectURL);
  }, [previews]);

  // Se a server action rejeitar o envio, apaga as imagens que já subiram para
  // o bucket — evita arquivos órfãos num bucket que ninguém administra.
  useEffect(() => {
    if (state.ok || !state.message) return;
    const caminhos = caminhosEnviadosRef.current;
    if (caminhos.length === 0) return;
    caminhosEnviadosRef.current = [];
    createClient().storage.from("feedback-anexos").remove(caminhos);
  }, [state]);

  function selecionarAnexos(event: ChangeEvent<HTMLInputElement>) {
    const novos = Array.from(event.target.files ?? []);
    const todos = [...anexos, ...novos];
    const erro = anexosValidos(todos);
    setErroAnexos(erro);
    event.target.value = "";
    if (!erro) setAnexos(todos);
  }

  function removerAnexo(indice: number) {
    setErroAnexos(null);
    setAnexos(anexos.filter((_, i) => i !== indice));
  }

  // Captura a página atual e o navegador no momento do clique — assim o
  // registro reflete a tela em que o usuário estava ao abrir o diálogo.
  function openFeedback() {
    setPagina(window.location.pathname + window.location.search);
    setNavegador(window.navigator.userAgent);
    setOpen(true);
  }

  // Intercepta o submit: primeiro envia as imagens ao bucket (direto do
  // navegador), depois chama a server action com apenas os caminhos.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (anexos.length === 0) {
      formAction(new FormData(event.currentTarget));
      return;
    }
    setEnviando(true);
    const resultado = await enviarAnexosParaStorage(anexos);
    if (!resultado.ok) {
      setEnviando(false);
      setErroAnexos(resultado.erro);
      return;
    }
    caminhosEnviadosRef.current = resultado.caminhos;
    const formData = new FormData(event.currentTarget);
    formData.set("anexos", JSON.stringify(resultado.caminhos));
    formAction(formData);
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
      setAnexos([]);
      setErroAnexos(null);
      setEnviando(false);
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
              onSubmit={handleSubmit}
              className="flex flex-col gap-5"
              aria-live="polite"
            >
              <fieldset className="flex flex-col gap-2">
                <legend className="text-xl font-medium text-zinc-900">
                  O que é isso?
                </legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de feedback">
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

              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="feedback-anexos"
                  className="text-xl font-medium text-zinc-900"
                >
                  Imagens (opcional)
                </Label>
                <input
                  id="feedback-anexos"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  onChange={selecionarAnexos}
                  className="block w-full cursor-pointer rounded-lg border border-zinc-400 bg-white text-lg text-zinc-700 file:mr-4 file:rounded-lg file:border-0 file:bg-[#2195B9] file:px-4 file:py-2.5 file:text-lg file:font-medium file:text-white hover:file:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
                />
                <p className="flex items-center gap-1.5 text-base text-zinc-500">
                  <ImagePlus size={16} aria-hidden="true" />
                  Até {ANEXOS_MAX} imagens (JPG, PNG, WebP ou GIF), 5 MB cada — útil
                  para mostrar o que aconteceu na tela.
                </p>
                {anexos.length > 0 && (
                  <ul className="grid grid-cols-3 gap-2" aria-label="Imagens anexadas">
                    {anexos.map((arquivo, indice) => (
                      <li
                        key={`${arquivo.name}-${indice}`}
                        className="relative"
                        aria-label={arquivo.name}
                      >
                        <img
                          src={previews[indice]}
                          alt={`Anexo ${indice + 1}: ${arquivo.name}`}
                          className="h-20 w-full rounded-lg border border-zinc-300 bg-zinc-100 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removerAnexo(indice)}
                          aria-label={`Remover anexo ${arquivo.name}`}
                          className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-zinc-900 text-white shadow transition-colors hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {erroAnexos && (
                  <p role="alert" className="text-base text-red-700">
                    {erroAnexos}
                  </p>
                )}
              </div>

              <SubmitButton desabilitado={isPending || enviando} />

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
