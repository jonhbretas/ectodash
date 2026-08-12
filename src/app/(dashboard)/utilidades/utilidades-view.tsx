"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Search, Trash2, Layers, FileText, BookOpen, Image, GraduationCap, Link2, Wrench, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { excluirUtilidadeItemSimples } from "./utilidades-actions";

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
              <ItemCard key={item.id} item={item} podeGerenciar={podeGerenciar} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemCard({ item, podeGerenciar }: { item: Item; podeGerenciar: boolean }) {
  const cat = categoriaInfo(item.categoria);

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
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

      <h3 className="text-xl font-semibold text-zinc-900">{item.titulo}</h3>

      {item.descricao && (
        <p className="text-base leading-relaxed text-zinc-600">{item.descricao}</p>
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
        {podeGerenciar && <ExcluirItemButton itemId={item.id} titulo={item.titulo} />}
      </div>
    </div>
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
