"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Search, Trash2, Layers, FileText, BookOpen, Image, GraduationCap, Link2, Wrench } from "lucide-react";
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
  outro: { label: "Outros Documentos", icon: Wrench },
};

export default function UtilidadesView({ areas, items }: { areas: Area[]; items: Item[] }) {
  const [activeTab, setActiveTab] = useState("todos");
  const [search, setSearch] = useState("");

  const tabs = useMemo(() => {
    const all = [{ id: "todos", label: "Todos", count: items.length }];
    for (const area of areas) {
      const count = items.filter((i) => i.area_id === area.id).length;
      all.push({ id: `area-${area.id}`, label: area.nome, count });
    }
    return all;
  }, [areas, items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = items;

    if (activeTab !== "todos") {
      const areaId = Number(activeTab.replace("area-", ""));
      result = result.filter((i) => i.area_id === areaId);
    }

    if (q) {
      result = result.filter((i) => {
        const catLabel = CATEGORIAS[i.categoria]?.label ?? "";
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
  }, [items, activeTab, search]);

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

      <div className="relative">
        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
        <input
          type="text"
          placeholder="Buscar por título, descrição, área ou tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-14 w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-xl text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        />
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
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemCard({ item }: { item: Item }) {
  const cat = CATEGORIAS[item.categoria];

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
        <ExcluirItemButton itemId={item.id} />
      </div>
    </div>
  );
}

function ExcluirItemButton({ itemId }: { itemId: number }) {
  return (
    <form action={excluirUtilidadeItemSimples} className="ml-auto">
      <input type="hidden" name="id" value={itemId} />
      <button
        type="submit"
        aria-label="Excluir item"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 size={18} />
      </button>
    </form>
  );
}
