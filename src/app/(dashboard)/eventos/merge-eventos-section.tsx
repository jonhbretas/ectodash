"use client";

// Merge de eventos duplicados (migration 0046) — a análise automática de
// atas pode extrair o mesmo evento em duas atas diferentes; o coordenador
// escolhe o evento definitivo e o duplicado a absorver. As referências do
// duplicado (demandas, contratos, turmas PROEP) são movidas para o
// definitivo e o duplicado é removido. Visível apenas para coordenador_geral.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GitMerge, Merge } from "lucide-react";
import { mesclarEventos } from "./actions";
import { FormSelect } from "@/components/ui/form-select";

export type EventoMergeOpcao = {
  id: number;
  titulo: string;
  data_evento: string;
  local: string | null;
};

function rotuloEvento(e: EventoMergeOpcao): string {
  const [ano, mes, dia] = e.data_evento.split("-");
  const data = `${dia}/${mes}/${ano}`;
  return e.local ? `${e.titulo} — ${data} · ${e.local}` : `${e.titulo} — ${data}`;
}

export default function MergeEventosSection({
  eventos,
}: {
  eventos: EventoMergeOpcao[];
}) {
  const router = useRouter();
  const [manterId, setManterId] = useState("");
  const [removerId, setRemoverId] = useState("");
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const [executando, setExecutando] = useState(false);
  const [, startTransition] = useTransition();

  const opcoes = eventos.map((e) => ({
    value: String(e.id),
    label: rotuloEvento(e),
  }));

  async function executar() {
    setExecutando(true);
    setMensagem(null);
    const r = await mesclarEventos(Number(manterId), Number(removerId));
    setExecutando(false);
    setMensagem({ ok: r.ok, texto: r.message });
    if (r.ok) {
      setManterId("");
      setRemoverId("");
      startTransition(() => router.refresh());
    }
  }

  return (
    <section
      id="mesclar-eventos"
      className="flex w-full scroll-mt-6 flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="h-8 w-1.5 rounded-full bg-green-600" aria-hidden="true" />
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <GitMerge size={22} aria-hidden="true" className="text-green-600" />
          Mesclar eventos duplicados
        </h2>
      </div>
      <p className="text-base text-zinc-500">
        Junta dois eventos repetidos (ex.: o mesmo evento extraído em duas
        atas diferentes). As demandas, contratos e turmas PROEP do evento
        duplicado são movidas para o definitivo e o duplicado é removido.
      </p>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-lg font-medium text-zinc-900">Evento definitivo</span>
          <FormSelect
            value={manterId}
            onValueChange={setManterId}
            placeholder="Escolha o evento que fica"
            ariaLabel="Escolha o evento definitivo"
            options={opcoes}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-lg font-medium text-zinc-900">Evento duplicado</span>
          <FormSelect
            value={removerId}
            onValueChange={setRemoverId}
            placeholder="Escolha o evento a remover"
            ariaLabel="Escolha o evento duplicado"
            options={opcoes}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={executar}
          disabled={
            !manterId || !removerId || manterId === removerId || executando
          }
          className="flex min-h-12 items-center gap-2 rounded-xl bg-green-700 px-5 text-lg font-medium text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Merge size={18} aria-hidden="true" />
          {executando ? "Mesclando..." : "Mesclar eventos"}
        </button>

        {manterId && removerId && manterId === removerId && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-base font-medium text-amber-800 ring-1 ring-amber-200/60">
            Escolha dois eventos diferentes.
          </span>
        )}

        {mensagem && (
          <span className={`text-base ${mensagem.ok ? "text-green-800" : "text-red-700"}`}>
            {mensagem.texto}
          </span>
        )}
      </div>
    </section>
  );
}
