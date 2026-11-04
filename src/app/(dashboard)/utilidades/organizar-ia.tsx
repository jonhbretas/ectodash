"use client";

// Painel "Organizar com IA" (admin master = coordenador geral). A IA sugere
// área e tipo de cada card; as sugestões aparecem agrupadas por pasta
// (Área › Tipo) e só são gravadas depois de aprovadas manualmente.
import { useMemo, useState, useTransition } from "react";
import { AlertCircle, ArrowRight, CheckSquare, FolderTree, Loader2, Square, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  aplicarOrganizacao,
  sugerirOrganizacaoIA,
  type SugestaoOrganizacao,
} from "./utilidades-actions";
import { CATEGORIA_SUGGESTIONS, categoriaInfo } from "./categorias";

type Area = { id: number; nome: string };

type Linha = SugestaoOrganizacao & {
  aprovado: boolean;
  areaEscolhida: string; // "" = sem área
  categoriaEscolhida: string; // rótulo exibido
};

const inputClass =
  "min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:bg-zinc-100";

export default function OrganizarIA({
  areas,
  onClose,
  onConcluido,
}: {
  areas: Area[];
  onClose: () => void;
  onConcluido: (msg: string) => void;
}) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [analisando, startAnalise] = useTransition();
  const [aplicando, startAplicar] = useTransition();

  const nomeArea = (id: number | null) =>
    id == null ? "Sem área" : areas.find((a) => a.id === id)?.nome ?? "Sem área";

  function analisar() {
    setErro(null);
    setInfo(null);
    startAnalise(async () => {
      const res = await sugerirOrganizacaoIA();
      if (!res.ok || !res.sugestoes) {
        setErro(res.message);
        return;
      }
      setInfo(`${res.totalAnalisado} itens analisados. ${res.message}`.trim());
      setLinhas(
        res.sugestoes.map((s) => ({
          ...s,
          aprovado: true,
          areaEscolhida: s.areaSugerida == null ? "" : String(s.areaSugerida),
          categoriaEscolhida: categoriaInfo(s.categoriaSugerida).label,
        }))
      );
    });
  }

  function atualizar(id: number, patch: Partial<Linha>) {
    setLinhas((atual) => atual?.map((l) => (l.id === id ? { ...l, ...patch } : l)) ?? null);
  }

  function marcarTodos(valor: boolean) {
    setLinhas((atual) => atual?.map((l) => ({ ...l, aprovado: valor })) ?? null);
  }

  // Pastas: Área › Tipo pela sugestão da IA (estável enquanto o admin ajusta).
  const pastas = useMemo(() => {
    if (!linhas) return [];
    const mapa = new Map<string, { area: string; tipo: string; itens: Linha[] }>();
    for (const l of linhas) {
      const area = nomeArea(l.areaSugerida);
      const tipo = categoriaInfo(l.categoriaSugerida).label;
      const chave = `${area}|||${tipo}`;
      const pasta = mapa.get(chave) ?? { area, tipo, itens: [] };
      pasta.itens.push(l);
      mapa.set(chave, pasta);
    }
    return [...mapa.values()].sort(
      (a, b) => a.area.localeCompare(b.area, "pt-BR") || a.tipo.localeCompare(b.tipo, "pt-BR")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, areas]);

  const aprovados = linhas?.filter((l) => l.aprovado && l.categoriaEscolhida.trim()) ?? [];

  function aplicar() {
    setErro(null);
    startAplicar(async () => {
      const res = await aplicarOrganizacao(
        aprovados.map((l) => ({
          id: l.id,
          area_id: l.areaEscolhida ? Number(l.areaEscolhida) : null,
          categoria: l.categoriaEscolhida.trim(),
        }))
      );
      if (res.ok) onConcluido(res.message);
      else setErro(res.message);
    });
  }

  const ocupado = analisando || aplicando;

  return (
    <div className="flex w-full flex-col gap-4 rounded-2xl border-2 border-amber-300 bg-amber-50/40 p-5" aria-busy={ocupado}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-xl font-semibold text-zinc-900">
            <FolderTree size={22} className="text-amber-700" aria-hidden="true" />
            Organizar acervo com IA
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-sm font-bold text-amber-900">ADMIN</span>
          </span>
          <span className="text-base text-zinc-600">
            A IA sugere a pasta certa (área e tipo) para cada card. Nada muda até você aprovar.
            Ajuste o que quiser antes de aplicar.
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={ocupado}
          aria-label="Fechar"
          className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-200 disabled:opacity-50"
        >
          <X size={20} />
        </button>
      </div>

      {linhas === null && (
        <button
          type="button"
          onClick={analisar}
          disabled={analisando}
          className="flex min-h-14 w-fit items-center gap-2 rounded-xl bg-amber-600 px-5 text-lg font-semibold text-white hover:bg-amber-700 disabled:cursor-wait disabled:opacity-70"
        >
          {analisando ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <Wand2 size={20} aria-hidden="true" />}
          {analisando ? "Analisando o acervo... (pode levar até 1 minuto)" : "Analisar e sugerir organização"}
        </button>
      )}

      {erro && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-base text-red-700 ring-1 ring-red-200">
          <AlertCircle size={18} aria-hidden="true" />
          {erro}
        </p>
      )}

      {info && <p className="text-base text-zinc-700">{info}</p>}

      {linhas && linhas.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-medium text-zinc-900">
              {linhas.length} {linhas.length === 1 ? "mudança sugerida" : "mudanças sugeridas"}
            </span>
            <button type="button" onClick={() => marcarTodos(true)} disabled={ocupado} className="min-h-11 rounded-lg px-3 text-base font-medium text-[#28627B] hover:bg-[#2195B9]/10">
              Aprovar todas
            </button>
            <button type="button" onClick={() => marcarTodos(false)} disabled={ocupado} className="min-h-11 rounded-lg px-3 text-base font-medium text-zinc-600 hover:bg-zinc-100">
              Desmarcar todas
            </button>
          </div>

          <div className="flex flex-col gap-5">
            {pastas.map((pasta) => {
              const cat = categoriaInfo(pasta.tipo);
              return (
                <section key={`${pasta.area}-${pasta.tipo}`} className="flex flex-col gap-2">
                  <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-zinc-900">
                    <FolderTree size={20} className="text-zinc-500" aria-hidden="true" />
                    {pasta.area}
                    <span className="text-zinc-400">›</span>
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-base", cat.chip)}>
                      <cat.icon size={16} aria-hidden="true" />
                      {pasta.tipo}
                    </span>
                    <span className="text-base font-normal text-zinc-500">({pasta.itens.length})</span>
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {pasta.itens.map((l) => (
                      <li
                        key={l.id}
                        className={cn(
                          "flex flex-col gap-2 rounded-xl bg-white p-3 ring-1",
                          l.aprovado ? "ring-[#2195B9]" : "opacity-70 ring-zinc-200"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={l.aprovado}
                            aria-label={`Aprovar mudança de ${l.titulo}`}
                            onClick={() => atualizar(l.id, { aprovado: !l.aprovado })}
                            disabled={ocupado}
                            className="shrink-0 rounded p-0.5"
                          >
                            {l.aprovado ? (
                              <CheckSquare size={26} className="text-[#2195B9]" aria-hidden="true" />
                            ) : (
                              <Square size={26} className="text-zinc-400" aria-hidden="true" />
                            )}
                          </button>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-lg font-semibold text-zinc-900">{l.titulo}</span>
                            <span className="flex flex-wrap items-center gap-1 text-sm text-zinc-500">
                              Hoje: {nomeArea(l.areaAtual)} · {categoriaInfo(l.categoriaAtual).label}
                              <ArrowRight size={14} aria-hidden="true" />
                              <span className="font-medium text-zinc-700">sugestão abaixo</span>
                            </span>
                            {l.motivo && <span className="text-sm italic text-zinc-500">{l.motivo}</span>}
                          </div>
                        </div>
                        <fieldset disabled={ocupado || !l.aprovado} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <select
                            aria-label="Área"
                            value={l.areaEscolhida}
                            onChange={(e) => atualizar(l.id, { areaEscolhida: e.target.value })}
                            className={inputClass}
                          >
                            <option value="">Sem área</option>
                            {areas.map((a) => (
                              <option key={a.id} value={a.id}>{a.nome}</option>
                            ))}
                          </select>
                          <input
                            aria-label="Tipo de material"
                            value={l.categoriaEscolhida}
                            onChange={(e) => atualizar(l.id, { categoriaEscolhida: e.target.value })}
                            list="organizar-categorias"
                            className={inputClass}
                          />
                        </fieldset>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          <datalist id="organizar-categorias">
            {CATEGORIA_SUGGESTIONS.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>

          <div className="sticky bottom-4 flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow-lg ring-1 ring-zinc-200">
            <button
              type="button"
              onClick={aplicar}
              disabled={ocupado || aprovados.length === 0}
              className="flex min-h-12 items-center gap-2 rounded-lg bg-[#2195B9] px-5 text-lg font-semibold text-white hover:bg-[#28627B] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aplicando && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
              {aplicando ? "Aplicando..." : `Aplicar ${aprovados.length} ${aprovados.length === 1 ? "mudança aprovada" : "mudanças aprovadas"}`}
            </button>
            <button type="button" onClick={onClose} disabled={ocupado} className="rounded-lg px-3 py-2 text-lg text-zinc-600 hover:text-zinc-900 disabled:opacity-50">
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
