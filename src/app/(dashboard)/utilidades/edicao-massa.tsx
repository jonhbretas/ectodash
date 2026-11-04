"use client";

// Barra de edição em massa de Links Úteis: aparece fixa no rodapé quando há
// itens selecionados. Campos vazios = "manter como está".
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Trash2, X, AlertCircle } from "lucide-react";
import { editarUtilidadesEmMassa, excluirUtilidadesEmMassa } from "./utilidades-actions";
import { CATEGORIA_SUGGESTIONS } from "./categorias";

type Area = { id: number; nome: string };

const inputClass =
  "min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:bg-zinc-100";

const MANTER = "__manter__";
const SEM_AREA = "__sem_area__";

function splitTags(valor: string): string[] {
  return valor.split(",").map((t) => t.trim()).filter(Boolean);
}

export default function EdicaoMassa({
  areas,
  selecionados,
  onLimpar,
  onConcluido,
}: {
  areas: Area[];
  selecionados: number[];
  onLimpar: () => void;
  onConcluido: (mensagem: string) => void;
}) {
  const [area, setArea] = useState(MANTER);
  const [categoria, setCategoria] = useState("");
  const [tagsAdd, setTagsAdd] = useState("");
  const [tagsRem, setTagsRem] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [pending, startTransition] = useTransition();

  const total = selecionados.length;
  const temAlteracao =
    area !== MANTER || categoria.trim() !== "" || tagsAdd.trim() !== "" || tagsRem.trim() !== "";

  function aplicar() {
    setErro(null);
    startTransition(async () => {
      const res = await editarUtilidadesEmMassa({
        ids: selecionados,
        area_id: area === MANTER ? undefined : area === SEM_AREA ? null : Number(area),
        categoria: categoria.trim() || undefined,
        tagsAdicionar: splitTags(tagsAdd),
        tagsRemover: splitTags(tagsRem),
      });
      if (res.ok) onConcluido(res.message);
      else setErro(res.message);
    });
  }

  function excluir() {
    setErro(null);
    startTransition(async () => {
      const res = await excluirUtilidadesEmMassa(selecionados);
      if (res.ok) onConcluido(res.message);
      else {
        setErro(res.message);
        setConfirmandoExclusao(false);
      }
    });
  }

  return (
    <div
      role="region"
      aria-label="Edição em massa"
      aria-busy={pending}
      className="sticky bottom-4 z-20 flex w-full flex-col gap-3 rounded-2xl border-2 border-[#2195B9] bg-white p-4 shadow-lg"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xl font-semibold text-zinc-900">
          <CheckCircle2 size={22} className="text-[#2195B9]" aria-hidden="true" />
          {total} {total === 1 ? "item selecionado" : "itens selecionados"}
        </p>
        <button
          type="button"
          onClick={onLimpar}
          disabled={pending}
          className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-base font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
        >
          <X size={18} aria-hidden="true" />
          Limpar seleção
        </button>
      </div>

      <p className="text-base text-zinc-500">
        Preencha só o que quer mudar. Campos em branco ficam como estão.
      </p>

      <fieldset disabled={pending} className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-base font-medium text-zinc-800">Mudar área para</span>
          <select value={area} onChange={(e) => setArea(e.target.value)} className={inputClass}>
            <option value={MANTER}>— Manter a área atual —</option>
            <option value={SEM_AREA}>Sem área</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-base font-medium text-zinc-800">Mudar tipo de material para</span>
          <input
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            list="categoria-massa"
            placeholder="Deixe em branco para manter"
            className={inputClass}
          />
          <datalist id="categoria-massa">
            {CATEGORIA_SUGGESTIONS.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-base font-medium text-zinc-800">Adicionar palavras-chave</span>
          <input
            value={tagsAdd}
            onChange={(e) => setTagsAdd(e.target.value)}
            placeholder="Separadas por vírgula"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-base font-medium text-zinc-800">Remover palavras-chave</span>
          <input
            value={tagsRem}
            onChange={(e) => setTagsRem(e.target.value)}
            placeholder="Separadas por vírgula"
            className={inputClass}
          />
        </label>
      </fieldset>

      {erro && (
        <p role="alert" className="flex items-center gap-2 text-base text-red-700">
          <AlertCircle size={18} aria-hidden="true" />
          {erro}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={aplicar}
          disabled={pending || !temAlteracao}
          className="flex min-h-12 items-center gap-2 rounded-lg bg-[#2195B9] px-5 text-lg font-semibold text-white transition-colors hover:bg-[#28627B] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending && !confirmandoExclusao && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
          {pending && !confirmandoExclusao ? "Salvando..." : `Aplicar em ${total} ${total === 1 ? "item" : "itens"}`}
        </button>

        {!confirmandoExclusao ? (
          <button
            type="button"
            onClick={() => setConfirmandoExclusao(true)}
            disabled={pending}
            className="ml-auto flex min-h-12 items-center gap-2 rounded-lg px-4 text-lg font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={18} aria-hidden="true" />
            Excluir selecionados
          </button>
        ) : (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-base font-medium text-red-800">
              Excluir {total} {total === 1 ? "item" : "itens"}? Não pode ser desfeito.
            </span>
            <button
              type="button"
              onClick={excluir}
              disabled={pending}
              className="flex min-h-12 items-center gap-2 rounded-lg bg-red-700 px-4 text-lg font-medium text-white hover:bg-red-800 disabled:cursor-wait disabled:opacity-70"
            >
              {pending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Trash2 size={18} aria-hidden="true" />}
              {pending ? "Excluindo..." : "Confirmar exclusão"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoExclusao(false)}
              disabled={pending}
              className="rounded-lg px-3 py-2 text-lg text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
            >
              Voltar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
