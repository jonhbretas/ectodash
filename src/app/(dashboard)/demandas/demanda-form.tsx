"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createDemanda,
  updateDemanda,
  criarEtiqueta,
  type CreateDemandaState,
  type UpdateDemandaState,
} from "./actions";
import { demandaSchema, type DemandaFormValues } from "./demanda-schema";

const initialState: CreateDemandaState | UpdateDemandaState = {
  ok: false,
  message: "",
};

type Profile = {
  id: string;
  email: string;
  full_name?: string | null;
};

export type EventoOption = {
  id: number;
  titulo: string;
};

export type EtiquetaOption = {
  id: number;
  area: string;
  nome: string;
};

function SubmitButton({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();
  const pendingLabel = mode === "edit" ? "Salvando..." : "Criando...";
  const idleLabel = mode === "edit" ? "Salvar alterações" : "Criar demanda";

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-14 w-full rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

type DemandaFormProps = {
  profiles: Profile[];
  eventos: EventoOption[];
  etiquetas: EtiquetaOption[];
  mode?: "create" | "edit";
  demandaId?: number;
  defaultValues?: Partial<DemandaFormValues> & {
    eventoId?: number;
    etiquetaId?: number;
    membroIds?: string[];
  };
  // wide: desktop full-width layout (the edit screen's two-column grid);
  // the create screen stays at max-w-md.
  wide?: boolean;
};

export default function DemandaForm({
  profiles,
  eventos,
  etiquetas,
  mode = "create",
  demandaId,
  defaultValues,
  wide = false,
}: DemandaFormProps) {
  // One DemandaForm handles both modes via props — mode="edit" binds the
  // update action to a server-trusted demandaId via .bind(null, demandaId),
  // rather than forking a second form component (RESEARCH.md Pattern 5's
  // shared-schema intent extended to both mutation paths).
  const action = mode === "edit" ? updateDemanda.bind(null, demandaId!) : createDemanda;
  const [state, formAction] = useActionState(action, initialState);

  // Inline etiqueta creation: local option list seeded from the server
  // props; a created label is appended and selected immediately (no page
  // reload). The native etiquetaId select reads from this list.
  const [etiquetaOptions, setEtiquetaOptions] = useState(etiquetas);
  const [etiquetaId, setEtiquetaId] = useState(defaultValues?.etiquetaId ?? "");
  const [criandoEtiqueta, setCriandoEtiqueta] = useState(false);
  const [novaEtiquetaArea, setNovaEtiquetaArea] = useState("");
  const [novaEtiquetaNome, setNovaEtiquetaNome] = useState("");
  const [etiquetaError, setEtiquetaError] = useState("");

  async function handleCriarEtiqueta() {
    if (!novaEtiquetaArea.trim() || !novaEtiquetaNome.trim()) {
      setEtiquetaError("Preencha a área e o nome da etiqueta.");
      return;
    }
    setEtiquetaError("");
    const formData = new FormData();
    formData.set("area", novaEtiquetaArea.trim());
    formData.set("nome", novaEtiquetaNome.trim());
    const result = await criarEtiqueta(
      { ok: false, message: "", id: null },
      formData
    );
    if (result.ok && result.id) {
      const nova: EtiquetaOption = {
        id: result.id,
        area: novaEtiquetaArea.trim(),
        nome: novaEtiquetaNome.trim(),
      };
      setEtiquetaOptions((current) => [...current, nova]);
      setEtiquetaId(String(result.id));
      setCriandoEtiqueta(false);
      setNovaEtiquetaArea("");
      setNovaEtiquetaNome("");
    } else {
      setEtiquetaError(result.message);
    }
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DemandaFormValues>({
    resolver: zodResolver(demandaSchema),
    defaultValues: {
      status: "pendente",
      membroIds: defaultValues?.membroIds ?? [],
      ...defaultValues,
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
      className={`flex w-full flex-col gap-4 ${wide ? "" : "max-w-md"}`}
    >
      <p className="text-base text-zinc-600">
        Campos com * são obrigatórios.
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="titulo" className="text-xl font-medium text-zinc-900">
          Título *
        </Label>
        <Input
          id="titulo"
          type="text"
          placeholder="Ex: Revisar relatório mensal"
          className="rounded-lg border-zinc-400 bg-white text-zinc-900 shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 focus-visible:ring-0"
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
              {profile.full_name?.trim() || profile.email}
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
        <Label htmlFor="prazo" className="text-xl font-medium text-zinc-900">
          Prazo *
        </Label>
        <Input
          id="prazo"
          type="date"
          className="rounded-lg border-zinc-400 bg-white text-zinc-900 shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 focus-visible:ring-0"
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
          className="min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          {...register("status")}
        >
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluida">Concluída</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="area" className="text-xl font-medium text-zinc-900">
          Área
        </Label>
        <Input
          id="area"
          type="text"
          placeholder="Ex: Pesquisa de Campo"
          className="rounded-lg border-zinc-400 bg-white text-zinc-900 shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 focus-visible:ring-0"
          {...register("area")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="projeto" className="text-xl font-medium text-zinc-900">
          Projeto
        </Label>
        <Input
          id="projeto"
          type="text"
          placeholder="Ex: Projeto Horta Comunitária"
          className="rounded-lg border-zinc-400 bg-white text-zinc-900 shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 focus-visible:ring-0"
          {...register("projeto")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="eventoId" className="text-xl font-medium text-zinc-900">
          Evento (opcional)
        </label>
        {/* Uncontrolled native select — not registered with react-hook-form
            (eventoId is validated separately server-side via eventoIdSchema);
            the initial value comes from defaultValues when editing. */}
        <select
          id="eventoId"
          name="eventoId"
          defaultValue={String(defaultValues?.eventoId ?? "")}
          className="min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <option value="">Nenhum evento</option>
          {eventos.map((evento) => (
            <option key={evento.id} value={evento.id}>
              {evento.titulo}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="etiquetaId"
            className="text-xl font-medium text-zinc-900"
          >
            Etiqueta (opcional)
          </label>
          <button
            type="button"
            onClick={() => setCriandoEtiqueta((v) => !v)}
            className="text-base font-medium text-blue-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            {criandoEtiqueta ? "Cancelar" : "+ Nova etiqueta"}
          </button>
        </div>
        <select
          id="etiquetaId"
          name="etiquetaId"
          value={etiquetaId}
          onChange={(e) => setEtiquetaId(e.target.value)}
          className="min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <option value="">Nenhuma etiqueta</option>
          {etiquetaOptions.map((etiqueta) => (
            <option key={etiqueta.id} value={etiqueta.id}>
              {etiqueta.nome} ({etiqueta.area})
            </option>
          ))}
        </select>

        {criandoEtiqueta && (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3">
            <p className="text-base text-zinc-700">
              Toda etiqueta pertence a uma área — escolha a área e dê um
              nome (ex.: Comunicação, Vendas, Artes).
            </p>
            <input
              value={novaEtiquetaArea}
              onChange={(e) => setNovaEtiquetaArea(e.target.value)}
              placeholder="Área (ex.: Pesquisa)"
              className="min-h-12 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            />
            <input
              value={novaEtiquetaNome}
              onChange={(e) => setNovaEtiquetaNome(e.target.value)}
              placeholder="Nome da etiqueta (ex.: Comunicação)"
              className="min-h-12 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            />
            {etiquetaError && (
              <p className="text-base text-red-700">{etiquetaError}</p>
            )}
            <button
              type="button"
              onClick={handleCriarEtiqueta}
              className="min-h-12 rounded-lg bg-blue-700 px-4 text-lg font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Criar etiqueta
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="membroIds"
          className="text-xl font-medium text-zinc-900"
        >
          Membros / acompanhantes (opcional)
        </label>
        <select
          id="membroIds"
          multiple
          size={4}
          className="min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          {...register("membroIds")}
        >
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.full_name?.trim() || profile.email}
            </option>
          ))}
        </select>
        <p className="text-base text-zinc-700">
          Acompanhantes acompanham a demanda e recebem os mesmos lembretes
          por e-mail.
        </p>
      </div>

      <SubmitButton mode={mode} />

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
