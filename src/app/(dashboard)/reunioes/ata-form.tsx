"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { criarAta, type CriarAtaState } from "./actions";

const initialState: CriarAtaState = { ok: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="min-h-14 w-full rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Salvando..." : "Salvar ata"}
    </Button>
  );
}

export default function AtaForm() {
  const [state, formAction] = useActionState(criarAta, initialState);

  const inputClassName =
    "min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
  const labelClassName = "text-xl font-medium text-zinc-900";

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="titulo" className={labelClassName}>
          Título da reunião
        </label>
        <Input id="titulo" name="titulo" required className={inputClassName} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="data_reuniao" className={labelClassName}>
          Data
        </label>
        <Input
          id="data_reuniao"
          name="data_reuniao"
          type="date"
          required
          className={inputClassName}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="resumo" className={labelClassName}>
          Resumo ou ata (opcional)
        </label>
        <textarea
          id="resumo"
          name="resumo"
          rows={6}
          className="rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          placeholder="Principais pontos discutidos, decisões tomadas..."
        />
      </div>

      <SubmitButton />

      <div aria-live="polite" className="min-h-7 text-lg text-zinc-800">
        {state.message}
      </div>

      <Link
        href="/reunioes"
        className="min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-center text-xl font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        Voltar para as atas
      </Link>
    </form>
  );
}
