"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import VoluntarioPicker from "@/components/voluntario-picker";
import { criarAta, type CriarAtaState } from "./actions";

const initialState: CriarAtaState = { ok: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="min-h-14 w-full rounded-lg bg-[#2195B9] px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Salvando..." : "Salvar ata"}
    </Button>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

export default function AtaForm({
  voluntarios = [],
}: {
  voluntarios?: { id: number; nome: string; temConta?: boolean }[];
}) {
  const [state, formAction] = useActionState(criarAta, initialState);
  const [participanteIds, setParticipanteIds] = useState<string[]>([]);

  const participantes = voluntarios.filter((v) =>
    participanteIds.includes(String(v.id))
  );

  function removeParticipante(id: string) {
    setParticipanteIds((current) => current.filter((x) => x !== id));
  }

  const inputClassName =
    "min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";
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
        <DateInput
          id="data_reuniao"
          name="data_reuniao"
          required
          className={inputClassName}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={labelClassName}>Participantes (opcional)</span>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-300 bg-white p-3">
          {participantes.length === 0 && (
            <span className="text-lg text-zinc-400">
              Nenhum participante vinculado
            </span>
          )}
          {participantes.map((v) => (
            <span
              key={v.id}
              className="group relative flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-1 text-base ring-1 ring-zinc-200/60"
            >
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E6E6E6] text-xs font-semibold text-[#2195B9]"
              >
                {initialsOf(v.nome)}
              </span>
              <span className="truncate text-zinc-700">{v.nome}</span>
              <button
                type="button"
                onClick={() => removeParticipante(String(v.id))}
                aria-label={`Remover ${v.nome}`}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-all hover:bg-red-50 hover:text-red-600"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
          <VoluntarioPicker
            voluntarios={voluntarios.map((v) => ({ ...v, id: String(v.id) }))}
            selectedIds={new Set(participanteIds)}
            onAdd={(id) => setParticipanteIds((current) => [...current, id])}
            label="participante"
          />
        </div>
        {participanteIds.map((id) => (
          <input key={id} type="hidden" name="voluntarioIds" value={id} />
        ))}
        <p className="text-base text-zinc-500">
          Vincule os participantes aos cadastros do roster — isso alimenta a
          métrica de participação no perfil de cada voluntário.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="resumo" className={labelClassName}>
          Resumo ou ata (opcional)
        </label>
        <textarea
          id="resumo"
          name="resumo"
          rows={6}
          className="rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          placeholder="Principais pontos discutidos, decisões tomadas..."
        />
      </div>

      <SubmitButton />

      <div aria-live="polite" className="min-h-7 text-lg text-zinc-800">
        {state.message}
      </div>

      <Link
        href="/reunioes"
        className="min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-center text-xl font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
      >
        Voltar para as atas
      </Link>
    </form>
  );
}
