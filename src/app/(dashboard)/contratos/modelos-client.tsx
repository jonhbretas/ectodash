// src/app/(dashboard)/contratos/modelos-client.tsx
// Gestão de modelos de contrato: formulário (novo/editar) com editor de
// texto + chips de variáveis, lista de modelos com ativar/desativar, e o
// painel de configuração do webhook da Assinafy.
"use client";

import { useActionState, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FileSignature,
  Pencil,
  Plus,
  Power,
  Sparkles,
  Link2,
} from "lucide-react";
import {
  CONTRATO_CATEGORIAS,
  categoriaLabel,
  variaveisPorGrupo,
} from "@/lib/contratos/variables";
import {
  contratoModeloSchema,
  type ContratoModeloFormValues,
} from "./contrato-schema";
import {
  atualizarModelo,
  configurarAssinafy,
  criarModelo,
  toggleModeloAtivo,
  type ContratoActionState,
} from "./actions";

type ModeloRow = {
  id: number;
  titulo: string;
  categoria: string;
  descricao: string | null;
  conteudo: string;
  ativo: boolean;
  created_at: string;
};

const initial: ContratoActionState = { ok: true, message: "" };

const INPUT_CLASS =
  "w-full min-h-14 rounded-xl border border-zinc-200 bg-white px-4 text-lg text-zinc-900 placeholder:text-zinc-400 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30";

const grupos = variaveisPorGrupo();

function CampoVariaveis({
  onInsert,
}: {
  onInsert: (token: string) => void;
}) {
  return (
    <details className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
      <summary className="cursor-pointer text-base font-medium text-zinc-700">
        Variáveis disponíveis — toque para inserir no texto
      </summary>
      <div className="mt-3 flex flex-col gap-2">
        {(Object.keys(grupos) as Array<keyof typeof grupos>).map((grupo) => (
          <div key={grupo} className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              {grupo}
            </span>
            <div className="flex flex-wrap gap-2">
              {grupos[grupo].map((v) => (
                <button
                  key={v.token}
                  type="button"
                  onClick={() => onInsert(v.token)}
                  className="rounded-full border border-[#2195B9]/30 bg-[#2195B9]/10 px-3 py-1.5 text-sm font-medium text-[#2195B9] transition-colors hover:bg-[#2195B9]/20"
                  title={v.label}
                >
                  {v.token}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function ModeloForm({
  defaultValues,
  action,
  isPending,
  onCancel,
  submitLabel,
}: {
  defaultValues: Partial<ContratoModeloFormValues>;
  action: (fd: FormData) => void;
  isPending: boolean;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const { register, handleSubmit, setValue, getValues } = useForm<ContratoModeloFormValues>({
    resolver: zodResolver(contratoModeloSchema),
    defaultValues: {
      titulo: "",
      categoria: "curso",
      descricao: "",
      conteudo: "",
      ...defaultValues,
    },
  });

  function onValid(values: ContratoModeloFormValues) {
    const fd = new FormData();
    fd.set("titulo", values.titulo);
    fd.set("categoria", values.categoria);
    if (values.descricao) fd.set("descricao", values.descricao);
    fd.set("conteudo", values.conteudo);
    action(fd);
  }

  return (
    <form
      onSubmit={handleSubmit(onValid)}
      className="flex w-full flex-col gap-4 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="modelo-titulo" className="text-base font-medium text-zinc-800">
            Título *
          </label>
          <input
            id="modelo-titulo"
            {...register("titulo")}
            placeholder="ex.: Contrato de curso — Curso de Autopesquisa"
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="modelo-categoria" className="text-base font-medium text-zinc-800">
            Tipo *
          </label>
          <select id="modelo-categoria" {...register("categoria")} className={INPUT_CLASS}>
            {CONTRATO_CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="modelo-descricao" className="text-base font-medium text-zinc-800">
          Descrição curta
        </label>
        <input
          id="modelo-descricao"
          {...register("descricao")}
          placeholder="Para que serve este modelo?"
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="modelo-conteudo" className="text-base font-medium text-zinc-800">
          Texto do contrato *
        </label>
        <textarea
          id="modelo-conteudo"
          {...register("conteudo")}
          rows={10}
          placeholder={"CLÁUSULA PRIMEIRA — DO OBJETO\n\nA instituição Ectolab, por meio do evento {{evento_titulo}}, concede ao aluno {{aluno_nome}}, portador do documento {{aluno_documento}}, ...\n\nCláusulas separadas por linha em branco."}
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-lg leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30"
        />
      </div>

      <CampoVariaveis
        onInsert={(token) => {
          const atual = getValues("conteudo") ?? "";
          setValue("conteudo", `${atual}${atual ? " " : ""}${token}`, {
            shouldValidate: true,
          });
        }}
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="min-h-14 rounded-xl bg-[#2195B9] px-6 text-lg font-medium text-white transition-colors hover:bg-[#28627B] disabled:opacity-60"
        >
          {isPending ? "Salvando..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-14 rounded-xl border border-zinc-300 bg-white px-6 text-lg font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

function AssinafyPanel() {
  const [state, action, isPending] = useActionState(configurarAssinafy, initial);
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
      <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
        <Link2 size={24} className="text-[#2195B9]" aria-hidden="true" />
        Assinatura eletrônica (Assinafy)
      </h2>
      <p className="text-lg leading-relaxed text-zinc-600">
        O sistema envia o PDF para a Assinafy, o aluno assina pelo link (com
        validade jurídica ICP-Brasil) e o retorno é recebido por webhook —
        o PDF certificado volta sozinho para a pasta do aluno no Drive.
        Toque no botão para registrar o webhook deste sistema na sua conta
        Assinafy.
      </p>
      <form action={action} className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="flex min-h-12 items-center gap-2 rounded-xl bg-[#FDBA2F] px-5 text-base font-semibold text-zinc-900 transition-colors hover:bg-[#f0ac1a] disabled:opacity-60"
        >
          <Sparkles size={17} aria-hidden="true" />
          {isPending ? "Configurando..." : "Configurar webhook na Assinafy"}
        </button>
      </form>
      {state.message && (
        <p className={`text-lg ${state.ok ? "text-green-700" : "text-red-700"}`}>
          {state.message}
        </p>
      )}
      {state.assinaturaUrl && (
        <p className="rounded-xl bg-zinc-50 px-4 py-3 text-base text-zinc-700">
          URL do webhook: <code className="break-all text-[#2195B9]">{state.assinaturaUrl}</code>
        </p>
      )}
    </div>
  );
}

export default function ModelosClient({ modelos }: { modelos: ModeloRow[] }) {
  const [criarState, criarAction, criarPending] = useActionState(criarModelo, initial);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);

  return (
    <div className="flex w-full flex-col gap-8">
      <AssinafyPanel />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="min-w-0 text-2xl font-semibold text-zinc-900">
            Modelos ({modelos.length})
          </h2>
          <button
            type="button"
            onClick={() => setNovoAberto((v) => !v)}
            className="flex min-h-12 items-center gap-2 rounded-xl bg-[#2195B9] px-5 text-base font-medium text-white transition-colors hover:bg-[#28627B]"
          >
            <Plus size={18} aria-hidden="true" />
            Novo modelo
          </button>
        </div>

        {novoAberto && (
          <>
            <ModeloForm
              defaultValues={{}}
              action={criarAction}
              isPending={criarPending}
              onCancel={() => setNovoAberto(false)}
              submitLabel="Criar modelo"
            />
            {criarState.message && (
              <p className={`text-lg ${criarState.ok ? "text-green-700" : "text-red-700"}`}>
                {criarState.message}
              </p>
            )}
          </>
        )}

        {modelos.length === 0 && !novoAberto ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-zinc-200/60">
            <FileSignature size={44} className="text-zinc-400" aria-hidden="true" />
            <p className="text-xl text-zinc-700">
              Nenhum modelo ainda. Crie o primeiro modelo padronizado.
            </p>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-4">
            {modelos.map((modelo) => (
              <ModeloCard
                key={modelo.id}
                modelo={modelo}
                editando={editandoId === modelo.id}
                onToggleEdicao={() =>
                  setEditandoId((atual) => (atual === modelo.id ? null : modelo.id))
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ModeloCard({
  modelo,
  editando,
  onToggleEdicao,
}: {
  modelo: ModeloRow;
  editando: boolean;
  onToggleEdicao: () => void;
}) {
  const [editarState, editarAction, editarPending] = useActionState(
    atualizarModelo.bind(null, modelo.id),
    initial
  );
  const [toggleState, toggleAction, togglePending] = useActionState(
    toggleModeloAtivo.bind(null, modelo.id),
    initial
  );

  const tokensUsados = (modelo.conteudo.match(/\{\{[^}]+\}\}/g) ?? []).filter(
    (v, i, arr) => arr.indexOf(v) === i
  );

  if (editando) {
    return (
      <div className="flex flex-col gap-2">
        <ModeloForm
          defaultValues={{
            titulo: modelo.titulo,
            categoria: modelo.categoria as ContratoModeloFormValues["categoria"],
            descricao: modelo.descricao ?? "",
            conteudo: modelo.conteudo,
          }}
          action={editarAction}
          isPending={editarPending}
          onCancel={onToggleEdicao}
          submitLabel="Salvar alterações"
        />
        {editarState.message && (
          <p className={`text-lg ${editarState.ok ? "text-green-700" : "text-red-700"}`}>
            {editarState.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-semibold text-zinc-900">{modelo.titulo}</h3>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-sm font-medium text-purple-800 ring-1 ring-purple-200/60">
              {categoriaLabel(modelo.categoria)}
            </span>
            {modelo.ativo ? (
              <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-sm font-medium text-green-800 ring-1 ring-green-200/60">
                Ativo
              </span>
            ) : (
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-sm font-medium text-zinc-600 ring-1 ring-zinc-200/60">
                Inativo
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleEdicao}
            className="flex min-h-11 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <Pencil size={16} aria-hidden="true" />
            Editar
          </button>
          <form action={toggleAction}>
            <button
              type="submit"
              disabled={togglePending}
              className="flex min-h-11 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60"
            >
              <Power size={16} aria-hidden="true" />
              {togglePending ? "..." : modelo.ativo ? "Desativar" : "Ativar"}
            </button>
          </form>
        </div>
      </div>

      {modelo.descricao && <p className="text-base text-zinc-600">{modelo.descricao}</p>}

      <p className="line-clamp-3 whitespace-pre-line text-base leading-relaxed text-zinc-600">
        {modelo.conteudo}
      </p>

      {tokensUsados.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tokensUsados.map((token) => (
            <span
              key={token}
              className="rounded-full bg-[#2195B9]/10 px-2.5 py-0.5 text-sm font-medium text-[#2195B9] ring-1 ring-[#2195B9]/20"
            >
              {token}
            </span>
          ))}
        </div>
      )}

      {toggleState.message && (
        <p className={`text-base ${toggleState.ok ? "text-green-700" : "text-red-700"}`}>
          {toggleState.message}
        </p>
      )}
    </article>
  );
}
