// src/app/(dashboard)/utilidades/contratos/contrato-form.tsx
// Formulário de novo contrato (react-hook-form + zod, mesmo padrão do
// módulo de demandas). O aluno pode ser buscado na base do WooCommerce ou
// digitado manualmente — ambos alimentam os campos de variáveis.
"use client";

import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Search, UserRound } from "lucide-react";
import {
  contratoSchema,
  type ContratoFormValues,
} from "./contrato-schema";
import { criarContrato, type ContratoActionState } from "./actions";

export type ContratoFormOption = {
  id: number;
  titulo: string;
  data_evento?: string | null;
};

export type ContratoFormAluno = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  courses: string[] | null;
};

type Props = {
  modelos: Array<{
    id: number;
    titulo: string;
    categoria: string;
    descricao: string | null;
  }>;
  eventos: ContratoFormOption[];
  alunosIniciais: ContratoFormAluno[];
  busca: string;
  eventoInicial?: string;
};

const initial: ContratoActionState = { ok: true, message: "" };

const INPUT_CLASS =
  "w-full min-h-14 rounded-xl border border-zinc-200 bg-white px-4 text-lg text-zinc-900 placeholder:text-zinc-400 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30";

export default function ContratoForm({ modelos, eventos, alunosIniciais, busca, eventoInicial = "" }: Props) {
  const [state, formAction, isPending] = useActionState(criarContrato, initial);

  const { register, handleSubmit, setValue } = useForm<ContratoFormValues>({
    resolver: zodResolver(contratoSchema),
    defaultValues: {
      modeloId: "",
      eventoId: eventoInicial,
      alunoNome: "",
      alunoEmail: "",
      alunoDocumento: "",
      alunoTelefone: "",
      valor: "",
    },
  });

  function selecionarAluno(aluno: ContratoFormAluno) {
    setValue("alunoNome", [aluno.first_name, aluno.last_name].filter(Boolean).join(" "), {
      shouldValidate: true,
    });
    setValue("alunoEmail", aluno.email || "", { shouldValidate: true });
    const doc = document.getElementById("aluno-documento");
    if (doc instanceof HTMLElement) doc.focus();
  }

  function onValid(values: ContratoFormValues) {
    const fd = new FormData();
    fd.set("modeloId", values.modeloId);
    if (values.eventoId) fd.set("eventoId", values.eventoId);
    fd.set("alunoNome", values.alunoNome);
    if (values.alunoEmail) fd.set("alunoEmail", values.alunoEmail);
    if (values.alunoDocumento) fd.set("alunoDocumento", values.alunoDocumento);
    if (values.alunoTelefone) fd.set("alunoTelefone", values.alunoTelefone);
    if (values.valor) fd.set("valor", values.valor);
    formAction(fd);
  }

  return (
    <form
      onSubmit={handleSubmit(onValid)}
      className="flex w-full flex-col gap-6 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="modelo" className="text-lg font-medium text-zinc-800">
          Modelo do contrato
        </label>
        <select
          id="modelo"
          {...register("modeloId")}
          className={INPUT_CLASS}
        >
          <option value="">Selecione o modelo...</option>
          {modelos.map((modelo) => (
            <option key={modelo.id} value={String(modelo.id)}>
              {modelo.titulo}
            </option>
          ))}
        </select>
        {modelos.length === 0 && (
          <p className="text-base text-amber-700">
            Nenhum modelo ativo.{" "}
            <Link href="/utilidades/contratos/modelos" className="underline">
              Crie um modelo primeiro
            </Link>
            .
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="evento" className="text-lg font-medium text-zinc-800">
          Evento / atividade <span className="text-zinc-400">(opcional)</span>
        </label>
        <select id="evento" {...register("eventoId")} className={INPUT_CLASS}>
          <option value="">Sem evento vinculado</option>
          {eventos.map((evento) => (
            <option key={evento.id} value={String(evento.id)}>
              {evento.titulo}
              {evento.data_evento
                ? ` — ${new Date(`${evento.data_evento.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR")}`
                : ""}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-lg font-medium text-zinc-800">Aluno comprador</legend>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              aria-hidden="true"
            />
            <input
              type="text"
              name="busca"
              defaultValue={busca}
              placeholder="Buscar aluno na loja (nome ou e-mail)..."
              className="w-full min-h-14 rounded-xl border border-zinc-200 bg-white pl-10 pr-4 text-lg text-zinc-900 placeholder:text-zinc-400 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30"
            />
          </div>
          <button
            type="button"
            className="min-h-14 rounded-xl border border-zinc-300 bg-white px-5 text-lg font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            onClick={() => {
              const input = document.querySelector<HTMLInputElement>('input[name="busca"]');
              const termo = (input?.value ?? "").trim();
              window.location.href = `/utilidades/contratos/novo${termo ? `?busca=${encodeURIComponent(termo)}` : ""}`;
            }}
          >
            Buscar
          </button>
        </div>

        {alunosIniciais.length > 0 && (
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-xl border border-zinc-200 p-2">
            {alunosIniciais.map((aluno) => (
              <button
                key={aluno.id}
                type="button"
                onClick={() => selecionarAluno(aluno)}
                className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-base text-zinc-700 transition-colors hover:bg-[#2195B9]/10"
              >
                <UserRound size={16} className="shrink-0 text-zinc-400" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {[aluno.first_name, aluno.last_name].filter(Boolean).join(" ") || "—"}
                </span>
                <span className="truncate text-sm text-zinc-400">{aluno.email}</span>
              </button>
            ))}
          </div>
        )}
        {busca && alunosIniciais.length === 0 && (
          <p className="text-base text-zinc-500">
            Nenhum aluno encontrado na loja — preencha os dados manualmente abaixo.
          </p>
        )}

        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="aluno-nome" className="text-base font-medium text-zinc-800">
              Nome completo *
            </label>
            <input
              id="aluno-nome"
              {...register("alunoNome")}
              placeholder="Nome do aluno que comprou o curso/evento"
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="aluno-documento" className="text-base font-medium text-zinc-800">
              CPF / RG
            </label>
            <input
              id="aluno-documento"
              {...register("alunoDocumento")}
              placeholder="Somente números"
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="aluno-telefone" className="text-base font-medium text-zinc-800">
              Telefone / WhatsApp
            </label>
            <input
              id="aluno-telefone"
              {...register("alunoTelefone")}
              placeholder="(00) 00000-0000"
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="aluno-email" className="text-base font-medium text-zinc-800">
              E-mail
            </label>
            <input
              id="aluno-email"
              {...register("alunoEmail")}
              placeholder="email do aluno"
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="valor" className="text-base font-medium text-zinc-800">
              Valor <span className="text-zinc-400">(opcional)</span>
            </label>
            <input
              id="valor"
              {...register("valor")}
              placeholder="ex.: 120,00"
              inputMode="decimal"
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </fieldset>

      {state.message && (
        <p className={`text-lg ${state.ok ? "text-green-700" : "text-red-700"}`}>
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="min-h-14 rounded-xl bg-[#2195B9] px-6 text-xl font-medium text-white transition-colors hover:bg-[#28627B] disabled:opacity-60"
      >
        {isPending ? "Gerando contrato..." : "Gerar contrato"}
      </button>
    </form>
  );
}
