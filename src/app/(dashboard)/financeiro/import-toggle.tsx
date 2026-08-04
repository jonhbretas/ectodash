"use client";

// Header CTA for /financeiro — a "Importar planilha" button that reveals
// the import form in place instead of always occupying vertical space. The
// form itself (ImportFinanceiroForm) stays untouched: this component only
// owns the open/closed flag and renders it below the button row.
import { useState } from "react";
import { ChevronDown, ChevronUp, UploadCloud } from "lucide-react";
import ImportFinanceiroForm from "./import-form";

export default function ImportFinanceiroToggle() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex w-full flex-col items-stretch gap-3 sm:items-end">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-xl font-medium text-white shadow-[0_1px_3px_rgba(29,78,216,0.25)] transition-all duration-200 hover:bg-blue-600 hover:shadow-[0_2px_6px_rgba(29,78,216,0.3)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        <UploadCloud size={22} aria-hidden="true" />
        Importar planilha
        {open ? (
          <ChevronUp size={20} aria-hidden="true" />
        ) : (
          <ChevronDown size={20} aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="w-full">
          <ImportFinanceiroForm />
        </div>
      )}
    </div>
  );
}
