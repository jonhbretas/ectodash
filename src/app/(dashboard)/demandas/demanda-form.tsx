"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createDemanda, type CreateDemandaState } from "./actions";
import { demandaSchema, type DemandaFormValues } from "./demanda-schema";

const initialState: CreateDemandaState = { ok: false, message: "" };

type Profile = {
  id: string;
  email: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-14 w-full rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Criando..." : "Criar demanda"}
    </button>
  );
}

export default function DemandaForm({ profiles }: { profiles: Profile[] }) {
  const [state, formAction] = useActionState(createDemanda, initialState);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DemandaFormValues>({
    resolver: zodResolver(demandaSchema),
    defaultValues: {
      status: "pendente",
    },
  });

  // Client-side validation runs first (react-hook-form + the shared zod
  // schema); only once it passes do we hand the native FormData off to the
  // Server Action, which re-validates the same schema server-side
  // (RESEARCH.md Pattern 5 — client and server can never silently
  // disagree, since both read from demandaSchema).
  const onValid = (
    _values: DemandaFormValues,
    event?: React.BaseSyntheticEvent
  ) => {
    const form = event?.target as HTMLFormElement | undefined;
    if (form) {
      formAction(new FormData(form));
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onValid)}
      className="flex w-full max-w-md flex-col gap-4"
    >
      <p className="text-base text-zinc-600">
        Campos com * são obrigatórios.
      </p>

      <div className="flex flex-col gap-2">
        <label htmlFor="titulo" className="text-xl font-medium text-zinc-900">
          Título *
        </label>
        <input
          id="titulo"
          type="text"
          placeholder="Ex: Revisar relatório mensal"
          className="min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          {...register("titulo")}
        />
        {errors.titulo && (
          <span className="text-base text-red-700">
            {errors.titulo.message}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="responsavelIds"
          className="text-xl font-medium text-zinc-900"
        >
          Responsável *
        </label>
        <select
          id="responsavelIds"
          multiple
          size={5}
          className="min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          {...register("responsavelIds")}
        >
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.email}
            </option>
          ))}
        </select>
        {errors.responsavelIds && (
          <span className="text-base text-red-700">
            {errors.responsavelIds.message}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="prazo" className="text-xl font-medium text-zinc-900">
          Prazo *
        </label>
        <input
          id="prazo"
          type="date"
          className="min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          {...register("prazo")}
        />
        {errors.prazo && (
          <span className="text-base text-red-700">
            {errors.prazo.message}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="status" className="text-xl font-medium text-zinc-900">
          Status
        </label>
        <select
          id="status"
          defaultValue="pendente"
          className="min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          {...register("status")}
        >
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluida">Concluída</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="area" className="text-xl font-medium text-zinc-900">
          Área ou projeto
        </label>
        <input
          id="area"
          type="text"
          placeholder="Ex: Pesquisa de Campo"
          className="min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          {...register("area")}
        />
      </div>

      <SubmitButton />

      <Link
        href="/"
        className="min-h-14 flex items-center justify-center rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        Cancelar
      </Link>

      <div aria-live="polite" className="min-h-7 text-lg text-zinc-800">
        {state.message}
      </div>
    </form>
  );
}
