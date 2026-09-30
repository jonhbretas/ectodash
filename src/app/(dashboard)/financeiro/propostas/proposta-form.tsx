"use client";

// src/app/(dashboard)/financeiro/propostas/proposta-form.tsx
// Formulário de criar/editar proposta (mesmo padrão visual dos forms do
// app: rótulos grandes, campos min-h-11, foco em anel azul). Em modo
// edição recebe a proposta e inclui o id oculto + seletor de status.
import { useActionState } from "react";
import { PlusCircle, Save } from "lucide-react";
import {
  atualizarProposta,
  criarProposta,
  type PropostaActionState,
} from "./actions";
import {
  METODO_LABELS,
  METODOS,
  STATUS_LABELS,
  STATUS,
  type Proposta,
} from "./proposta-schema";

const INICIAL: PropostaActionState = { ok: false, message: "" };

const inputCls =
  "min-h-11 rounded-lg border border-zinc-400 bg-white px-3 py-2 text-lg text-zinc-900 placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";
const labelCls = "text-base font-medium text-zinc-700";
const erroCls = "text-base text-red-700";

function Campo({
  id,
  rotulo,
  erro,
  children,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={labelCls}>
        {rotulo}
      </label>
      {children}
      {erro && (
        <p role="alert" className={erroCls}>
          {erro}
        </p>
      )}
    </div>
  );
}

export default function PropostaForm({ proposta }: { proposta?: Proposta }) {
  const editando = Boolean(proposta);
  const [estado, acao, pendente] = useActionState(
    editando ? atualizarProposta : criarProposta,
    INICIAL
  );

  return (
    <form action={acao} className="flex flex-col gap-4">
      {editando && <input type="hidden" name="id" value={proposta!.id} />}

      <div className="grid gap-4 md:grid-cols-2">
        <Campo id={editando ? `titulo-${proposta!.id}` : "titulo"} rotulo="Título *" erro={estado.fieldErrors?.titulo}>
          <input
            id={editando ? `titulo-${proposta!.id}` : "titulo"}
            name="titulo"
            required
            maxLength={200}
            defaultValue={proposta?.titulo ?? ""}
            placeholder="Ex.: Orçamento gráfica — apostilas PROEP"
            className={inputCls}
          />
        </Campo>
        <Campo id={editando ? `contraparte-${proposta!.id}` : "contraparte"} rotulo="Fornecedor / cliente" erro={estado.fieldErrors?.contraparte}>
          <input
            id={editando ? `contraparte-${proposta!.id}` : "contraparte"}
            name="contraparte"
            maxLength={200}
            defaultValue={proposta?.contraparte ?? ""}
            placeholder="Ex.: Gráfica Central"
            className={inputCls}
          />
        </Campo>
      </div>

      <Campo id={editando ? `descricao-${proposta!.id}` : "descricao"} rotulo="Descrição" erro={estado.fieldErrors?.descricao}>
        <textarea
          id={editando ? `descricao-${proposta!.id}` : "descricao"}
          name="descricao"
          rows={2}
          maxLength={2000}
          defaultValue={proposta?.descricao ?? ""}
          placeholder="Detalhes da proposta…"
          className={`${inputCls} leading-relaxed`}
        />
      </Campo>

      <div className="grid gap-4 md:grid-cols-3">
        <Campo id={editando ? `valor-${proposta!.id}` : "valor"} rotulo="Valor (R$) *" erro={estado.fieldErrors?.valor}>
          <input
            id={editando ? `valor-${proposta!.id}` : "valor"}
            name="valor"
            required
            inputMode="decimal"
            defaultValue={proposta ? String(proposta.valor).replace(".", ",") : ""}
            placeholder="Ex.: 1.234,56"
            className={inputCls}
          />
        </Campo>
        <Campo id={editando ? `metodo-${proposta!.id}` : "metodo"} rotulo="Método de pagamento *" erro={estado.fieldErrors?.metodo}>
          <select
            id={editando ? `metodo-${proposta!.id}` : "metodo"}
            name="metodo"
            required
            defaultValue={proposta?.metodo ?? ""}
            className={inputCls}
          >
            <option value="" disabled>
              Escolha
            </option>
            {METODOS.map((m) => (
              <option key={m} value={m}>
                {METODO_LABELS[m]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id={editando ? `prazo-${proposta!.id}` : "prazo"} rotulo="Prazo" erro={estado.fieldErrors?.prazo}>
          <input
            id={editando ? `prazo-${proposta!.id}` : "prazo"}
            name="prazo"
            type="date"
            defaultValue={proposta?.prazo ?? ""}
            className={inputCls}
          />
        </Campo>
      </div>

      <div className={`grid gap-4 ${editando ? "md:grid-cols-2" : ""}`}>
        <Campo
          id={editando ? `sheet_url-${proposta!.id}` : "sheet_url"}
          rotulo="Link da planilha Google"
          erro={estado.fieldErrors?.sheet_url}
        >
          <input
            id={editando ? `sheet_url-${proposta!.id}` : "sheet_url"}
            name="sheet_url"
            type="url"
            inputMode="url"
            maxLength={2000}
            defaultValue={proposta?.sheet_url ?? ""}
            placeholder="https://docs.google.com/spreadsheets/…"
            className={inputCls}
          />
        </Campo>
        {editando && (
          <Campo id={`status-${proposta!.id}`} rotulo="Situação" erro={estado.fieldErrors?.status}>
            <select
              id={`status-${proposta!.id}`}
              name="status"
              defaultValue={proposta!.status}
              className={inputCls}
            >
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Campo>
        )}
      </div>

      <Campo id={editando ? `observacoes-${proposta!.id}` : "observacoes"} rotulo="Observações" erro={estado.fieldErrors?.observacoes}>
        <textarea
          id={editando ? `observacoes-${proposta!.id}` : "observacoes"}
          name="observacoes"
          rows={2}
          maxLength={2000}
          defaultValue={proposta?.observacoes ?? ""}
          placeholder="Ex.: aguardar nota fiscal, parcelado em 2x…"
          className={`${inputCls} leading-relaxed`}
        />
      </Campo>

      {estado.message && (
        <p
          role={estado.ok ? "status" : "alert"}
          className={`rounded-lg px-3 py-2 text-lg ${
            estado.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {estado.message}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pendente}
          className="flex min-h-11 items-center gap-2 rounded-lg bg-[#2195B9] px-6 text-lg font-medium text-white transition-colors hover:bg-[#28627B] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          {editando ? (
            <Save size={18} aria-hidden="true" />
          ) : (
            <PlusCircle size={18} aria-hidden="true" />
          )}
          {pendente ? "Salvando…" : editando ? "Salvar alterações" : "Registrar proposta"}
        </button>
      </div>
    </form>
  );
}
