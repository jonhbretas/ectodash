"use client";

// "Adicionar por IA" no acervo de Utilidades — o coordenador cola o texto
// (slides, pareceres, documentos), a IA propõe cards (título, descrição
// curta, categoria, tags, URL) e a revisão permite editar, excluir ou
// pular possíveis duplicados antes de salvar em lote.
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Sparkles,
  Loader2,
  Save,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  X,
  Trash2,
} from "lucide-react";
import {
  gerarItensComIA,
  salvarItensGeradosIA,
  type GerarItensState,
  type SalvarItensState,
} from "./utilidades-actions";

type Area = { id: number; nome: string };

type ReviewItem = {
  key: string;
  titulo: string;
  descricao: string;
  categoria: string;
  url: string;
  tags: string;
  duplicado: boolean;
  incluir: boolean;
};

const initial: GerarItensState = { ok: false, message: "", itens: null };
const EMPTY_INPUT = "Cole um texto antes de gerar os cards.";

const CATEGORIA_SUGGESTIONS = [
  "Ata de Fundação",
  "Estatuto",
  "Logos e Identidade Visual",
  "Ficha de Proposição de Curso",
  "Grade Curricular — IC",
  "Links Úteis",
  "Qualificação Docente",
  "Atividades Parapedagógicas",
  "Outros Documentos",
];

const inputClass =
  "min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";

export default function UtilidadesIA({ areas }: { areas: Area[] }) {
  const [key, setKey] = useState(0);
  return <AIFlow key={key} areas={areas} onReset={() => setKey((k) => k + 1)} />;
}

function AIFlow({
  areas,
  onReset,
}: {
  areas: Area[];
  onReset: () => void;
}) {
  const [state, formAction] = useActionState(gerarItensComIA, initial);
  const [show, setShow] = useState(false);
  const [areaId, setAreaId] = useState("");

  const hasResults = state.ok && state.itens !== null;

  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setShow(true)}
        className="flex min-h-12 w-fit items-center gap-2 rounded-xl border border-dashed border-[#2195B9]/40 bg-[#2195B9]/5 px-4 py-2 text-lg font-medium text-[#2195B9] transition-colors hover:border-[#2195B9] hover:bg-[#2195B9]/10"
      >
        <Sparkles size={20} />
        Adicionar por IA
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {!hasResults ? (
        <IAForm
          areas={areas}
          areaId={areaId}
          setAreaId={setAreaId}
          formAction={formAction}
          state={state}
          onClose={() => setShow(false)}
        />
      ) : (
        <IAReview
          itens={state.itens}
          areaId={areaId}
          onDiscard={onReset}
          onConcluir={onReset}
        />
      )}
    </div>
  );
}

function IAForm({
  areas,
  areaId,
  setAreaId,
  formAction,
  state,
  onClose,
}: {
  areas: Area[];
  areaId: string;
  setAreaId: (v: string) => void;
  formAction: (formData: FormData) => void;
  state: GerarItensState;
  onClose: () => void;
}) {
  const isError = !state.ok && state.message !== "" && state.message !== EMPTY_INPUT;
  const isEmpty = !state.ok && state.message === EMPTY_INPUT;

  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-lg font-semibold text-zinc-900">
            Criar cards com IA
          </span>
          <span className="text-sm text-zinc-500">
            Cole o conteúdo (slides, parecer, documento) e a IA propõe os cards
            do acervo para você revisar antes de salvar.
          </span>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-200" aria-label="Fechar">
          <X size={18} />
        </button>
      </div>

      <textarea
        name="texto"
        required
        rows={6}
        placeholder="Cole aqui o texto para a IA transformar em cards..."
        className={`${inputClass} min-h-32 resize-y py-3`}
      />
      {isEmpty && <span className="text-sm text-red-700">{state.message}</span>}

      <select
        name="area_id"
        value={areaId}
        onChange={(e) => setAreaId(e.target.value)}
        className={inputClass}
      >
        <option value="">Escolha a área dos cards (opcional)</option>
        {areas.map((area) => (
          <option key={area.id} value={area.id}>{area.nome}</option>
        ))}
      </select>

      {isError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
          <p className="text-sm text-red-700">{state.message}</p>
        </div>
      )}

      <SubmitIA />
      <PendingHint />
    </form>
  );
}

function SubmitIA() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#2195B9] to-[#28627B] px-4 text-lg font-medium text-white transition-colors hover:from-[#28627B] hover:to-[#28627B] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (
        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
      ) : (
        <Sparkles size={18} aria-hidden="true" />
      )}
      {pending ? "Gerando cards..." : "Criar cards com IA"}
    </button>
  );
}

function PendingHint() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <p className="text-sm text-zinc-500">
      A IA está lendo o conteúdo. Isso pode levar alguns segundos...
    </p>
  );
}

function IAReview({
  itens,
  areaId,
  onDiscard,
  onConcluir,
}: {
  itens: GerarItensState["itens"];
  areaId: string;
  onDiscard: () => void;
  onConcluir: () => void;
}) {
  const [items, setItems] = useState<ReviewItem[]>(() =>
    (itens ?? []).map((it) => ({
      key: crypto.randomUUID(),
      titulo: it.titulo,
      descricao: it.descricao,
      categoria: it.categoria,
      url: it.url,
      tags: it.tags.join(", "),
      duplicado: it.duplicado,
      incluir: !it.duplicado,
    }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SalvarItensState | null>(null);

  const incluidos = items.filter((i) => i.incluir).length;

  function update(key: string, patch: Partial<ReviewItem>) {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, ...patch } : i))
    );
  }

  if (saved?.ok) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="flex items-center gap-2 text-lg font-medium text-green-800">
          <CheckCircle2 size={20} />
          {saved.message}
        </p>
        <p className="text-base text-zinc-600">
          Os cards foram adicionados ao acervo. Confira na grade abaixo.
        </p>
        <button
          type="button"
          onClick={onConcluir}
          className="flex min-h-11 items-center gap-2 rounded-lg bg-[#2195B9] px-4 text-base font-medium text-white transition-colors hover:bg-[#28627B]"
        >
          <CheckCircle2 size={16} />
          Concluir
        </button>
      </div>
    );
  }

  async function salvar() {
    setSaving(true);
    const res = await salvarItensGeradosIA(
      items
        .filter((i) => i.incluir)
        .map((i) => ({
          titulo: i.titulo.trim(),
          descricao: i.descricao.trim(),
          categoria: i.categoria.trim(),
          url: i.url.trim(),
          tags: i.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          area_id: areaId ? Number(areaId) : null,
        }))
    );
    setSaved(res);
    setSaving(false);
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-lg font-semibold text-zinc-900">
          Revisar cards sugeridos
        </span>
        <span className="rounded-full bg-[#2195B9]/10 px-3 py-1 text-sm font-medium text-[#2195B9]">
          {incluidos} de {items.length} selecionados
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div
            key={item.key}
            className={`flex flex-col gap-2 rounded-xl border p-4 ${
              item.duplicado
                ? "border-amber-200 bg-amber-50/50"
                : "border-zinc-200 bg-zinc-50/50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                <input
                  type="checkbox"
                  checked={item.incluir}
                  onChange={(e) => update(item.key, { incluir: e.target.checked })}
                  className="h-4 w-4 accent-[#2195B9]"
                />
                Incluir no acervo
              </label>
              {item.duplicado && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  Possível duplicado: {item.titulo && `“${item.titulo}”`} já tem
                  card com título parecido
                </span>
              )}
            </div>

            <input
              value={item.titulo}
              onChange={(e) => update(item.key, { titulo: e.target.value })}
              placeholder="Título do card"
              className={inputClass}
            />
            <input
              value={item.descricao}
              onChange={(e) => update(item.key, { descricao: e.target.value })}
              placeholder="Descrição curta"
              className={inputClass}
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="relative">
                <input
                  value={item.categoria}
                  onChange={(e) => update(item.key, { categoria: e.target.value })}
                  list="ia-categorias"
                  placeholder="Categoria"
                  className={inputClass}
                />
                <datalist id="ia-categorias">
                  {CATEGORIA_SUGGESTIONS.map((label) => (
                    <option key={label} value={label} />
                  ))}
                </datalist>
              </div>
              <input
                value={item.url}
                onChange={(e) => update(item.key, { url: e.target.value })}
                placeholder="URL (opcional)"
                className={inputClass}
              />
            </div>
            <input
              value={item.tags}
              onChange={(e) => update(item.key, { tags: e.target.value })}
              placeholder="Tags separadas por vírgula"
              className={inputClass}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={salvar}
          disabled={saving || incluidos === 0}
          className="flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-base font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Save size={16} aria-hidden="true" />
          )}
          {saving
            ? "Salvando..."
            : `Salvar ${incluidos} ${incluidos === 1 ? "card" : "cards"}`}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-base text-zinc-600 transition-colors hover:text-red-700"
        >
          <Trash2 size={16} aria-hidden="true" />
          Descartar tudo
        </button>
      </div>

      {saved && !saved.ok && (
        <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} aria-hidden="true" />
          {saved.message}
        </p>
      )}

      <p className="flex items-center gap-1.5 text-sm text-zinc-500">
        <ChevronDown size={14} className="rotate-180" aria-hidden="true" />
        Cards com descrição muito longa serão salvos mesmo assim; mantenha as
        descrições curtas para cards compactos.
      </p>
    </div>
  );
}
