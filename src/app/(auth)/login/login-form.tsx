"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestMagicLink, type LoginState } from "./actions";

const initialState: LoginState = { ok: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      // Full original className passed as an override: shadcn's Button
      // default variant/size already resolves bg-primary/min-h-14/text-xl
      // to this project's edited accessibility floor (Plan 03-01), but its
      // rounded-md/ring-based focus-visible/hover-opacity defaults differ
      // from this already-shipped, already-verified surface's rounded-lg/
      // outline-based focus/hover-shade treatment. twMerge (via `cn`)
      // resolves the conflicting utilities in favor of this className,
      // reproducing byte-identical computed output (03-UI-SPEC.md
      // "componentize losslessly, restyle minimally").
      className="min-h-14 w-full rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Enviando..." : "Enviar link de acesso"}
    </Button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useActionState(requestMagicLink, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-xl font-medium text-zinc-900">
          E-mail institucional
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          // Same override rationale as SubmitButton above — reproduces the
          // exact pre-retrofit rounded-lg/bg-white/border-zinc-400/outline-based
          // focus-visible treatment via twMerge, over shadcn's rounded-md/
          // bg-transparent/border-input/ring-based defaults.
          className="min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        />
      </div>
      <SubmitButton />
      <div aria-live="polite" className="min-h-7 text-lg text-zinc-800">
        {state.message}
      </div>
    </form>
  );
}
