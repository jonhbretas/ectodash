"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPassword, type RecuperarSenhaState } from "./actions";

const initialState: RecuperarSenhaState = { ok: false, message: "" };

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
          Enviando...
        </>
      ) : (
        "Enviar link de redefinição"
      )}
    </Button>
  );
}

export default function RecuperarSenhaForm() {
  const [state, formAction] = useActionState(resetPassword, initialState);

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

      <SubmitButton />

      {state.ok ? (
        <div
          role="status"
          className="flex flex-col gap-1.5 rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-base text-green-900"
        >
          <p className="flex items-center gap-2 font-semibold">
            <MailCheck size={18} aria-hidden="true" />
            E-mail enviado!
          </p>
          <p>{state.message}</p>
        </div>
      ) : (
        <div aria-live="polite" className="min-h-7 text-base text-red-700">
          {state.message && !state.ok ? state.message : ""}
        </div>
      )}

      <p className="text-center text-sm text-slate-600">
        Lembrou a senha?{" "}
        <Link href="/login" className="font-medium text-[#2195B9] hover:underline">
          Faça login
        </Link>
      </p>
    </form>
  );
}
