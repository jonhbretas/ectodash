"use client";

// Financeiro import card — CSV/XLSX upload replacing the current entries
// (same whole-table-replace semantics as the cron sync), plus the AI
// didactic summary of the imported numbers. On success it refreshes the
// dashboard below via router.refresh().
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { UploadCloud, Sparkles } from "lucide-react";
import {
  importarFinanceiro,
  type ImportarFinanceiroState,
} from "./actions";

const initialState: ImportarFinanceiroState = {
  ok: false,
  message: "",
  resumo: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-14 w-full rounded-lg bg-[#2195B9] px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Importando..." : "Importar planilha"}
    </button>
  );
}

export default function ImportFinanceiroForm() {
  const router = useRouter();
  const [state, formAction] = useActionState(
    importarFinanceiro,
    initialState
  );

  return (
    <section className="flex w-full max-w-4xl flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
        <UploadCloud size={24} aria-hidden="true" />
        Importar planilha de fluxo de caixa
      </h2>
      <p className="text-base text-zinc-700">
        Envie o arquivo <strong>.csv</strong> ou <strong>.xlsx</strong> da
        instituição. A IA lê a planilha, atualiza o dashboard e escreve um
        resumo didático dos números.
      </p>
      <p className="text-base text-zinc-700">
        Formatos aceitos (detectados automaticamente):
      </p>
      <ul className="list-disc space-y-1 pl-5 text-base text-zinc-700">
        <li>
          <span className="font-medium text-zinc-900">
            Fluxo de caixa mensal
          </span>{" "}
          (EctoLab): colunas Janeiro…Dezembro, com receitas e despesas
          agrupadas por centro de custo.
        </li>
        <li>
          <span className="font-medium text-zinc-900">Lista simples</span>:{" "}
          Data; Descrição; Tipo (entrada/saída); Valor; Categoria (opcional).
        </li>
      </ul>
      <p className="text-base text-zinc-700">
        Os lançamentos atuais serão substituídos pelos do arquivo.
      </p>

      <form action={formAction} className="flex flex-col gap-4">
        <input
          id="arquivo"
          name="arquivo"
          type="file"
          accept=".csv,.xlsx,.xls"
          required
          className="block w-full cursor-pointer rounded-lg border border-zinc-400 bg-white px-4 py-3 text-lg text-zinc-900 file:mr-4 file:min-h-12 file:rounded-lg file:border-0 file:bg-[#2195B9] file:px-4 file:text-lg file:font-medium file:text-white file:cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        />
        <SubmitButton />
      </form>

      <div aria-live="polite" className="flex flex-col gap-2">
        {state.message && (
          <p
            className={`text-base ${
              state.ok ? "text-green-800" : "text-red-700"
            }`}
          >
            {state.message}
          </p>
        )}
        {state.resumo && (
          <div className="flex flex-col gap-2 rounded-lg border border-[#E6E6E6] bg-[#E6E6E6] p-4">
            <p className="flex items-center gap-2 text-xl font-semibold text-[#28627B]">
              <Sparkles size={20} aria-hidden="true" />
              Leitura didática da IA
            </p>
            <p className="whitespace-pre-wrap text-lg leading-relaxed text-zinc-800">
              {state.resumo}
            </p>
          </div>
        )}
      </div>

      {state.ok && (
        <button
          type="button"
          onClick={() => router.refresh()}
          className="min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          Atualizar o dashboard
        </button>
      )}
    </section>
  );
}
