"use client";

import { useActionState, useState } from "react";
import type { FormEvent } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUp, type CadastroState } from "./actions";

const initialState: CadastroState = { ok: false, message: "" };

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
          Criando conta...
        </>
      ) : (
        "Criar conta"
      )}
    </Button>
  );
}

export default function CadastroForm() {
  const [state, formAction] = useActionState(signUp, initialState);
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    email?: string;
    confirmEmail?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  function validate(): boolean {
    const newErrors: typeof errors = {};

    if (!email.trim()) {
      newErrors.email = "Digite seu e-mail.";
    }

    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      newErrors.confirmEmail = "Os e-mails não conferem.";
    }

    if (password.length < 8) {
      newErrors.password = "A senha deve ter pelo menos 8 caracteres.";
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "As senhas não conferem.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-4">
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${inputClass} ${errors.email ? "border-red-500 ring-2 ring-red-200" : ""}`}
        />
        {errors.email && <p className="text-base font-medium text-red-600">{errors.email}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirm-email" className="text-xl font-medium text-zinc-900">
          Confirme o e-mail
        </label>
        <Input
          id="confirm-email"
          name="confirmEmail"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          className={`${inputClass} ${errors.confirmEmail ? "border-red-500 ring-2 ring-red-200" : ""}`}
        />
        {errors.confirmEmail && <p className="text-base font-medium text-red-600">{errors.confirmEmail}</p>}
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${inputClass} ${errors.password ? "border-red-500 ring-2 ring-red-200" : ""}`}
        />
        {errors.password && <p className="text-base font-medium text-red-600">{errors.password}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirm-password" className="text-xl font-medium text-zinc-900">
          Confirme a senha
        </label>
        <Input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={`${inputClass} ${errors.confirmPassword ? "border-red-500 ring-2 ring-red-200" : ""}`}
        />
        {errors.confirmPassword && (
          <p className="text-base font-medium text-red-600">{errors.confirmPassword}</p>
        )}
      </div>

      <SubmitButton />

      {state.ok ? (
        <div
          role="status"
          className="flex flex-col gap-1.5 rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-base text-green-900"
        >
          <p className="flex items-center gap-2 font-semibold">
            <MailCheck size={18} aria-hidden="true" />
            Conta criada com sucesso!
          </p>
          <p>{state.message}</p>
        </div>
      ) : (
        <div aria-live="polite" className="min-h-7 text-base text-red-700">
          {state.message && !state.ok ? state.message : ""}
        </div>
      )}

      <p className="text-center text-sm text-slate-600">
        Já tem uma conta?{" "}
        <Link href="/login" className="font-medium text-[#2195B9] hover:underline">
          Faça login
        </Link>
      </p>
    </form>
  );
}
