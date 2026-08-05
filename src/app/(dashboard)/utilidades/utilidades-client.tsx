"use client";

import { useActionState, useState } from "react";
import { PlusCircle, X } from "lucide-react";
import { criarUtilidadeItem, type UtilidadeState } from "./utilidades-actions";

type Area = { id: number; nome: string };

const initial: UtilidadeState = { ok: false, message: "" };

const CATEGORIES = [
  { value: "ata_fundacao", label: "Ata de Fundação" },
  { value: "estatuto", label: "Estatuto" },
  { value: "logo", label: "Logos e Identidade Visual" },
  { value: "ficha_proposicao", label: "Ficha de Proposição de Curso" },
  { value: "grade_curricular", label: "Grade Curricular — IC" },
  { value: "links_uteis", label: "Links Úteis" },
  { value: "outro", label: "Outros Documentos" },
];

const inputClass = "min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]";

export default function UtilidadesClient({ areas }: { areas: Area[] }) {
  const [show, setShow] = useState(false);
  const [state, formAction] = useActionState(criarUtilidadeItem, initial);

  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setShow(true)}
        className="flex min-h-12 w-fit items-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-2 text-lg font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900"
      >
        <PlusCircle size={20} />
        Adicionar item
      </button>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-2xl flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-lg font-medium text-zinc-900">Novo item no acervo</span>
        <button type="button" onClick={() => setShow(false)} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-200">
          <X size={18} />
        </button>
      </div>

      <input name="titulo" required placeholder="Título do item" className={inputClass} />

      <select name="area_id" className={inputClass}>
        <option value="">Escolha a área (opcional)</option>
        {areas.map((area) => (
          <option key={area.id} value={area.id}>{area.nome}</option>
        ))}
      </select>

      <select name="categoria" required className={inputClass}>
        <option value="">Escolha a categoria</option>
        {CATEGORIES.map((cat) => (
          <option key={cat.value} value={cat.value}>{cat.label}</option>
        ))}
      </select>

      <input name="url" placeholder="URL (link para o documento ou site)" className={inputClass} />

      <input name="tags" placeholder="Tags separadas por vírgula (ex: logo, horizontal, azul)" className={inputClass} />

      <textarea name="descricao" rows={3} placeholder="Descrição (opcional)" className={`${inputClass} min-h-20 resize-y py-3`} />

      <div className="flex items-center gap-2">
        <button type="submit" className="flex min-h-12 items-center gap-1.5 rounded-lg bg-[#d4883a] px-4 text-lg font-medium text-white transition-colors hover:bg-[#c07828]">
          Adicionar
        </button>
        <button type="button" onClick={() => setShow(false)} className="rounded-lg px-3 py-2 text-lg text-zinc-600 hover:text-zinc-900">Cancelar</button>
      </div>

      {state.message && (
        <p className={`text-base ${state.ok ? "text-green-800" : "text-red-700"}`}>{state.message}</p>
      )}
    </form>
  );
}
