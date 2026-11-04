"use client";

import { useActionState, useEffect } from "react";
import { Loader2, X } from "lucide-react";
import { criarUtilidadeItem, type UtilidadeState } from "./utilidades-actions";
import { CATEGORIA_SUGGESTIONS } from "./categorias";

type Area = { id: number; nome: string };

const initial: UtilidadeState = { ok: false, message: "" };

const inputClass = "min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:bg-zinc-100";

export default function NovoItemForm({
  areas,
  onClose,
  onSaved,
}: {
  areas: Area[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [state, formAction, pending] = useActionState(criarUtilidadeItem, initial);

  useEffect(() => {
    if (state.ok) onSaved(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      action={formAction}
      aria-busy={pending}
      className="relative flex w-full max-w-2xl flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-lg font-medium text-zinc-900">Novo link / material</span>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          aria-label="Fechar"
          className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-200 disabled:opacity-50"
        >
          <X size={18} />
        </button>
      </div>

      {/* fieldset desabilitado trava todos os campos enquanto salva */}
      <fieldset disabled={pending} className="flex flex-col gap-3">
        <input name="titulo" required placeholder="Título do item" className={inputClass} />

        <select name="area_id" className={inputClass}>
          <option value="">Escolha a área (opcional)</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>{area.nome}</option>
          ))}
        </select>

        <div className="flex flex-col gap-1">
          <input
            name="categoria"
            required
            list="categoria-sugestoes"
            placeholder="Tipo de material (ex: Estatuto, Tutorial)"
            className={inputClass}
          />
          <datalist id="categoria-sugestoes">
            {CATEGORIA_SUGGESTIONS.map((label) => (
              <option key={label} value={label} />
            ))}
            <option value="Tutorial" />
          </datalist>
          <p className="text-sm text-zinc-500">
            Escolha uma sugestão ou digite um tipo novo.
          </p>
        </div>

        <input name="url" placeholder="URL (link para o documento ou site)" className={inputClass} />

        <input name="tags" placeholder="Palavras-chave separadas por vírgula (ex: logo, horizontal, azul)" className={inputClass} />

        <textarea name="descricao" rows={3} placeholder="Descrição (opcional)" className={`${inputClass} min-h-20 resize-y py-3`} />

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="flex min-h-12 items-center gap-2 rounded-lg bg-[#2195B9] px-4 text-lg font-medium text-white transition-colors hover:bg-[#28627B] disabled:cursor-wait disabled:opacity-70"
          >
            {pending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
            {pending ? "Salvando..." : "Adicionar"}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-lg text-zinc-600 hover:text-zinc-900 disabled:opacity-50">
            Cancelar
          </button>
        </div>
      </fieldset>

      {state.message && !state.ok && (
        <p role="alert" className="text-base text-red-700">{state.message}</p>
      )}

      {pending && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/60" aria-hidden="true">
          <span className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-lg font-medium text-zinc-800 shadow ring-1 ring-zinc-200">
            <Loader2 size={22} className="animate-spin text-[#2195B9]" />
            Salvando...
          </span>
        </div>
      )}
    </form>
  );
}
