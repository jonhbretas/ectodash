"use client";

// src/app/(dashboard)/financeiro/pagar/pagar-form.tsx
// Formulário de criar/editar conta a pagar da Ectolab. No registro, débito
// fixo pode se repetir todo mês por N meses (gera as ocorrências).
import { useActionState, useState } from "react";
import { PlusCircle, Save } from "lucide-react";
import { atualizarConta, criarConta, type PagarActionState } from "./actions";
import { METODO_LABELS, METODOS } from "../propostas/proposta-schema";

export type Conta = {
  id: number;
  titulo: string;
  fornecedor: string | null;
  valor: number;
  vencimento: string | null;
  status: "pendente" | "pago" | "cancelado";
  metodo: (typeof METODOS)[number];
  observacoes: string | null;
  recorrencia: "unica" | "mensal";
  grupo_recorrencia: string | null;
};

const INICIAL: PagarActionState = { ok: false, message: "" };

const inputCls =
  "min-h-11 rounded-lg border border-zinc-400 bg-white px-3 py-2 text-lg text-zinc-900 placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";
const labelCls = "text-base font-medium text-zinc-700";

export default function PagarForm({ conta }: { conta?: Conta }) {
  const editando = Boolean(conta);
  const sufixo = editando ? `-${conta!.id}` : "";
  const [estado, acao, pendente] = useActionState(
    editando ? atualizarConta : criarConta,
    INICIAL
  );
  const [mensal, setMensal] = useState(false);

  return (
    <form action={acao} className="flex flex-col gap-4">
      {editando && <input type="hidden" name="id" value={conta!.id} />}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`titulo${sufixo}`} className={labelCls}>
            O que precisa pagar? *
          </label>
          <input
            id={`titulo${sufixo}`}
            name="titulo"
            required
            maxLength={200}
            defaultValue={conta?.titulo ?? ""}
            placeholder="Ex.: Aluguel do espaço, impressão de apostilas"
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`fornecedor${sufixo}`} className={labelCls}>
            Fornecedor
          </label>
          <input
            id={`fornecedor${sufixo}`}
            name="fornecedor"
            maxLength={200}
            defaultValue={conta?.fornecedor ?? ""}
            placeholder="Ex.: Gráfica Central"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`valor${sufixo}`} className={labelCls}>
            Valor (R$) *
          </label>
          <input
            id={`valor${sufixo}`}
            name="valor"
            required
            inputMode="decimal"
            defaultValue={conta ? String(conta.valor).replace(".", ",") : ""}
            placeholder="Ex.: 850,00"
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`vencimento${sufixo}`} className={labelCls}>
            Vencimento
          </label>
          <input
            id={`vencimento${sufixo}`}
            name="vencimento"
            type="date"
            defaultValue={conta?.vencimento ?? ""}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`metodo${sufixo}`} className={labelCls}>
            Como vai pagar? *
          </label>
          <select
            id={`metodo${sufixo}`}
            name="metodo"
            required
            defaultValue={conta?.metodo ?? ""}
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
        </div>
      </div>

      <div className={`grid gap-4 ${editando ? "md:grid-cols-2" : ""}`}>
        <div className="flex flex-col gap-1">
          <label htmlFor={`observacoes${sufixo}`} className={labelCls}>
            Observações
          </label>
          <textarea
            id={`observacoes${sufixo}`}
            name="observacoes"
            rows={2}
            maxLength={2000}
            defaultValue={conta?.observacoes ?? ""}
            placeholder="Ex.: boleto no e-mail do financeiro…"
            className={`${inputCls} leading-relaxed`}
          />
        </div>
        {editando ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={`status-${conta!.id}`} className={labelCls}>
              Situação
            </label>
            <select
              id={`status-${conta!.id}`}
              name="status"
              defaultValue={conta!.status}
              className={inputCls}
            >
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <span className={labelCls}>Repetição</span>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg bg-zinc-50 px-3 py-2 text-lg text-zinc-700">
              <input
                type="checkbox"
                checked={mensal}
                onChange={(e) => setMensal(e.target.checked)}
                className="h-5 w-5 accent-[#2195B9]"
              />
              <span>
                Débito mensal <span className="text-zinc-500">(repete todo mês)</span>
              </span>
            </label>
            <input type="hidden" name="recorrencia" value={mensal ? "mensal" : "unica"} />
            {mensal && (
              <div className="flex items-center gap-2">
                <label htmlFor="meses" className="text-base text-zinc-600">
                  Por quantos meses?
                </label>
                <select id="meses" name="meses" defaultValue={12} className={inputCls}>
                  {[6, 12, 18, 24].map((n) => (
                    <option key={n} value={n}>
                      {n} meses
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

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
          {pendente ? "Salvando…" : editando ? "Salvar alterações" : "Registrar conta"}
        </button>
      </div>
    </form>
  );
}
