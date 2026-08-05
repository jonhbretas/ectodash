"use client";

// Atividades de conscienciologia do voluntário (migration 0026) — o
// próprio voluntário marca as suas (checkboxes + salvar); coordenadores
// também podem editar. Sem permissão, mostra apenas os chips.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Sparkles } from "lucide-react";
import { ATIVIDADES_VOLUNTARIO } from "@/lib/atividades-voluntario";
import { salvarAtividadesVoluntario } from "./actions";

export default function AtividadesSection({
  voluntarioId,
  atuais,
  editavel,
}: {
  voluntarioId: number;
  atuais: string[];
  editavel: boolean;
}) {
  const router = useRouter();
  const [selecionadas, setSelecionadas] = useState<Set<string>>(
    () => new Set(atuais)
  );
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);

  function toggle(atividade: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(atividade)) next.delete(atividade);
      else next.add(atividade);
      return next;
    });
  }

  async function salvar() {
    setSaving(true);
    setMensagem(null);
    const resultado = await salvarAtividadesVoluntario(
      voluntarioId,
      [...selecionadas]
    );
    setSaving(false);
    setMensagem({ ok: resultado.ok, texto: resultado.message });
    if (resultado.ok) {
      startTransition(() => router.refresh());
    }
  }

  return (
    <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
      <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
        <Sparkles size={22} aria-hidden="true" className="text-purple-600" />
        Atividades de conscienciologia
        {selecionadas.size > 0 && (
          <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-base font-medium text-purple-800 ring-1 ring-purple-200/60">
            {selecionadas.size}
          </span>
        )}
      </h2>

      {!editavel ? (
        selecionadas.size === 0 ? (
          <p className="text-lg text-zinc-500">
            Nenhuma atividade cadastrada.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {ATIVIDADES_VOLUNTARIO.filter((a) => selecionadas.has(a.value)).map(
              (atividade) => (
                <span
                  key={atividade.value}
                  className="flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-base font-medium text-purple-800 ring-1 ring-purple-200/60"
                >
                  <BadgeCheck size={14} aria-hidden="true" />
                  {atividade.label}
                </span>
              )
            )}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ATIVIDADES_VOLUNTARIO.map((atividade) => {
              const marcada = selecionadas.has(atividade.value);
              return (
                <label
                  key={atividade.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-lg transition-colors ${
                    marcada
                      ? "border-purple-300 bg-purple-50 text-purple-900"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={marcada}
                    onChange={() => toggle(atividade.value)}
                    className="h-5 w-5 shrink-0 cursor-pointer accent-purple-700"
                  />
                  {atividade.label}
                </label>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={salvar}
              disabled={saving}
              className="flex min-h-12 items-center gap-2 rounded-xl bg-purple-700 px-5 text-lg font-medium text-white transition-colors hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar atividades"}
            </button>
            {mensagem && (
              <span
                className={`text-base ${
                  mensagem.ok ? "text-green-800" : "text-red-700"
                }`}
              >
                {mensagem.texto}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
