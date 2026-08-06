"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updatePassword, type UpdatePasswordState } from "./actions";

const initialState: UpdatePasswordState = { ok: false, message: "" };

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
          Salvando...
        </>
      ) : (
        "Redefinir senha"
      )}
    </Button>
  );
}

export default function UpdatePasswordForm() {
  const [state, formAction] = useActionState(updatePassword, initialState);

  if (state.ok) {
    return (
      <main className="flex min-h-dvh flex-1 items-center justify-center bg-gradient-to-br from-slate-50 via-white to-[#E6E6E6]/20">
        <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60 text-center">
          <CheckCircle2 size={48} className="text-green-500" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Senha redefinida!
          </h1>
          <p className="text-slate-600">
            Sua senha foi atualizada com sucesso. Agora você pode fazer login com a nova senha.
          </p>
          <Link
            href="/login"
            className="flex min-h-14 items-center justify-center rounded-lg bg-[#2195B9] px-6 py-3 text-lg font-medium text-white transition-colors hover:bg-[#28627B]"
          >
            Ir para o login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-gradient-to-br from-slate-50 via-white to-[#E6E6E6]/20">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Redefinir senha
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Digite sua nova senha abaixo.
          </p>
        </div>
        <div className="w-full rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60">
          <form action={formAction} className="flex w-full flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-xl font-medium text-zinc-900">
                Nova senha
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="confirm-password" className="text-xl font-medium text-zinc-900">
                Confirme a nova senha
              </label>
              <Input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
                className={inputClass}
              />
            </div>

            <SubmitButton />

            <div aria-live="polite" className="min-h-7 text-base text-red-700">
              {state.message && !state.ok ? state.message : ""}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
