"use client";

// Header CTA for /eventos — a "Cadastrar por planilha" button that reveals
// the import form in place instead of always occupying vertical space. The
// form itself (ImportEventosForm) stays untouched: this component only owns
// the open/closed flag and renders it below the button row. Same pattern as
// /financeiro's import-toggle.
import { useState } from "react";
import { ChevronDown, ChevronUp, UploadCloud } from "lucide-react";
import ImportEventosForm from "./import-form";

export default function ImportEventosToggle() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex w-full flex-col items-stretch gap-3 sm:items-end">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#d4883a] px-5 text-xl font-medium text-white shadow-[0_1px_3px_rgba(212,136,58,0.25)] transition-all duration-200 hover:bg-[#c07828] hover:shadow-[0_2px_6px_rgba(212,136,58,0.3)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]"
      >
        <UploadCloud size={22} aria-hidden="true" />
        Cadastrar por planilha
        {open ? (
          <ChevronUp size={20} aria-hidden="true" />
        ) : (
          <ChevronDown size={20} aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="w-full">
          <ImportEventosForm />
        </div>
      )}
    </div>
  );
}
