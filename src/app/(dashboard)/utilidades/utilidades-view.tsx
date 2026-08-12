"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { ExternalLink, Search, Trash2, Pencil, Layers, FileText, BookOpen, Image, GraduationCap, Link2, Wrench, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { atualizarUtilidadeItem, excluirUtilidadeItemSimples, type UtilidadeState } from "./utilidades-actions";

type Area = { id: number; nome: string };
type Item = {
  id: number;
  titulo: string;
  descricao: string | null;
  categoria: string;
  url: string | null;
  arquivo_nome: string | null;
  area_id: number | null;
  area_nome: string | null;
  tags: string[];
};

const CATEGORIAS: Record<string, { label: string; icon: typeof BookOpen }> = {
  ata_fundacao: { label: "Ata de Fundação", icon: FileText },
  estatuto: { label: "Estatuto", icon: BookOpen },
  logo: { label: "Logos e Identidade Visual", icon: Image },
  ficha_proposicao: { label: "Ficha de Proposição de Curso", icon: FileText },
  grade_curricular: { label: "Grade Curricular — IC", icon: GraduationCap },
  links_uteis: { label: "Links Úteis", icon: Link2 },
  qualificacao_docente: { label: "Qualificação Docente", icon: GraduationCap },
  atividades_parapedagogicas: { label: "Atividades Parapedagógicas", icon: BookOpen },
  outro: { label: "Outros Documentos", icon: Wrench },
};

function categoriaInfo(categoria: string) {
  return CATEGORIAS[categoria] ?? { label: categoria, icon: Wrench };
}

const CATEGORIA_SUGGESTIONS = Object.values(CATEGORIAS).map((c) => c.label);

const initialEdit: UtilidadeState = { ok: false, message: "" };

const inputClass = "min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";

export default function UtilidadesView({ areas, items, podeGerenciar = false }: { areas: Area[]; items: Item[]; podeGerenciar?: boolean }) {
  const [activeTab, setActiveTab] = useState("todos");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("todas");

  const tabs = useMemo(() => {
    const all = [{ id: "todos", label: "Todos", count: items.length }];
    for (const area of areas) {
      const count = items.filter((i) => i.area_id === area.id).length;
      all.push({ id: `area-${area.id}`, label: area.nome, count });
    }
    return all;
  }, [areas, items]);

  const categorias = useMemo(() => {
    const seen = new Set<string>(Object.keys(CATEGORIAS));
    const list = Object.entries(CATEGORIAS).map(([value, cat]) => ({ value, label: cat.label }));
    for (const item of items) {
      if (!seen.has(item.categoria)) {
        seen.add(item.categoria);
        list.push({ value: item.categoria, label: item.categoria });
      }
    }
    return list;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = items;

    if (activeTab !== "todos") {
      const areaId = Number(activeTab.replace("area-", ""));
      result = result.filter((i) => i.area_id === areaId);
    }

    if (catFilter !== "todas") {
      result = result.filter((i) => i.categoria === catFilter);
    }

    if (q) {
      result = result.filter((i) => {
        const catLabel = CATEGORIAS[i.categoria]?.label ?? i.categoria;
        const haystack = [
          i.titulo,
          i.descricao ?? "",
          catLabel,
          i.area_nome ?? "",
          ...i.tags,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    return result;
  }, [items, activeTab, catFilter, search]);

  return (
    <div className="flex w-full flex-col gap-6">
      <div
        role="tablist"
        aria-label="Áreas"
        className="flex w-full flex-wrap items-center gap-1 rounded-2xl bg-zinc-100 p-1 ring-1 ring-zinc-200/60"
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-xl px-4 text-base font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]",
                selected
                  ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                  : "text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-700"
              )}
            >
              {tab.id === "todos" && <Layers size={16} aria-hidden="true" />}
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={cn(
                    "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-sm font-semibold",
                    selected
                      ? "bg-[#2195B9]/10 text-[#2195B9]"
                      : "bg-zinc-200 text-zinc-500"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="relative flex-1">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar por título, descrição, área ou tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-14 w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-xl text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          />
        </div>
        <div className="relative">
          <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
          <select
            aria-label="Filtrar por categoria"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="min-h-14 w-full appearance-none rounded-xl border border-zinc-200 bg-white py-3 pl-4 pr-10 text-xl text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] sm:w-72"
          >
            <option value="todas">Todas as categorias</option>
            {categorias.map((cat) => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div role="tabpanel" className="flex w-full flex-col gap-4">
        {filtered.length === 0 ? (
          <p className="rounded-2xl bg-white px-5 py-4 text-xl text-zinc-500 ring-1 ring-zinc-200/60">
            {search
              ? "Nenhum item encontrado para essa busca."
              : "Nenhum item cadastrado nesta seção."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => (
              <ItemCard key={item.id} item={item} areas={areas} podeGerenciar={podeGerenciar} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemCard({ item, areas, podeGerenciar }: { item: Item; areas: Area[]; podeGerenciar: boolean }) {
  const cat = categoriaInfo(item.categoria);
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
      {editing ? (
        <ItemEditForm item={item} areas={areas} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {item.area_nome && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#2195B9]/10 px-2.5 py-0.5 text-sm font-medium text-[#2195B9]">
                {item.area_nome}
              </span>
            )}
            {cat && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#2195B9]/10 px-2.5 py-0.5 text-sm font-medium text-[#2195B9]">
                <cat.icon size={12} aria-hidden="true" />
                {cat.label}
              </span>
            )}
          </div>

          <h3 className="text-lg font-semibold leading-snug text-zinc-900">{item.titulo}</h3>

          {item.descricao && (
            <DescricaoToggle descricao={item.descricao} />
          )}

          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-sm text-zinc-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-auto flex items-center gap-2 pt-2">
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-[#2195B9] px-4 py-2 text-base font-medium text-white transition-colors hover:bg-[#28627B]"
              >
                <ExternalLink size={16} />
                Acessar
              </a>
            )}
            {item.arquivo_nome && (
              <span className="text-base text-zinc-500">{item.arquivo_nome}</span>
            )}
            {podeGerenciar && (
              <>
                <EditarItemButton onClick={() => setEditing(true)} />
                <ExcluirItemButton itemId={item.id} titulo={item.titulo} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DescricaoToggle({ descricao }: { descricao: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-fit items-center gap-1 text-sm font-medium text-[#2195B9] transition-colors hover:text-[#28627B]"
      >
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={cn("transition-transform duration-200", expanded && "rotate-180")}
        />
        {expanded ? "Ocultar descrição" : "Ver descrição"}
      </button>
      {expanded && (
        <p className="text-sm leading-relaxed text-zinc-600">{descricao}</p>
      )}
    </div>
  );
}

function EditarItemButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Editar item"
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-[#2195B9]/10 hover:text-[#2195B9]"
    >
      <Pencil size={18} />
    </button>
  );
}

function ItemEditForm({
  item,
  areas,
  onCancel,
}: {
  item: Item;
  areas: Area[];
  onCancel: () => void;
}) {
  const [state, formAction] = useActionState(atualizarUtilidadeItem, initialEdit);

  useEffect(() => {
    if (state.ok) onCancel();
  }, [state.ok, onCancel]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-lg font-medium text-zinc-900">Editar item</span>
        <button type="button" onClick={onCancel} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-200" aria-label="Cancelar edição">
          <X size={18} />
        </button>
      </div>

      <input type="hidden" name="id" value={item.id} />

      <input
        name="titulo"
        required
        defaultValue={item.titulo}
        placeholder="Título do item"
        className={inputClass}
      />

      <select name="area_id" defaultValue={item.area_id ?? ""} className={inputClass}>
        <option value="">Escolha a área (opcional)</option>
        {areas.map((area) => (
          <option key={area.id} value={area.id}>{area.nome}</option>
        ))}
      </select>

      <div className="flex flex-col gap-1">
        <input
          name="categoria"
          required
          list="categoria-edicao"
          defaultValue={item.categoria}
          placeholder="Categoria ou título da utilidade"
          className={inputClass}
        />
        <datalist id="categoria-edicao">
          {CATEGORIA_SUGGESTIONS.map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
      </div>

      <input
        name="url"
        defaultValue={item.url ?? ""}
        placeholder="URL (link para o documento ou site)"
        className={inputClass}
      />

      <input
        name="tags"
        defaultValue={item.tags.join(", ")}
        placeholder="Tags separadas por vírgula"
        className={inputClass}
      />

      <textarea
        name="descricao"
        rows={3}
        defaultValue={item.descricao ?? ""}
        placeholder="Descrição curta (opcional)"
        className={`${inputClass} min-h-20 resize-y py-3`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="flex min-h-12 items-center gap-1.5 rounded-lg bg-[#2195B9] px-4 text-lg font-medium text-white transition-colors hover:bg-[#28627B]">
          Salvar
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-lg text-zinc-600 hover:text-zinc-900">
          Cancelar
        </button>
      </div>

      {state.message && (
        <p className={`text-base ${state.ok ? "text-green-800" : "text-red-700"}`}>{state.message}</p>
      )}
    </form>
  );
}

function ExcluirItemButton({ itemId, titulo }: { itemId: number; titulo: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        aria-label="Excluir item"
        onClick={() => setConfirming(true)}
        className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 size={18} />
      </button>
    );
  }

  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-red-800">
        Excluir “{titulo}”? Essa ação não pode ser desfeita.
      </span>
      <form action={excluirUtilidadeItemSimples} className="contents">
        <input type="hidden" name="id" value={itemId} />
        <button
          type="submit"
          className="flex min-h-10 items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-base font-medium text-white transition-colors hover:bg-red-800"
        >
          <Trash2 size={15} aria-hidden="true" />
          Confirmar exclusão
        </button>
      </form>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg px-3 py-2 text-base text-zinc-600 transition-colors hover:text-zinc-900"
      >
        Voltar
      </button>
    </div>
  );
}
