"use client";

// Self-service: troca da própria senha pelo perfil. Exige a senha atual
// (verificada na server action via signInWithPassword) antes de aplicar a
// nova — a autorização real está em alterarMinhaSenha.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { KeyRound, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { alterarMinhaSenha, type AlterarSenhaState } from "./actions";

const initialState: AlterarSenhaState = { ok: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#2195B9] px-4 py-2.5 text-lg font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (
        <>
          <Loader2 size={18} aria-hidden="true" className="animate-spin" />
          Alterando...
        </>
      ) : (
        <>
          <KeyRound size={18} aria-hidden="true" />
          Alterar senha
        </>
      )}
    </button>
  );
}

export default function AlterarSenhaForm() {
  const [state, formAction] = useActionState(alterarMinhaSenha, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" aria-live="polite">
      <div className="flex flex-col gap-2">
        <Label htmlFor="senha-atual" className="text-sm font-medium text-slate-700">
          Senha atual
        </Label>
        <Input
          id="senha-atual"
          name="senhaAtual"
          type="password"
          required
          autoComplete="current-password"
          className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-base text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="nova-senha" className="text-sm font-medium text-slate-700">
          Nova senha
        </Label>
        <Input
          id="nova-senha"
          name="novaSenha"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-base text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmacao" className="text-sm font-medium text-slate-700">
          Confirme a nova senha
        </Label>
        <Input
          id="confirmacao"
          name="confirmacao"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-base text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        />
      </div>
      <SubmitButton />
      <p
        aria-live="polite"
        className={`min-h-5 text-sm font-medium ${
          state.ok ? "text-green-700" : "text-red-700"
        }`}
      >
        {state.message}
      </p>
    </form>
  );
}
