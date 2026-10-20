"use client";

import { Eye, RotateCcw } from "lucide-react";

export type ViewAsOption = {
  value: string;
  label: string;
  description: string;
};

export default function ViewAsSelector({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: ViewAsOption[];
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const previewing = value !== "eu";

  return (
    <div className={compact ? "px-0" : "px-4"}>
      <label htmlFor="visualizar-como" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Eye size={14} aria-hidden="true" />
        Visualizar como
      </label>
      <div className="flex gap-1.5">
        <select
          id="visualizar-como"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-[#2195B9] focus:ring-2 focus:ring-[#2195B9]/20"
        >
          <option value="eu">Minha visão (Coordenador geral)</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} — {option.description}
            </option>
          ))}
        </select>
        {previewing && (
          <button
            type="button"
            onClick={() => onChange("eu")}
            aria-label="Voltar para minha visão"
            title="Voltar para minha visão"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            <RotateCcw size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {previewing && (
        <p className="mt-1.5 text-xs leading-snug text-amber-700">
          Simulação de menu: seus acessos reais não foram alterados.
        </p>
      )}
    </div>
  );
}
