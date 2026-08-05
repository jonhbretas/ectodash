"use client";

import { useActionState, useState } from "react";
import type { FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { ok: false, message: "" };

const inputClass =
  "min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#2195B9] px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (
        <>
          <Loader2 size={22} aria-hidden="true" className="animate-spin" />
          Enviando link...
        </>
      ) : (
        "Enviar link de acesso"
      )}
    </Button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useActionState(requestMagicLink, initialState);
  const [email, setEmail] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    setErroConfirmacao(null);
    if (email.trim().toLowerCase() !== confirmacao.trim().toLowerCase()) {
      evento.preventDefault();
      setErroConfirmacao(
        "Os e-mails não conferem. Digite o mesmo e-mail nos dois campos."
      );
      return;
    }
    setEnviadoPara(email.trim().toLowerCase());
  }

  return (
    <form
      action={formAction}
      onSubmit={aoEnviar}
      className="flex w-full max-w-md flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-xl font-medium text-zinc-900">
          E-mail principal
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirmacao-email" className="text-xl font-medium text-zinc-900">
          Confirme o e-mail
        </label>
        <Input
          id="confirmacao-email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          className={`${inputClass} ${
            erroConfirmacao ? "border-red-500 ring-2 ring-red-200" : ""
          }`}
          aria-invalid={Boolean(erroConfirmacao)}
        />
        {erroConfirmacao && (
          <p className="text-base font-medium text-red-600">{erroConfirmacao}</p>
        )}
      </div>

      <SubmitButton />

      {state.ok && enviadoPara ? (
        <div
          role="status"
          className="flex flex-col gap-1.5 rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-base text-green-900"
        >
          <p className="flex items-center gap-2 font-semibold">
            <MailCheck size={18} aria-hidden="true" />
            Link de acesso enviado!
          </p>
          <p>
            Verifique a caixa de entrada de{" "}
            <strong>{enviadoPara}</strong> e clique no link recebido. Se não
            encontrar, confira também as subpastas, como{" "}
            <strong>&quot;Atualizações&quot;</strong> ou{" "}
            <strong>&quot;Promoções&quot;</strong>.
          </p>
        </div>
      ) : (
        <div aria-live="polite" className="min-h-7 text-base text-red-700">
          {state.message && !state.ok ? state.message : ""}
        </div>
      )}
    </form>
  );
}
