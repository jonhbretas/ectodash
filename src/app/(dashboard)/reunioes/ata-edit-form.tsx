"use client";

// Editar ata — inline editor on the ata detail screen. Renders an "Editar
// ata" button (only for the creator or a coordenador_geral, mirroring RLS
// 0007) and, when open, a form for every field a transcription can leave
// incomplete: título, data, pontos principais, deliberações, resumo — plus
// the roster-linked participants picked through the searchable checkbox
// list, so people who were present but never spoke (camera off) can be
// added manually, several at a time. Same inline pattern as DipActions on
// this page; save calls editarAta and refreshes.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Pencil, Users, X } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import {
  VoluntarioChecklist,
} from "@/components/voluntario-checklist";
import type { VoluntarioOpcao } from "@/components/voluntario-picker";
import { editarAta } from "./actions";

type AtaEditFormProps = {
  ataId: number;
  canManage: boolean;
  ata: {
    titulo: string;
    data_reuniao: string;
    resumo: string | null;
    pontos_principais: string | null;
    deliberacoes: string | null;
  };
  voluntarios: VoluntarioOpcao[];
  participanteIds: string[];
};

const inputClass =
  "min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";

export function AtaEditForm({
  ataId,
  canManage,
  ata,
  voluntarios,
  participanteIds: participanteIdsIniciais,
}: AtaEditFormProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [titulo, setTitulo] = useState(ata.titulo);
  const [data, setData] = useState(ata.data_reuniao);
  const [pontos, setPontos] = useState(ata.pontos_principais ?? "");
  const [deliberacoes, setDeliberacoes] = useState(ata.deliberacoes ?? "");
  const [resumo, setResumo] = useState(ata.resumo ?? "");
  const [participanteIds, setParticipanteIds] = useState<string[]>(
    participanteIdsIniciais
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!canManage) return null;

  function startEditing() {
    setTitulo(ata.titulo);
    setData(ata.data_reuniao);
    setPontos(ata.pontos_principais ?? "");
    setDeliberacoes(ata.deliberacoes ?? "");
    setResumo(ata.resumo ?? "");
    setParticipanteIds(participanteIdsIniciais);
    setError("");
    setEditing(true);
  }

  function toggleParticipante(id: string) {
    setParticipanteIds((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id]
    );
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const form = new FormData();
    form.set("id", String(ataId));
    form.set("titulo", titulo);
    form.set("data_reuniao", data);
    form.set("resumo", resumo);
    form.set("pontos_principais", pontos);
    form.set("deliberacoes", deliberacoes);
    for (const id of participanteIds) form.append("voluntarioIds", id);

    const result = await editarAta(form);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="flex w-full justify-end">
        <button
          type="button"
          onClick={startEditing}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-xl font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          <Pencil size={22} aria-hidden="true" />
          Editar ata
        </button>
      </div>
    );
  }

  return (
    <section className="flex w-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
      <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
        <Pencil size={22} aria-hidden="true" />
        Editar ata
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label
          htmlFor="ata-editar-titulo"
          className="flex flex-col gap-1.5"
        >
          <span className="text-base font-medium text-zinc-700">
            Título da reunião
          </span>
          <input
            id="ata-editar-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className={inputClass}
          />
        </label>
        <label
          htmlFor="ata-editar-data"
          className="flex flex-col gap-1.5"
        >
          <span className="text-base font-medium text-zinc-700">Data</span>
          <DateInput
            id="ata-editar-data"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="flex flex-wrap items-center gap-2 text-base font-medium text-zinc-700">
          <Users size={18} aria-hidden="true" />
          Participantes
          <span className="rounded-full bg-[#E6E6E6] px-2.5 py-0.5 text-sm font-medium text-[#28627B]">
            {participanteIds.length} selecionado{participanteIds.length === 1 ? "" : "s"}
          </span>
        </span>
        <VoluntarioChecklist
          voluntarios={voluntarios}
          selectedIds={participanteIds}
          onToggle={toggleParticipante}
          maxHeightClass="max-h-56"
        />
        <p className="text-base text-zinc-500">
          Marque quem participou da reunião — mesmo quem só estava presente
          com a câmera fechada e não falou.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium text-zinc-700">
            Pontos principais
          </span>
          <textarea
            rows={5}
            value={pontos}
            onChange={(e) => setPontos(e.target.value)}
            className={`${inputClass} min-h-28 resize-y py-2`}
            placeholder={"Um ponto por linha, se quiser."}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium text-zinc-700">
            Deliberações
          </span>
          <textarea
            rows={5}
            value={deliberacoes}
            onChange={(e) => setDeliberacoes(e.target.value)}
            className={`${inputClass} min-h-28 resize-y py-2`}
            placeholder="Decisões, tarefas e encaminhamentos."
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-base font-medium text-zinc-700">Resumo</span>
        <textarea
          rows={4}
          value={resumo}
          onChange={(e) => setResumo(e.target.value)}
          className={`${inputClass} min-h-24 resize-y py-2`}
          placeholder="Principais pontos discutidos, decisões tomadas..."
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex min-h-12 items-center gap-1.5 rounded-lg bg-green-700 px-4 text-base font-medium text-white transition-colors hover:bg-green-800 disabled:opacity-60"
        >
          <Check size={16} aria-hidden="true" />
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="flex min-h-12 items-center gap-1.5 rounded-lg px-3 text-base font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
          <X size={16} aria-hidden="true" />
          Cancelar
        </button>
      </div>

      {error && (
        <p role="alert" className="text-base font-medium text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}