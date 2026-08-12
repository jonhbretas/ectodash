"use client";

// Inline-editable header for the demanda edit screen. Every field is
// click-to-edit with blur/Enter-to-save and Escape-to-cancel, using
// individual server actions. Avatars show responsáveis/membros with inline
// add/remove via a dropdown picker. This replaces the full-page DemandaForm
// that used to occupy the left column — the edit screen now has only
// checklist and comments in its two-column grid.
import { useState, useTransition, useEffect, useRef } from "react";
import { DateInput } from "@/components/ui/date-input";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  ChevronDown,
  Check,
  Pencil,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import StatusBadge, { type DemandaStatus } from "./status-badge";
import OverdueBadge from "./overdue-badge";
import VoluntarioPicker from "@/components/voluntario-picker";
import { agruparEventosPorMes } from "@/lib/eventos-agrupados";
import {
  FormCombobox,
  FormSelect,
  formSelectTriggerClass,
} from "@/components/ui/form-select";
import {
  SelectGroup,
  SelectLabel,
  SelectItem,
} from "@/components/ui/select";

// Trigger compacto para os pills de edição inline (o padrão é min-h-14).
const pillSelectClass = `${formSelectTriggerClass} min-h-10 w-40 max-w-72 rounded-lg border-zinc-300 px-2 py-1 text-lg focus:ring-2 focus:ring-[#2195B9]`;
import {
  criarEtiqueta,
  updateDemandaTitulo,
  updateDemandaPrazo,
  updateDemandaArea,
  updateDemandaProjeto,
  updateDemandaEvento,
  updateDemandaEtiqueta,
  updateDemandaStatus,
  addDemandaResponsavel,
  removeDemandaResponsavel,
  addDemandaMembro,
  removeDemandaMembro,
  corrigirDemandaComIa,
} from "./actions";

// The roster (public.voluntarios) is the source of truth for who can be a
// responsável/membro — id is the ROSTER id (stringified), not the auth
// account id; temConta marks volunteers whose access is already activated.
export type InlinePessoa = {
  id: string;
  nome: string;
  temConta?: boolean;
};

export type InlineEvento = {
  id: number;
  titulo: string;
  dataEvento: string;
  local?: string | null;
};
export type InlineEtiqueta = { id: number; area: string; nome: string };

export type InlineDemanda = {
  id: number;
  titulo: string;
  prazo: string;
  status: DemandaStatus;
  atrasada: boolean;
  area: string | null;
  projeto: string | null;
  eventoId: number | null;
  etiquetaId: number | null;
  eventoNome: string | null;
  etiquetaNome: string | null;
};

export type InlineEditorProps = {
  demanda: InlineDemanda;
  responsaveis: InlinePessoa[];
  membros: InlinePessoa[];
  allVoluntarios: InlinePessoa[];
  eventos: InlineEvento[];
  etiquetas: InlineEtiqueta[];
  // Nomes das áreas institucionais (areas_institucionais) — sugeridas no
  // campo Área via datalist; o texto livre continua aceito (legado).
  areas?: string[];
  // Nomes dos projetos cadastrados (projetos) + usados nas demandas —
  // sugeridos no campo Projeto via datalist.
  projetos?: string[];
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function display(p: InlinePessoa): string {
  return p.nome;
}

function dataEventoLabel(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function eventoLabel(ev: InlineEvento): string {
  const data = ev.dataEvento ? ` — ${dataEventoLabel(ev.dataEvento)}` : "";
  const local = ev.local ? ` · ${ev.local}` : "";
  return `${ev.titulo}${data}${local}`;
}

function InlineText({
  value,
  onSave,
  placeholder,
  className,
}: {
  value: string;
  onSave: (val: string) => Promise<boolean>;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function cancel() { setDraft(value); setEditing(false); }
  async function save() {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (ok) setEditing(false);
    else setDraft(value);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          disabled={saving}
          className={`min-h-12 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-lg text-zinc-900 outline-none focus:ring-2 focus:ring-[#2195B9] ${className ?? ""}`}
        />
        {saving && <span className="text-base text-zinc-400">salvando...</span>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Clique para editar"
      className="group flex items-center gap-1.5 rounded-lg px-2 py-1 -mx-1 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
    >
      <span className={className}>{value || (placeholder ?? "")}</span>
      <Pencil size={14} className="shrink-0 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
    </button>
  );
}

function InlinePill({
  label,
  value,
  placeholder,
  editing,
  children,
  onStart,
  onCancel,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  editing: React.ReactNode;
  children: React.ReactNode;
  onStart: () => void;
  onCancel: () => void;
}) {
  if (editing) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-zinc-200/60">
        <span className="text-base font-medium text-zinc-400 shrink-0">{label}</span>
        {editing}
        <button
          type="button"
          onClick={onCancel}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
          aria-label="Cancelar edição"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onStart}
      title={`Editar ${label}`}
      className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 text-base transition-all duration-200 hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
    >
      <span className="font-medium text-zinc-500">{label}</span>
      {children}
      {!value && <span className="text-zinc-400">{placeholder}</span>}
      <Pencil size={13} className="text-zinc-400" aria-hidden="true" />
    </button>
  );
}

function AvatarPill({ profile, onRemove }: { profile: InlinePessoa; onRemove?: () => void }) {
  return (
    <span
      className="group relative flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-base ring-1 ring-zinc-200/60"
      title={profile.temConta === false ? `${display(profile)} — sem acesso ativado` : undefined}
    >
      <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E6E6E6] text-xs font-semibold text-[#2195B9]">
        {initials(display(profile))}
      </span>
      <span className="truncate max-w-32 text-zinc-700">{display(profile)}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label={`Remover ${display(profile)}`}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-zinc-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
        >
          <X size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

function PersonPicker({
  pessoas,
  selectedIds,
  onAdd,
  label,
}: {
  pessoas: InlinePessoa[];
  selectedIds: Set<string>;
  onAdd: (id: string) => void;
  label: string;
}) {
  return (
    <VoluntarioPicker
      voluntarios={pessoas}
      selectedIds={selectedIds}
      onAdd={onAdd}
      label={label}
    />
  );
}


export default function DemandaInlineEditor({
  demanda,
  responsaveis,
  membros,
  allVoluntarios,
  eventos,
  etiquetas,
  areas = [],
  projetos = [],
}: InlineEditorProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [localTitulo, setLocalTitulo] = useState(demanda.titulo);
  const [localPrazo, setLocalPrazo] = useState(demanda.prazo);
  const [localArea, setLocalArea] = useState(demanda.area);
  const [localProjeto, setLocalProjeto] = useState(demanda.projeto);
  const [localEventoId, setLocalEventoId] = useState<number | null>(demanda.eventoId);
  const [localStatus, setLocalStatus] = useState<DemandaStatus>(demanda.status);

  // Etiqueta (may update independently via inline creation too)
  const [localEtiquetaId, setLocalEtiquetaId] = useState<number | null>(demanda.etiquetaId);
  const [localEtiquetas, setLocalEtiquetas] = useState(etiquetas);
  const [etiquetaNome, setEtiquetaNome] = useState(demanda.etiquetaNome);
  const [novaEtiquetaArea, setNovaEtiquetaArea] = useState("");
  const [novaEtiquetaNome, setNovaEtiquetaNome] = useState("");
  const [criandoEtiqueta, setCriandoEtiqueta] = useState(false);
  const [etiquetaError, setEtiquetaError] = useState("");

  const [localResponsaveis, setLocalResponsaveis] = useState(responsaveis);
  const [localMembros, setLocalMembros] = useState(membros);

  // Correção com IA — preenche campos faltantes e persiste via os mesmos
  // savers por campo (RLS do jeito de sempre); a mensagem pede revisão.
  const [corrigindoIa, setCorrigindoIa] = useState(false);
  const [corrigiuMensagem, setCorrigiuMensagem] = useState<string | null>(null);

  async function corrigirComIa() {
    setCorrigindoIa(true);
    setCorrigiuMensagem(null);
    const resultado = await corrigirDemandaComIa(demanda.id);
    if (!resultado.ok || !resultado.sugestao) {
      setCorrigiuMensagem(
        resultado.message || "Não foi possível corrigir agora. Tente novamente."
      );
      setCorrigindoIa(false);
      return;
    }
    const { area, projeto, responsavelId, eventoId } = resultado.sugestao;
    const preenchidos: string[] = [];
    if (area && !localArea?.trim()) {
      await saveArea(area);
      preenchidos.push("Área");
    }
    if (projeto && !localProjeto?.trim()) {
      await saveProjeto(projeto);
      preenchidos.push("Projeto");
    }
    if (eventoId !== null && localEventoId === null) {
      await saveEvento(String(eventoId));
      preenchidos.push("Evento");
    }
    if (responsavelId && !respIds.has(responsavelId)) {
      await addResp(responsavelId);
      preenchidos.push("Responsável");
    }
    setCorrigindoIa(false);
    setCorrigiuMensagem(
      preenchidos.length > 0
        ? `Preenchido com IA: ${preenchidos.join(", ")}. Revise os campos se necessário.`
        : "A IA não encontrou informações para preencher os campos faltantes."
    );
  }

  // Active editing pill — only one at a time.
  const [editingPill, setEditingPill] = useState<string | null>(null);

  // Shared ref for the currently-editing input/select (only one renders at
  // a time). Focus it via effect when the pill changes.
  const editingRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  useEffect(() => { editingRef.current?.focus(); }, [editingPill]);

  function refresh() { startTransition(() => router.refresh()); }

  const respIds = new Set(localResponsaveis.map((r) => r.id));
  const membroIds = new Set(localMembros.map((m) => m.id));

  // ── Inline field savers ──
  async function saveTitulo(val: string) {
    setLocalTitulo(val);
    const r = await updateDemandaTitulo(demanda.id, val);
    if (r.ok) refresh(); else setLocalTitulo(demanda.titulo);
    return r.ok;
  }
  async function savePrazo(val: string) {
    setLocalPrazo(val);
    const r = await updateDemandaPrazo(demanda.id, val);
    if (r.ok) refresh(); else setLocalPrazo(demanda.prazo);
    return r.ok;
  }
  async function saveArea(val: string) {
    setLocalArea(val || null);
    const r = await updateDemandaArea(demanda.id, val || null);
    if (r.ok) refresh(); else setLocalArea(demanda.area);
    return r.ok;
  }
  async function saveProjeto(val: string) {
    setLocalProjeto(val || null);
    const r = await updateDemandaProjeto(demanda.id, val || null);
    if (r.ok) refresh(); else setLocalProjeto(demanda.projeto);
    return r.ok;
  }
  async function saveEvento(val: string) {
    const id = val ? Number(val) : null;
    setLocalEventoId(id);
    const r = await updateDemandaEvento(demanda.id, id);
    if (r.ok) refresh(); else setLocalEventoId(demanda.eventoId);
    return r.ok;
  }
  async function saveStatus(val: string) {
    const s = val as DemandaStatus;
    setLocalStatus(s);
    const r = await updateDemandaStatus(demanda.id, s);
    if (r.ok) refresh(); else setLocalStatus(demanda.status);
    return r.ok;
  }
  async function saveEtiqueta(val: string) {
    const id = val ? Number(val) : null;
    setLocalEtiquetaId(id);
    const r = await updateDemandaEtiqueta(demanda.id, id);
    if (r.ok) {
      const found = localEtiquetas.find((e) => e.id === id);
      setEtiquetaNome(found ? `${found.nome} (${found.area})` : null);
      refresh();
    } else {
      setLocalEtiquetaId(demanda.etiquetaId);
    }
    return r.ok;
  }

  async function handleCriarEtiqueta() {
    if (!novaEtiquetaArea.trim() || !novaEtiquetaNome.trim()) {
      setEtiquetaError("Preencha a área e o nome.");
      return;
    }
    setEtiquetaError("");
    const fd = new FormData();
    fd.set("area", novaEtiquetaArea.trim());
    fd.set("nome", novaEtiquetaNome.trim());
    const result = await criarEtiqueta({ ok: false, message: "", id: null }, fd);
    if (result.ok && result.id) {
      const nova = { id: result.id, area: novaEtiquetaArea.trim(), nome: novaEtiquetaNome.trim() };
      setLocalEtiquetas((c) => [...c, nova]);
      setLocalEtiquetaId(result.id);
      setEtiquetaNome(`${nova.nome} (${nova.area})`);
      updateDemandaEtiqueta(demanda.id, result.id).then(refresh);
      setCriandoEtiqueta(false);
      setNovaEtiquetaArea("");
      setNovaEtiquetaNome("");
    } else {
      setEtiquetaError(result.message);
    }
  }

  // ── People ──
  async function addResp(id: string) {
    const pessoa = allVoluntarios.find((p) => p.id === id);
    if (!pessoa || respIds.has(id)) return;
    setLocalResponsaveis((c) => [...c, pessoa]);
    const r = await addDemandaResponsavel(demanda.id, id);
    if (r.ok) refresh(); else setLocalResponsaveis((c) => c.filter((p) => p.id !== id));
  }
  async function removeResp(id: string) {
    setLocalResponsaveis((c) => c.filter((p) => p.id !== id));
    const r = await removeDemandaResponsavel(demanda.id, id);
    if (r.ok) refresh();
  }
  async function addMembro(id: string) {
    const pessoa = allVoluntarios.find((p) => p.id === id);
    if (!pessoa || membroIds.has(id)) return;
    setLocalMembros((c) => [...c, pessoa]);
    const r = await addDemandaMembro(demanda.id, id);
    if (r.ok) refresh(); else setLocalMembros((c) => c.filter((p) => p.id !== id));
  }
  async function removeMembro(id: string) {
    setLocalMembros((c) => c.filter((p) => p.id !== id));
    const r = await removeDemandaMembro(demanda.id, id);
    if (r.ok) refresh();
  }

  const prazoFormatado = format(new Date(`${localPrazo}T00:00:00`), "dd/MM/yyyy", { locale: ptBR });
  const eventoAtual = eventos.find((e) => e.id === localEventoId);
  const etiquetaAtual = localEtiquetas.find((e) => e.id === localEtiquetaId);

  return (
    <div className="flex w-full flex-col gap-6">
      {/* ── Title row ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <InlineText
            value={localTitulo}
            onSave={saveTitulo}
            placeholder="Título da demanda"
            className="text-3xl font-semibold text-zinc-900"
          />
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={localStatus} />
            {demanda.atrasada && <OverdueBadge prazo={localPrazo} />}
          </div>
        </div>
      </div>

      {/* ── People section — avatars with add buttons ── */}
      <div className="flex flex-col gap-3 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200/60">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-base font-semibold text-zinc-500 shrink-0">Responsáveis</span>
          <div className="flex flex-wrap items-center gap-2">
            {localResponsaveis.map((p) => (
              <AvatarPill key={p.id} profile={p} onRemove={() => removeResp(p.id)} />
            ))}
            <PersonPicker pessoas={allVoluntarios} selectedIds={respIds} onAdd={addResp} label="responsável" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-base font-semibold text-zinc-500 shrink-0">Acompanhantes</span>
          <div className="flex flex-wrap items-center gap-2">
            {localMembros.map((p) => (
              <AvatarPill key={p.id} profile={p} onRemove={() => removeMembro(p.id)} />
            ))}
            <PersonPicker pessoas={allVoluntarios} selectedIds={membroIds} onAdd={addMembro} label="acompanhante" />
            {localMembros.length === 0 && (
              <span className="text-base text-zinc-400">Nenhum acompanhante</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Dashed separator ── */}

      {/* ── Metadata pills — inline click-to-edit ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Prazo */}
        {editingPill === "prazo" ? (
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-zinc-200/60">
            <Calendar size={18} className="text-zinc-400" aria-hidden="true" />
            <DateInput
              ref={editingRef as any}
              value={localPrazo}
              onChange={(e) => setLocalPrazo(e.target.value)}
              className="min-h-10 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-lg text-zinc-900 outline-none focus:ring-2 focus:ring-[#2195B9]"
            />
            <button
              type="button"
              onClick={async () => { const ok = await savePrazo(localPrazo); if (ok) setEditingPill(null); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-green-600 transition-colors hover:bg-green-50"
              aria-label="Salvar prazo"
            >
              <Check size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => { setLocalPrazo(demanda.prazo); setEditingPill(null); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100"
              aria-label="Cancelar"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingPill("prazo")}
            className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 text-base transition-all duration-200 hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            title="Editar prazo"
          >
            <Calendar size={16} className="text-zinc-500" aria-hidden="true" />
            <span className={demanda.atrasada ? "font-medium text-red-700" : "text-zinc-700"}>
              Prazo: {prazoFormatado}
            </span>
            <Pencil size={13} className="text-zinc-400" aria-hidden="true" />
          </button>
        )}

        {/* Status */}
        {editingPill === "status" ? (
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-zinc-200/60">
            <FormSelect
              value={localStatus}
              onValueChange={(v) => setLocalStatus(v as DemandaStatus)}
              options={[
                { value: "pendente", label: "Pendente" },
                { value: "em_andamento", label: "Em andamento" },
                { value: "concluida", label: "Concluída" },
              ]}
              className={pillSelectClass}
            />
            <button type="button" onClick={async () => { const ok = await saveStatus(localStatus); if (ok) setEditingPill(null); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-green-600 hover:bg-green-50" aria-label="Salvar status">
              <Check size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => { setLocalStatus(demanda.status); setEditingPill(null); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100" aria-label="Cancelar">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingPill("status")}
            className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 text-base transition-all duration-200 hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            title="Editar status"
          >
            <span className="font-medium text-zinc-500">Status:</span>
            <StatusBadge status={localStatus} />
            <Pencil size={13} className="text-zinc-400" aria-hidden="true" />
          </button>
        )}

        {/* Área */}
        {editingPill === "area" ? (
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-zinc-200/60">
            <FormCombobox
              value={localArea ?? ""}
              onChange={setLocalArea}
              options={areas}
              placeholder="Área"
              className={pillSelectClass}
            />
            <button type="button" onClick={async () => { await saveArea(localArea ?? ""); setEditingPill(null); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-green-600 hover:bg-green-50" aria-label="Salvar área">
              <Check size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => { setLocalArea(demanda.area); setEditingPill(null); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100" aria-label="Cancelar">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditingPill("area")}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-base transition-all duration-200 hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            style={{ backgroundColor: localArea ? "#f4f4f5" : "transparent", border: localArea ? "" : "1px dashed #d4d4d8" }}
            title="Editar área"
          >
            <span className="font-medium text-zinc-500">Área:</span>
            <span className="text-zinc-700">{localArea || "Sem área"}</span>
            <Pencil size={13} className="text-zinc-400" aria-hidden="true" />
          </button>
        )}

        {/* Projeto */}
        {editingPill === "projeto" ? (
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-zinc-200/60">
            <FormCombobox
              value={localProjeto ?? ""}
              onChange={setLocalProjeto}
              options={projetos}
              placeholder="Projeto"
              className={pillSelectClass}
            />
            <button type="button" onClick={async () => { await saveProjeto(localProjeto ?? ""); setEditingPill(null); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-green-600 hover:bg-green-50" aria-label="Salvar projeto">
              <Check size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => { setLocalProjeto(demanda.projeto); setEditingPill(null); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100" aria-label="Cancelar">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditingPill("projeto")}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-base transition-all duration-200 hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            style={{ backgroundColor: localProjeto ? "#eff6ff" : "transparent", border: localProjeto ? "" : "1px dashed #d4d4d8" }}
            title="Editar projeto"
          >
            <span className="font-medium text-zinc-500">Projeto:</span>
            <span className="text-zinc-700">{localProjeto || "Sem projeto"}</span>
            <Pencil size={13} className="text-zinc-400" aria-hidden="true" />
          </button>
        )}

        {/* Evento */}
        {editingPill === "evento" ? (
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-zinc-200/60">
            <FormSelect
              value={String(localEventoId ?? "")}
              onValueChange={(v) => setLocalEventoId(v ? Number(v) : null)}
              placeholder="Nenhum evento"
              className={pillSelectClass}
            >
              {agruparEventosPorMes(
                eventos.map((ev) => ({
                  id: ev.id,
                  titulo: ev.titulo,
                  data_evento: ev.dataEvento,
                  local: ev.local ?? null,
                }))
              ).map((grupo) => (
                <SelectGroup key={grupo.label}>
                  <SelectLabel className="px-2 py-1.5 text-base font-semibold text-zinc-500">
                    {grupo.label}
                  </SelectLabel>
                  {grupo.eventos.map((ev) => (
                    <SelectItem
                      key={ev.id}
                      value={String(ev.id)}
                      className="rounded-lg py-2.5 text-lg data-[highlighted]:bg-zinc-100"
                    >
                      {eventoLabel({
                        id: ev.id,
                        titulo: ev.titulo,
                        dataEvento: ev.data_evento,
                        local: ev.local ?? null,
                      })}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </FormSelect>
            <button type="button" onClick={async () => { await saveEvento(String(localEventoId ?? "")); setEditingPill(null); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-green-600 hover:bg-green-50" aria-label="Salvar evento">
              <Check size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => { setLocalEventoId(demanda.eventoId); setEditingPill(null); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100" aria-label="Cancelar">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditingPill("evento")}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-base transition-all duration-200 hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            style={{ backgroundColor: localEventoId ? "#faf5ff" : "transparent", border: localEventoId ? "" : "1px dashed #d4d4d8" }}
            title="Editar evento"
          >
            <span className="font-medium text-zinc-500">Evento:</span>
            <span className="text-zinc-700">{eventoAtual ? eventoLabel(eventoAtual) : "Nenhum"}</span>
            <Pencil size={13} className="text-zinc-400" aria-hidden="true" />
          </button>
        )}

        {/* Etiqueta */}
        {editingPill === "etiqueta" ? (
          <div className="flex flex-col gap-2 rounded-xl bg-white p-3 ring-1 ring-zinc-200/60">
            <div className="flex items-center gap-2">
              <FormSelect
                value={String(localEtiquetaId ?? "")}
                onValueChange={(v) => setLocalEtiquetaId(v ? Number(v) : null)}
                placeholder="Nenhuma etiqueta"
                className={`${pillSelectClass} max-w-56`}
                options={localEtiquetas.map((et) => ({
                  value: String(et.id),
                  label: `${et.nome} (${et.area})`,
                }))}
              />
              <button type="button" onClick={async () => { await saveEtiqueta(String(localEtiquetaId ?? "")); setEditingPill(null); }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-green-600 hover:bg-green-50" aria-label="Salvar etiqueta">
                <Check size={16} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => { setLocalEtiquetaId(demanda.etiquetaId); setEditingPill(null); }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100" aria-label="Cancelar">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            {criandoEtiqueta ? (
              <div className="flex flex-wrap items-center gap-2">
                <input value={novaEtiquetaArea} onChange={(e) => setNovaEtiquetaArea(e.target.value)}
                  placeholder="Área" className="min-h-10 w-32 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-lg" />
                <input value={novaEtiquetaNome} onChange={(e) => setNovaEtiquetaNome(e.target.value)}
                  placeholder="Nome" className="min-h-10 w-32 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-lg" />
                <button type="button" onClick={handleCriarEtiqueta}
                  className="min-h-10 rounded-lg bg-[#2195B9] px-3 text-base font-medium text-white transition-colors hover:bg-[#28627B]">
                  Criar
                </button>
                <button type="button" onClick={() => { setCriandoEtiqueta(false); setEtiquetaError(""); }}
                  className="text-base text-zinc-500 hover:text-zinc-700">Cancelar</button>
                {etiquetaError && <span className="text-base text-red-600">{etiquetaError}</span>}
              </div>
            ) : (
              <button type="button" onClick={() => setCriandoEtiqueta(true)}
                className="self-start text-base font-medium text-[#2195B9] transition-colors hover:text-[#2195B9]">
                + Nova etiqueta
              </button>
            )}
          </div>
        ) : (
          <button type="button" onClick={() => setEditingPill("etiqueta")}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-base transition-all duration-200 hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            style={{ backgroundColor: localEtiquetaId ? "#fffbeb" : "transparent", border: localEtiquetaId ? "" : "1px dashed #d4d4d8" }}
            title="Editar etiqueta"
          >
            <span className="font-medium text-zinc-500">Etiqueta:</span>
            <span className="text-zinc-700">{etiquetaAtual ? `${etiquetaAtual.nome} (${etiquetaAtual.area})` : "Nenhuma"}</span>
            <Pencil size={13} className="text-zinc-400" aria-hidden="true" />
          </button>
        )}

        {/* Preenche campos faltantes com IA */}
        <button
          type="button"
          onClick={corrigirComIa}
          disabled={corrigindoIa}
          title="Preencher com IA os campos ainda vazios (área, responsável, projeto, evento)"
          className="flex items-center gap-1.5 rounded-full bg-[#E6E6E6] px-3 py-1.5 text-base font-medium text-[#2195B9] ring-1 ring-[#E6E6E6]/60 transition-all duration-200 hover:bg-[#E6E6E6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles size={15} aria-hidden="true" />
          {corrigindoIa ? "Corrigindo..." : "Preencher com IA"}
        </button>
      </div>

      {corrigiuMensagem && (
        <p className="rounded-xl bg-[#E6E6E6] px-4 py-2.5 text-base text-[#28627B] ring-1 ring-[#E6E6E6]/60">
          {corrigiuMensagem}
        </p>
      )}
    </div>
  );
}
