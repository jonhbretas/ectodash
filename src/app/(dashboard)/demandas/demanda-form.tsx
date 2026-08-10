"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormCombobox, FormSelect } from "@/components/ui/form-select";
import {
  SelectGroup,
  SelectLabel,
  SelectItem,
} from "@/components/ui/select";
import { agruparEventosPorMes } from "@/lib/eventos-agrupados";
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
  data_evento: string;
  local: string | null;
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
      className="min-h-14 w-full rounded-xl bg-[#2195B9] px-4 py-3 text-xl font-medium text-white shadow-[0_1px_3px_rgba(33,149,185,0.25)] transition-all duration-200 hover:bg-[#28627B] hover:shadow-[0_2px_6px_rgba(33,149,185,0.3)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

type DemandaFormProps = {
  voluntarios: VoluntarioOption[];
  eventos: EventoOption[];
  etiquetas: EtiquetaOption[];
  // Nomes das áreas institucionais (areas_institucionais) — sugeridas no
  // campo Área via datalist; o texto livre continua aceito (legado).
  areas?: string[];
  // Nomes dos projetos cadastrados (projetos) + usados nas demandas —
  // sugeridos no campo Projeto via datalist.
  projetos?: string[];
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
  "min-h-14 rounded-xl border-zinc-200 bg-white text-zinc-900 shadow-none transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] focus-visible:ring-0";
const errorClass = "text-base text-red-600";

function dataEventoLabel(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function eventoLabel(evento: EventoOption): string {
  const data = evento.data_evento ? ` — ${dataEventoLabel(evento.data_evento)}` : "";
  const local = evento.local ? ` · ${evento.local}` : "";
  return `${evento.titulo}${data}${local}`;
}

export default function DemandaForm({
  voluntarios,
  eventos,
  etiquetas,
  areas = [],
  projetos = [],
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
  const [etiquetaId, setEtiquetaId] = useState(String(defaultValues?.etiquetaId ?? ""));
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
    setValue,
    formState: { errors },
  } = useForm<DemandaFormValues>({
    resolver: zodResolver(demandaSchema),
    defaultValues: {
      status: "pendente",
      membroIds: defaultValues?.membroIds ?? [],
      ...defaultValues,
    },
  });

  // Estado dos campos com dropdown padrão (Radix) — o hidden input
  // correspondente alimenta o FormData; o setValue mantém o
  // react-hook-form sincronizado para a validação do schema.
  const [eventoId, setEventoId] = useState(String(defaultValues?.eventoId ?? ""));
  const [area, setArea] = useState(defaultValues?.area ?? "");
  const [projeto, setProjeto] = useState(defaultValues?.projeto ?? "");
  const [status, setStatus] = useState<DemandaFormValues["status"]>(
    defaultValues?.status ?? "pendente"
  );

  // Seleção múltipla de responsáveis e membros — checkboxes mobile-friendly
  // substituem o <select multiple> que não funciona em iOS/Android.
  const [responsavelIds, setResponsavelIds] = useState<string[]>(
    defaultValues?.responsavelIds ?? []
  );
  const [membroIdsLocal, setMembroIdsLocal] = useState<string[]>(
    defaultValues?.membroIds ?? []
  );

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
      const fd = new FormData(form);
      fd.delete("responsavelIds");
      responsavelIds.forEach((id) => fd.append("responsavelIds", id));
      fd.delete("membroIds");
      membroIdsLocal.forEach((id) => fd.append("membroIds", id));
      formAction(fd);
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
              <span className={fieldLabelClass}>Responsável *</span>
              <div className="max-h-44 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3">
                {voluntarios.map((voluntario) => {
                  const id = String(voluntario.id);
                  return (
                    <label
                      key={voluntario.id}
                      className="flex min-h-12 items-center gap-3 rounded-lg px-2 py-1 text-xl text-zinc-900 transition-colors hover:bg-zinc-50"
                    >
                      <input
                        type="checkbox"
                        value={id}
                        checked={responsavelIds.includes(id)}
                        onChange={(e) => {
                          setResponsavelIds((prev) =>
                            e.target.checked
                              ? [...prev, id]
                              : prev.filter((v) => v !== id)
                          );
                        }}
                        className="h-5 w-5 rounded border-zinc-300 accent-[#2195B9]"
                      />
                      <span>
                        {voluntario.nome}
                        {!voluntario.temConta && (
                          <span className="text-base text-zinc-400"> (sem acesso)</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
              {errors.responsavelIds && (
                <span className={errorClass}>{errors.responsavelIds.message}</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className={fieldLabelClass}>Membros / acompanhantes (opcional)</span>
              <div className="max-h-44 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3">
                {voluntarios.map((voluntario) => {
                  const id = String(voluntario.id);
                  return (
                    <label
                      key={voluntario.id}
                      className="flex min-h-12 items-center gap-3 rounded-lg px-2 py-1 text-xl text-zinc-900 transition-colors hover:bg-zinc-50"
                    >
                      <input
                        type="checkbox"
                        value={id}
                        checked={membroIdsLocal.includes(id)}
                        onChange={(e) => {
                          setMembroIdsLocal((prev) =>
                            e.target.checked
                              ? [...prev, id]
                              : prev.filter((v) => v !== id)
                          );
                        }}
                        className="h-5 w-5 rounded border-zinc-300 accent-[#2195B9]"
                      />
                      <span>
                        {voluntario.nome}
                        {!voluntario.temConta && (
                          <span className="text-base text-zinc-400"> (sem acesso)</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
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
              <FormCombobox
                name="area"
                value={area}
                onChange={(v) => { setArea(v); setValue("area", v); }}
                options={areas}
                placeholder="Ex: Pesquisa de Campo"
                ariaLabel="Área"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="projeto" className={fieldLabelClass}>
                Projeto
              </Label>
              <FormCombobox
                name="projeto"
                value={projeto}
                onChange={(v) => { setProjeto(v); setValue("projeto", v); }}
                options={projetos}
                placeholder="Ex: Projeto Horta Comunitária"
                ariaLabel="Projeto"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="eventoId" className={fieldLabelClass}>
                Evento (opcional)
              </label>
              <FormSelect
                name="eventoId"
                value={eventoId}
                onValueChange={setEventoId}
                placeholder="Nenhum evento"
                ariaLabel="Evento"
              >
                {agruparEventosPorMes(eventos).map((grupo) => (
                  <SelectGroup key={grupo.label}>
                    <SelectLabel className="px-2 py-1.5 text-base font-semibold text-zinc-500">
                      {grupo.label}
                    </SelectLabel>
                    {grupo.eventos.map((evento) => (
                      <SelectItem
                        key={evento.id}
                        value={String(evento.id)}
                        className="rounded-lg py-2.5 text-lg data-[highlighted]:bg-zinc-100"
                      >
                        {eventoLabel(evento)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </FormSelect>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="etiquetaId" className={fieldLabelClass}>
                  Etiqueta (opcional)
                </label>
                <button
                  type="button"
                  onClick={() => setCriandoEtiqueta((v) => !v)}
                  className="text-base font-medium text-[#2195B9] transition-colors hover:text-[#2195B9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
                >
                  {criandoEtiqueta ? "Cancelar" : "+ Nova etiqueta"}
                </button>
              </div>
              <FormSelect
                name="etiquetaId"
                value={etiquetaId}
                onValueChange={setEtiquetaId}
                placeholder="Nenhuma etiqueta"
                ariaLabel="Etiqueta"
                options={etiquetaOptions.map((etiqueta) => ({
                  value: String(etiqueta.id),
                  label: `${etiqueta.nome} (${etiqueta.area})`,
                }))}
              />

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
                      className="min-h-12 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-lg text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
                    />
                    <input
                      value={novaEtiquetaNome}
                      onChange={(e) => setNovaEtiquetaNome(e.target.value)}
                      placeholder="Nome da etiqueta (ex.: Comunicação)"
                      className="min-h-12 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-lg text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
                    />
                  </div>
                  {etiquetaError && (
                    <p className="text-base text-red-600">{etiquetaError}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleCriarEtiqueta}
                    className="min-h-12 self-start rounded-xl bg-[#2195B9] px-5 text-lg font-medium text-white transition-all duration-200 hover:bg-[#28627B] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
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
            <FormSelect
              name="status"
              value={status}
              onValueChange={(v) => { const s = v as DemandaFormValues["status"]; setStatus(s); setValue("status", s); }}
              placeholder="Status"
              options={[
                { value: "pendente", label: "Pendente" },
                { value: "em_andamento", label: "Em andamento" },
                { value: "concluida", label: "Concluída" },
              ]}
            />
          </div>
        </div>

        {/* === Ações === */}
        <div className={cardClass}>
          <SubmitButton mode={mode} />
          <Link
            href="/"
            className="flex min-h-14 items-center justify-center rounded-xl bg-zinc-100 px-4 py-3 text-xl font-medium text-zinc-700 transition-all duration-200 hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
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
          className="min-h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
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
          className="min-h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
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
            <FormCombobox
              name="area"
              value={area}
              onChange={(v) => { setArea(v); setValue("area", v); }}
              options={areas}
              placeholder="Ex: Pesquisa de Campo"
              ariaLabel="Área"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="projeto" className={fieldLabelClass}>
              Projeto
            </Label>
            <FormCombobox
              name="projeto"
              value={projeto}
              onChange={(v) => { setProjeto(v); setValue("projeto", v); }}
              options={projetos}
              placeholder="Ex: Projeto Horta Comunitária"
              ariaLabel="Projeto"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="eventoId" className={fieldLabelClass}>
              Evento (opcional)
            </label>
            <FormSelect
              name="eventoId"
              value={eventoId}
              onValueChange={setEventoId}
              placeholder="Nenhum evento"
              ariaLabel="Evento"
            >
              {agruparEventosPorMes(eventos).map((grupo) => (
                <SelectGroup key={grupo.label}>
                  <SelectLabel className="px-2 py-1.5 text-base font-semibold text-zinc-500">
                    {grupo.label}
                  </SelectLabel>
                  {grupo.eventos.map((evento) => (
                    <SelectItem
                      key={evento.id}
                      value={String(evento.id)}
                      className="rounded-lg py-2.5 text-lg data-[highlighted]:bg-zinc-100"
                    >
                      {eventoLabel(evento)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </FormSelect>
          </div>
        </div>
      </div>

      {/* === Status === */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="status" className={fieldLabelClass}>
          Status
        </label>
        <FormSelect
          name="status"
          value={status}
          onValueChange={(v) => { const s = v as DemandaFormValues["status"]; setStatus(s); setValue("status", s); }}
          placeholder="Status"
          options={[
            { value: "pendente", label: "Pendente" },
            { value: "em_andamento", label: "Em andamento" },
            { value: "concluida", label: "Concluída" },
          ]}
        />
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
            className="text-base font-medium text-[#2195B9] transition-colors hover:text-[#2195B9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            {criandoEtiqueta ? "Cancelar" : "+ Nova etiqueta"}
          </button>
        </div>
        <FormSelect
          name="etiquetaId"
          value={etiquetaId}
          onValueChange={setEtiquetaId}
          placeholder="Nenhuma etiqueta"
          ariaLabel="Etiqueta"
          options={etiquetaOptions.map((etiqueta) => ({
            value: String(etiqueta.id),
            label: `${etiqueta.nome} (${etiqueta.area})`,
          }))}
        />

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
                className="min-h-12 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-lg text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
              />
              <input
                value={novaEtiquetaNome}
                onChange={(e) => setNovaEtiquetaNome(e.target.value)}
                placeholder="Nome da etiqueta (ex.: Comunicação)"
                className="min-h-12 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-lg text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
              />
            </div>
            {etiquetaError && (
              <p className="text-base text-red-600">{etiquetaError}</p>
            )}
            <button
              type="button"
              onClick={handleCriarEtiqueta}
              className="min-h-12 self-start rounded-xl bg-[#2195B9] px-5 text-lg font-medium text-white transition-all duration-200 hover:bg-[#28627B] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
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
        className="flex min-h-14 items-center justify-center rounded-xl bg-zinc-100 px-4 py-3 text-xl font-medium text-zinc-700 transition-all duration-200 hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
      >
        Cancelar
      </Link>

      <div aria-live="polite" className="min-h-7 text-lg text-zinc-700">
        {state.message}
      </div>
    </form>
  );
}
