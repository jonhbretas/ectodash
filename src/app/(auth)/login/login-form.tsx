"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn, type LoginState } from "./actions";

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
          Entrando...
        </>
      ) : (
        "Entrar"
      )}
    </Button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-xl font-medium text-zinc-900">
          E-mail
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-xl font-medium text-zinc-900">
          Senha
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </div>

      <div className="flex justify-end">
        <Link
          href="/recuperar-senha"
          className="text-sm font-medium text-[#2195B9] hover:underline"
        >
          Esqueceu a senha?
        </Link>
      </div>

      <SubmitButton />

      <div aria-live="polite" className="min-h-7 text-base text-red-700">
        {state.message && !state.ok ? state.message : ""}
      </div>

      <p className="text-center text-sm text-slate-600">
        Não tem uma conta?{" "}
        <Link href="/cadastro" className="font-medium text-[#2195B9] hover:underline">
          Cadastre-se
        </Link>
      </p>
    </form>
  );
}
