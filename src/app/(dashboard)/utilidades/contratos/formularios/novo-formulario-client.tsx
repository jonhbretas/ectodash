// Criação de um novo link de formulário de contrato.
"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { agruparEventosPorMes, diaMes } from "@/lib/contratos/eventos-por-mes";
import { criarFormulario } from "../formularios-actions";
import type { ContratoActionState } from "../actions";
import CamposConfig from "./campos-config";

const initial: ContratoActionState & { id?: number } = { ok: true, message: "" };

const INPUT =
  "w-full min-h-14 rounded-xl border border-zinc-200 bg-white px-4 text-lg text-zinc-900 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30";

export default function NovoFormularioClient({
  modelos,
  eventos,
}: {
  modelos: Array<{ id: number; titulo: string }>;
  eventos: Array<{ id: number; titulo: string; data_evento: string | null }>;
}) {
  const router = useRouter();
  const [state, action, isPending] = useActionState(criarFormulario, initial);

  useEffect(() => {
    if (state.id) router.push(`/utilidades/contratos/formularios/${state.id}`);
  }, [state.id, router]);

  return (
    <details className="w-full rounded-2xl bg-white ring-1 ring-zinc-200/60 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex min-h-16 cursor-pointer items-center gap-2 px-5 text-xl font-semibold text-[#2195B9]">
        <Plus size={22} aria-hidden="true" />
        Novo link de formulário
      </summary>
      <form action={action} className="flex flex-col gap-4 border-t border-zinc-100 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-lg font-medium text-zinc-800">Modelo do contrato *</span>
            <select name="modeloId" required className={INPUT} defaultValue="">
              <option value="">Selecione...</option>
              {modelos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.titulo}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-lg font-medium text-zinc-800">Evento</span>
            <select name="eventoId" className={INPUT} defaultValue="">
              <option value="">Sem evento</option>
              {agruparEventosPorMes(eventos).map((g) => (
                <optgroup key={g.chave} label={g.label}>
                  {g.eventos.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.data_evento ? `${diaMes(ev.data_evento)} — ` : ""}
                      {ev.titulo}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
        <CamposConfig />
        {state.message && (
          <p className={`text-lg ${state.ok ? "text-green-700" : "text-red-700"}`} role="status">
            {state.message}
          </p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="min-h-14 rounded-xl bg-[#2195B9] px-6 text-lg font-medium text-white hover:bg-[#28627B] disabled:opacity-60"
        >
          {isPending ? "Criando..." : "Criar link"}
        </button>
      </form>
    </details>
  );
}
