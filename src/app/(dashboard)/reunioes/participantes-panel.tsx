"use client";

// Participants section of the ata detail screen — the roster-linked
// volunteers (ata_participantes, migration 0023) rendered as removable
// chips plus the searchable VoluntarioPicker, and below them the original
// free-text participant names from the AI extraction, marked as not linked.
// Add/remove call the server actions directly and refresh — same pattern as
// the demanda inline editor's responsáveis.
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Users, X, Check } from "lucide-react";
import VoluntarioPicker, {
  type VoluntarioOpcao,
} from "@/components/voluntario-picker";
import {
  addAtaParticipante,
  removeAtaParticipante,
} from "./actions";

export type AtaParticipanteVinculado = {
  id: string;
  nome: string;
};

export function ParticipantesPanel({
  ataId,
  canManage,
  vinculados,
  voluntarios,
  textoLivre,
}: {
  ataId: number;
  canManage: boolean;
  vinculados: AtaParticipanteVinculado[];
  voluntarios: VoluntarioOpcao[];
  textoLivre: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const vinculadosIds = new Set(vinculados.map((v) => v.id));

  function add(id: string) {
    startTransition(async () => {
      const result = await addAtaParticipante(ataId, id);
      if (result.ok) router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await removeAtaParticipante(ataId, id);
      if (result.ok) router.refresh();
    });
  }

  return (
    <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
      <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
        <Users size={22} aria-hidden="true" />
        Participantes
        {vinculados.length > 0 && (
          <span className="rounded-full bg-[#f5f0eb] px-2.5 py-0.5 text-base font-medium text-[#8b5e2a] ring-1 ring-[#f0e0cf]/60">
            {vinculados.length} vinculado{vinculados.length === 1 ? "" : "s"}
          </span>
        )}
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        {vinculados.length === 0 && textoLivre.length === 0 && (
          <span className="text-lg text-zinc-500">
            Nenhum participante registrado nesta ata.
          </span>
        )}
        {vinculados.map((v) => (
          <span
            key={v.id}
            className="flex items-center gap-1.5 rounded-full bg-[#f5f0eb] px-2.5 py-1 text-base font-medium text-[#8b5e2a] ring-1 ring-[#f0e0cf]/60"
            title="Vinculado ao cadastro de voluntário"
          >
            <Check size={14} aria-hidden="true" />
            <span className="truncate">{v.nome}</span>
            {canManage && (
              <button
                type="button"
                onClick={() => remove(v.id)}
                aria-label={`Remover ${v.nome}`}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#d4883a] transition-all hover:bg-red-50 hover:text-red-600"
              >
                <X size={12} aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
        {canManage && (
          <VoluntarioPicker
            voluntarios={voluntarios}
            selectedIds={vinculadosIds}
            onAdd={add}
            label="participante"
          />
        )}
      </div>

      {textoLivre.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-base text-zinc-500">
            Nomes em texto livre (não vinculados ao cadastro):
          </p>
          <div className="flex flex-wrap gap-2">
            {textoLivre.map((nome, index) => (
              <span
                key={`${nome}-${index}`}
                className="rounded-full bg-zinc-100 px-3 py-1 text-base text-zinc-700 ring-1 ring-zinc-200/60"
              >
                {nome}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
