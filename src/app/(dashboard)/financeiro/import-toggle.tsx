"use client";

// Header CTA for /financeiro — a "Importar planilha" button that reveals
// the import form in place instead of always occupying vertical space,
// plus a "Limpar dados" button sitting right next to it so users can wipe
// the current entries without opening the form. The form itself
// (ImportFinanceiroForm) stays untouched: this component only owns the
// open/closed flag, the clear-data action state, and renders both below
// the button row.
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ChevronDown, ChevronUp, Eraser, UploadCloud, Archive } from "lucide-react";
import ImportFinanceiroForm from "./import-form";
import { limparFinanceiro, type LimparFinanceiroState } from "./actions";

const limparInitialState: LimparFinanceiroState = {
  ok: false,
  message: "",
};

export default function ImportFinanceiroToggle() {
  const [open, setOpen] = useState(false);
  const [limparState, limparAction] = useActionState(
    limparFinanceiro,
    limparInitialState
  );

  return (
    <div className="flex w-full flex-col items-stretch gap-3 sm:items-end">
      <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-5 text-xl font-medium text-white shadow-[0_1px_3px_rgba(33,149,185,0.25)] transition-all duration-200 hover:bg-[#28627B] hover:shadow-[0_2px_6px_rgba(33,149,185,0.3)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          <UploadCloud size={22} aria-hidden="true" />
          Importar planilha
          {open ? (
            <ChevronUp size={20} aria-hidden="true" />
          ) : (
            <ChevronDown size={20} aria-hidden="true" />
          )}
        </button>

        <div className="relative group">
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="flex min-h-14 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-100 px-5 text-xl font-medium text-zinc-400 sm:w-auto"
          >
            <Archive size={22} aria-hidden="true" />
            Livro financeiro
          </button>
          <span
            role="tooltip"
            className="pointer-events-none absolute right-0 top-full z-10 mt-2 hidden max-w-xs rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-lg group-hover:block group-focus-within:block"
          >
            Livro financeiro automatizado — funcionalidade desativada no
            momento. Use o botão Importar planilha ao lado para importar a
            planilha de fluxo de caixa.
          </span>
        </div>

        <form
          action={(formData) => {
            if (
              window.confirm(
                "Apagar TODOS os lançamentos e referências do financeiro? Essa ação não pode ser desfeita."
              )
            ) {
              limparAction(formData);
            }
          }}
        >
          <ClearButton />
        </form>
      </div>

      {limparState.message && (
        <p
          className={`text-base ${
            limparState.ok ? "text-green-800" : "text-red-700"
          }`}
        >
          {limparState.message}
        </p>
      )}

      {open && (
        <div className="w-full">
          <ImportFinanceiroForm />
        </div>
      )}
    </div>
  );
}

function ClearButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-5 text-xl font-medium text-red-700 transition-colors hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
    >
      <Eraser size={22} aria-hidden="true" />
      {pending ? "Limpando..." : "Limpar dados"}
    </button>
  );
}
