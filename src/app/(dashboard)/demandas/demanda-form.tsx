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

export type VoluntarioOption = {
  id: number;
  nome: string;
  // false = cadastrado no roster, mas ainda sem conta ativada.
  temConta: boolean;
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
      className="min-h-14 w-full rounded-xl bg-blue-700 px-4 py-3 text-xl font-medium text-white shadow-[0_1px_3px_rgba(29,78,216,0.25)] transition-all duration-200 hover:bg-blue-600 hover:shadow-[0_2px_6px_rgba(29,78,216,0.3)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

type DemandaFormProps = {
  voluntarios: VoluntarioOption[];
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

const fieldLabelClass = "text-xl font-medium text-zinc-900";
const fieldInputClass =
  "min-h-14 rounded-xl border-zinc-200 bg-white text-zinc-900 shadow-none transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 focus-visible:ring-0";
const errorClass = "text-base text-red-600";

export default function DemandaForm({
  voluntarios,
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

  const cardClass =
    "flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60";
  const sectionTitleClass = "text-base font-semibold text-zinc-400 uppercase tracking-wider";

  if (wide) {
    return (
      <form onSubmit={handleSubmit(onValid)} className="flex w-full flex-col gap-8">
        <p className="text-base text-zinc-500">
          Campos com * são obrigatórios.
        </p>

        {/* === Primário: Título e Prazo === */}
        <div className={cardClass}>
          <h3 className={sectionTitleClass}>Informações básicas</h3>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="titulo" className={fieldLabelClass}>
                Título *
              </Label>
              <Input
                id="titulo"
                type="text"
                placeholder="Ex: Revisar relatório mensal"
                className={fieldInputClass}
                {...register("titulo")}
              />
              {errors.titulo && (
                <span className={errorClass}>{errors.titulo.message}</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prazo" className={fieldLabelClass}>
                Prazo *
              </Label>
              <Input
                id="prazo"
                type="date"
                className={fieldInputClass}
                {...register("prazo")}
              />
              {errors.prazo && (
                <span className={errorClass}>{errors.prazo.message}</span>
              )}
            </div>
          </div>
        </div>

        {/* === Responsáveis e Membros === */}
        <div className={cardClass}>
          <h3 className={sectionTitleClass}>Pessoas</h3>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="responsavelIds" className={fieldLabelClass}>
                Responsável *
              </label>
              <select
                id="responsavelIds"
                multiple
                size={5}
                className="min-h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                {...register("responsavelIds")}
              >
                {voluntarios.map((voluntario) => (
                  <option key={voluntario.id} value={String(voluntario.id)}>
                    {voluntario.nome}{!voluntario.temConta ? ' (sem acesso)' : ''}
                  </option>
                ))}
              </select>
              {errors.responsavelIds && (
                <span className={errorClass}>{errors.responsavelIds.message}</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="membroIds" className={fieldLabelClass}>
                Membros / acompanhantes (opcional)
              </label>
              <select
                id="membroIds"
                multiple
                size={5}
                className="min-h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                {...register("membroIds")}
              >
                {voluntarios.map((voluntario) => (
                  <option key={voluntario.id} value={String(voluntario.id)}>
                    {voluntario.nome}{!voluntario.temConta ? ' (sem acesso)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-base text-zinc-500">
                Acompanhantes acompanham a demanda e recebem os mesmos
                lembretes por e-mail.
              </p>
            </div>
          </div>
        </div>

        {/* === Classificação === */}
        <div className={cardClass}>
          <h3 className={sectionTitleClass}>Classificação</h3>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="area" className={fieldLabelClass}>
                Área
              </Label>
              <Input
                id="area"
                type="text"
                placeholder="Ex: Pesquisa de Campo"
                className={fieldInputClass}
                {...register("area")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="projeto" className={fieldLabelClass}>
                Projeto
              </Label>
              <Input
                id="projeto"
                type="text"
                placeholder="Ex: Projeto Horta Comunitária"
                className={fieldInputClass}
                {...register("projeto")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="eventoId" className={fieldLabelClass}>
                Evento (opcional)
              </label>
              <select
                id="eventoId"
                name="eventoId"
                defaultValue={String(defaultValues?.eventoId ?? "")}
                className="min-h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <option value="">Nenhum evento</option>
                {eventos.map((evento) => (
                  <option key={evento.id} value={evento.id}>
                    {evento.titulo}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="etiquetaId" className={fieldLabelClass}>
                  Etiqueta (opcional)
                </label>
                <button
                  type="button"
                  onClick={() => setCriandoEtiqueta((v) => !v)}
                  className="text-base font-medium text-blue-700 transition-colors hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  {criandoEtiqueta ? "Cancelar" : "+ Nova etiqueta"}
                </button>
              </div>
              <select
                id="etiquetaId"
                name="etiquetaId"
                value={etiquetaId}
                onChange={(e) => setEtiquetaId(e.target.value)}
                className="min-h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <option value="">Nenhuma etiqueta</option>
                {etiquetaOptions.map((etiqueta) => (
                  <option key={etiqueta.id} value={etiqueta.id}>
                    {etiqueta.nome} ({etiqueta.area})
                  </option>
                ))}
              </select>

              {criandoEtiqueta && (
                <div className="mt-1 flex flex-col gap-3 rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200/60">
                  <p className="text-base text-zinc-600">
                    Toda etiqueta pertence a uma área — escolha a área e dê
                    um nome (ex.: Comunicação, Vendas, Artes).
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      value={novaEtiquetaArea}
                      onChange={(e) => setNovaEtiquetaArea(e.target.value)}
                      placeholder="Área (ex.: Pesquisa)"
                      className="min-h-12 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-lg text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    />
                    <input
                      value={novaEtiquetaNome}
                      onChange={(e) => setNovaEtiquetaNome(e.target.value)}
                      placeholder="Nome da etiqueta (ex.: Comunicação)"
                      className="min-h-12 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-lg text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    />
                  </div>
                  {etiquetaError && (
                    <p className="text-base text-red-600">{etiquetaError}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleCriarEtiqueta}
                    className="min-h-12 self-start rounded-xl bg-blue-700 px-5 text-lg font-medium text-white transition-all duration-200 hover:bg-blue-600 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  >
                    Criar etiqueta
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* === Status === */}
        <div className={cardClass}>
          <h3 className={sectionTitleClass}>Status</h3>
          <div className="max-w-xs">
            <select
              id="status"
              className="min-h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              {...register("status")}
            >
              <option value="pendente">Pendente</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluida">Concluída</option>
            </select>
          </div>
        </div>

        {/* === Ações === */}
        <div className={cardClass}>
          <SubmitButton mode={mode} />
          <Link
            href="/"
            className="flex min-h-14 items-center justify-center rounded-xl bg-zinc-100 px-4 py-3 text-xl font-medium text-zinc-700 transition-all duration-200 hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Cancelar
          </Link>
        </div>

        <div aria-live="polite" className="min-h-7 text-lg text-zinc-700">
          {state.message}
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onValid)}
      className="flex w-full flex-col gap-6 max-w-md"
    >
      <p className="text-base text-zinc-500">
        Campos com * são obrigatórios.
      </p>

      {/* === Primário: Título e Prazo === */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="titulo" className={fieldLabelClass}>
            Título *
          </Label>
          <Input
            id="titulo"
            type="text"
            placeholder="Ex: Revisar relatório mensal"
            className={fieldInputClass}
            {...register("titulo")}
          />
          {errors.titulo && (
            <span className={errorClass}>{errors.titulo.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prazo" className={fieldLabelClass}>
            Prazo *
          </Label>
          <Input
            id="prazo"
            type="date"
            className={fieldInputClass}
            {...register("prazo")}
          />
          {errors.prazo && (
            <span className={errorClass}>{errors.prazo.message}</span>
          )}
        </div>
      </div>

      {/* === Responsáveis === */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="responsavelIds" className={fieldLabelClass}>
          Responsável *
        </label>
        <select
          id="responsavelIds"
          multiple
          size={5}
          className="min-h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          {...register("responsavelIds")}
        >
          {voluntarios.map((voluntario) => (
            <option key={voluntario.id} value={String(voluntario.id)}>
              {voluntario.nome}{!voluntario.temConta ? ' (sem acesso)' : ''}
            </option>
          ))}
        </select>
        {errors.responsavelIds && (
          <span className={errorClass}>{errors.responsavelIds.message}</span>
        )}
      </div>

      {/* === Membros === */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="membroIds" className={fieldLabelClass}>
          Membros / acompanhantes (opcional)
        </label>
        <select
          id="membroIds"
          multiple
          size={4}
          className="min-h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          {...register("membroIds")}
        >
          {voluntarios.map((voluntario) => (
            <option key={voluntario.id} value={String(voluntario.id)}>
              {voluntario.nome}{!voluntario.temConta ? ' (sem acesso)' : ''}
            </option>
          ))}
        </select>
        <p className="text-base text-zinc-500">
          Acompanhantes acompanham a demanda e recebem os mesmos lembretes
          por e-mail.
        </p>
      </div>

      {/* === Secundário: Classificação === */}
      <div className="rounded-2xl bg-zinc-50 p-5 ring-1 ring-zinc-200/60">
        <h3 className="text-lg font-semibold text-zinc-700 mb-4">Classificação</h3>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="area" className={fieldLabelClass}>
              Área
            </Label>
            <Input
              id="area"
              type="text"
              placeholder="Ex: Pesquisa de Campo"
              className={fieldInputClass}
              {...register("area")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="projeto" className={fieldLabelClass}>
              Projeto
            </Label>
            <Input
              id="projeto"
              type="text"
              placeholder="Ex: Projeto Horta Comunitária"
              className={fieldInputClass}
              {...register("projeto")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="eventoId" className={fieldLabelClass}>
              Evento (opcional)
            </label>
            <select
              id="eventoId"
              name="eventoId"
              defaultValue={String(defaultValues?.eventoId ?? "")}
              className="min-h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <option value="">Nenhum evento</option>
              {eventos.map((evento) => (
                <option key={evento.id} value={evento.id}>
                  {evento.titulo}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* === Status === */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="status" className={fieldLabelClass}>
          Status
        </label>
        <select
          id="status"
          className="min-h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          {...register("status")}
        >
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluida">Concluída</option>
        </select>
      </div>

      {/* === Etiqueta === */}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="etiquetaId" className={fieldLabelClass}>
            Etiqueta (opcional)
          </label>
          <button
            type="button"
            onClick={() => setCriandoEtiqueta((v) => !v)}
            className="text-base font-medium text-blue-700 transition-colors hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            {criandoEtiqueta ? "Cancelar" : "+ Nova etiqueta"}
          </button>
        </div>
        <select
          id="etiquetaId"
          name="etiquetaId"
          value={etiquetaId}
          onChange={(e) => setEtiquetaId(e.target.value)}
          className="min-h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <option value="">Nenhuma etiqueta</option>
          {etiquetaOptions.map((etiqueta) => (
            <option key={etiqueta.id} value={etiqueta.id}>
              {etiqueta.nome} ({etiqueta.area})
            </option>
          ))}
        </select>

        {criandoEtiqueta && (
          <div className="mt-1 flex flex-col gap-3 rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200/60">
            <p className="text-base text-zinc-600">
              Toda etiqueta pertence a uma área — escolha a área e dê um
              nome (ex.: Comunicação, Vendas, Artes).
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                value={novaEtiquetaArea}
                onChange={(e) => setNovaEtiquetaArea(e.target.value)}
                placeholder="Área (ex.: Pesquisa)"
                className="min-h-12 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-lg text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              />
              <input
                value={novaEtiquetaNome}
                onChange={(e) => setNovaEtiquetaNome(e.target.value)}
                placeholder="Nome da etiqueta (ex.: Comunicação)"
                className="min-h-12 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-lg text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              />
            </div>
            {etiquetaError && (
              <p className="text-base text-red-600">{etiquetaError}</p>
            )}
            <button
              type="button"
              onClick={handleCriarEtiqueta}
              className="min-h-12 self-start rounded-xl bg-blue-700 px-5 text-lg font-medium text-white transition-all duration-200 hover:bg-blue-600 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Criar etiqueta
            </button>
          </div>
        )}
      </div>

      {/* === Ações === */}
      <SubmitButton mode={mode} />

      <Link
        href="/"
        className="flex min-h-14 items-center justify-center rounded-xl bg-zinc-100 px-4 py-3 text-xl font-medium text-zinc-700 transition-all duration-200 hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        Cancelar
      </Link>

      <div aria-live="polite" className="min-h-7 text-lg text-zinc-700">
        {state.message}
      </div>
    </form>
  );
}
