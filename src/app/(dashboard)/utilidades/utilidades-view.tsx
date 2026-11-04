"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { ExternalLink, Search, Trash2, Pencil, Layers, ChevronDown, X, Loader2, CheckSquare, Square, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { atualizarUtilidadeItem, excluirUtilidadeItemSimples, type UtilidadeState } from "./utilidades-actions";
import { CATEGORIAS, CATEGORIA_SUGGESTIONS, categoriaInfo } from "./categorias";
import EdicaoMassa from "./edicao-massa";

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

const initialEdit: UtilidadeState = { ok: false, message: "" };

const inputClass = "min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";

export default function UtilidadesView({ areas, items, podeGerenciar = false }: { areas: Area[]; items: Item[]; podeGerenciar?: boolean }) {
  const [activeTab, setActiveTab] = useState("todos");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("todas");
  // Seleção para edição em massa (só gestores).
  const [selecionando, setSelecionando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [avisoMassa, setAvisoMassa] = useState<string | null>(null);

  function alternarSelecao(id: number) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function sairSelecao() {
    setSelecionando(false);
    setSelecionados(new Set());
  }

  const tabs = useMemo(() => {
    const all = [{ id: "todos", label: "Todos", count: items.length }];
    for (const area of areas) {
      const count = items.filter((i) => i.area_id === area.id).length;
      all.push({ id: `area-${area.id}`, label: area.nome, count });
    }
    return all;
  }, [areas, items]);

  // Áreas sem nenhum item ficam ocultas por padrão (a aba ativa sempre aparece).
  const [mostrarVazias, setMostrarVazias] = useState(false);
  const qtdVazias = tabs.filter((t) => t.id !== "todos" && t.count === 0).length;
  const tabsVisiveis = mostrarVazias
    ? tabs
    : tabs.filter((t) => t.id === "todos" || t.count > 0 || t.id === activeTab);

  // Itens da aba atual (área) — base para contar e filtrar categorias.
  const itensDaAba = useMemo(() => {
    if (activeTab === "todos") return items;
    const areaId = Number(activeTab.replace("area-", ""));
    return items.filter((i) => i.area_id === areaId);
  }, [items, activeTab]);

  // Só categorias que têm itens na aba atual, na ordem padrão e depois as livres.
  const categorias = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of itensDaAba) counts.set(item.categoria, (counts.get(item.categoria) ?? 0) + 1);
    const ordem = [
      ...Object.keys(CATEGORIAS).filter((k) => counts.has(k)),
      ...[...counts.keys()].filter((k) => !CATEGORIAS[k]).sort((a, b) => a.localeCompare(b, "pt-BR")),
    ];
    return ordem.map((value) => ({ value, count: counts.get(value) ?? 0, info: categoriaInfo(value) }));
  }, [itensDaAba]);

  // Categoria escolhida que sumiu ao trocar de área volta para "todas".
  const catEfetiva = catFilter === "todas" || categorias.some((c) => c.value === catFilter) ? catFilter : "todas";

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = itensDaAba;

    if (catEfetiva !== "todas") {
      result = result.filter((i) => i.categoria === catEfetiva);
    }

    if (q) {
      result = result.filter((i) => {
        const haystack = [
          i.titulo,
          i.descricao ?? "",
          categoriaInfo(i.categoria).label,
          i.area_nome ?? "",
          ...i.tags,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    return result;
  }, [itensDaAba, catEfetiva, search]);

  // Cards agrupados por categoria, cada grupo com título, ícone e cor própria.
  const grupos = useMemo(() => {
    const porCategoria = new Map<string, Item[]>();
    for (const item of filtered) {
      const lista = porCategoria.get(item.categoria) ?? [];
      lista.push(item);
      porCategoria.set(item.categoria, lista);
    }
    return categorias
      .filter((c) => porCategoria.has(c.value))
      .map((c) => ({ ...c, itens: porCategoria.get(c.value)! }));
  }, [filtered, categorias]);

  return (
    <div className="flex w-full flex-col gap-6">
      <section aria-labelledby="filtro-area" className="flex flex-col gap-2">
        <h2 id="filtro-area" className="text-base font-semibold uppercase tracking-wide text-zinc-500">
          1. Escolha a área
        </h2>
        <div
          role="tablist"
          aria-label="Áreas"
          className="flex w-full flex-wrap items-center gap-1 rounded-2xl bg-zinc-100 p-1 ring-1 ring-zinc-200/60"
        >
          {tabsVisiveis.map((tab) => {
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
          {qtdVazias > 0 && (
            <button
              type="button"
              onClick={() => setMostrarVazias((v) => !v)}
              aria-expanded={mostrarVazias}
              className="flex min-h-12 items-center gap-1.5 rounded-xl px-4 text-base font-medium text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            >
              {mostrarVazias
                ? "Ocultar áreas sem itens"
                : `+ ${qtdVazias} ${qtdVazias === 1 ? "área sem itens" : "áreas sem itens"}`}
            </button>
          )}
        </div>
      </section>

      {categorias.length > 0 && (
        <section aria-labelledby="filtro-tipo" className="flex flex-col gap-2">
          <h2 id="filtro-tipo" className="text-base font-semibold uppercase tracking-wide text-zinc-500">
            2. Escolha o tipo de material
          </h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tipos de material">
            <CategoriaChip
              ativo={catEfetiva === "todas"}
              onClick={() => setCatFilter("todas")}
              label="Todos os tipos"
              count={itensDaAba.length}
              icon={Layers}
              chip="bg-zinc-100 text-zinc-800"
            />
            {categorias.map((c) => (
              <CategoriaChip
                key={c.value}
                ativo={catEfetiva === c.value}
                onClick={() => setCatFilter(c.value)}
                label={c.info.label}
                count={c.count}
                icon={c.info.icon}
                chip={c.info.chip}
              />
            ))}
          </div>
        </section>
      )}

      <div className="relative w-full">
        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
        <input
          type="text"
          aria-label="Buscar"
          placeholder="Ou busque por nome, descrição ou palavra-chave..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-14 w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-12 text-xl text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        />
        {search && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {podeGerenciar && filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {!selecionando ? (
            <button
              type="button"
              onClick={() => {
                setAvisoMassa(null);
                setSelecionando(true);
              }}
              className="flex min-h-12 items-center gap-2 rounded-xl border-2 border-zinc-300 bg-white px-4 text-lg font-medium text-zinc-800 transition-colors hover:border-[#2195B9] hover:text-[#28627B]"
            >
              <CheckSquare size={20} aria-hidden="true" />
              Selecionar vários
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSelecionados(new Set(filtered.map((i) => i.id)))}
                className="flex min-h-12 items-center gap-2 rounded-xl bg-[#2195B9]/10 px-4 text-lg font-medium text-[#28627B] hover:bg-[#2195B9]/20"
              >
                <CheckSquare size={20} aria-hidden="true" />
                Selecionar todos que aparecem ({filtered.length})
              </button>
              <button
                type="button"
                onClick={sairSelecao}
                className="flex min-h-12 items-center gap-2 rounded-xl px-4 text-lg font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              >
                <X size={20} aria-hidden="true" />
                Sair da seleção
              </button>
              <span className="text-base text-zinc-500">Toque nos cards para marcar ou desmarcar.</span>
            </>
          )}
        </div>
      )}

      {avisoMassa && (
        <p role="status" className="flex w-fit items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-lg font-medium text-green-800 ring-1 ring-green-200">
          <CheckCircle2 size={20} aria-hidden="true" />
          {avisoMassa}
        </p>
      )}

      <div className="flex w-full flex-col gap-8">
        {filtered.length === 0 ? (
          <p className="rounded-2xl bg-white px-5 py-4 text-xl text-zinc-500 ring-1 ring-zinc-200/60">
            {search
              ? "Nenhum item encontrado para essa busca."
              : "Nenhum item cadastrado nesta seção."}
          </p>
        ) : (
          grupos.map((grupo) => (
            <section key={grupo.value} aria-labelledby={`grupo-${grupo.value}`} className="flex flex-col gap-3">
              <h2
                id={`grupo-${grupo.value}`}
                className="flex items-center gap-3 text-2xl font-semibold text-zinc-900"
              >
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", grupo.info.iconBg, grupo.info.iconText)}>
                  <grupo.info.icon size={22} aria-hidden="true" />
                </span>
                {grupo.info.label}
                <span className="text-lg font-normal text-zinc-500">({grupo.itens.length})</span>
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grupo.itens.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    areas={areas}
                    podeGerenciar={podeGerenciar}
                    selecionando={selecionando}
                    selecionado={selecionados.has(item.id)}
                    onAlternar={() => alternarSelecao(item.id)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {selecionando && selecionados.size > 0 && (
        <EdicaoMassa
          areas={areas}
          selecionados={[...selecionados]}
          onLimpar={() => setSelecionados(new Set())}
          onConcluido={(msg) => {
            setAvisoMassa(msg);
            sairSelecao();
          }}
        />
      )}
    </div>
  );
}

function CategoriaChip({
  ativo,
  onClick,
  label,
  count,
  icon: Icon,
  chip,
}: {
  ativo: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon: typeof Layers;
  chip: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        "flex min-h-12 items-center gap-2 rounded-full px-4 text-base font-medium ring-2 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]",
        chip,
        ativo ? "ring-zinc-900 shadow-sm" : "ring-transparent opacity-80 hover:opacity-100"
      )}
    >
      <Icon size={18} aria-hidden="true" />
      {label}
      <span className="rounded-full bg-white/70 px-2 text-sm font-semibold">{count}</span>
    </button>
  );
}

function ItemCard({
  item,
  areas,
  podeGerenciar,
  selecionando = false,
  selecionado = false,
  onAlternar,
}: {
  item: Item;
  areas: Area[];
  podeGerenciar: boolean;
  selecionando?: boolean;
  selecionado?: boolean;
  onAlternar?: () => void;
}) {
  const cat = categoriaInfo(item.categoria);
  const [editing, setEditing] = useState(false);

  if (selecionando) {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={selecionado}
        onClick={onAlternar}
        className={cn(
          "flex items-start gap-3 rounded-2xl border-l-[6px] p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]",
          cat.border,
          selecionado ? "bg-[#2195B9]/5 ring-[3px] ring-[#2195B9]" : "bg-white ring-1 ring-zinc-200/60 hover:ring-zinc-400"
        )}
      >
        {selecionado ? (
          <CheckSquare size={28} className="shrink-0 text-[#2195B9]" aria-hidden="true" />
        ) : (
          <Square size={28} className="shrink-0 text-zinc-400" aria-hidden="true" />
        )}
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", cat.iconBg, cat.iconText)}>
          <cat.icon size={22} aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-lg font-semibold leading-snug text-zinc-900">{item.titulo}</span>
          <span className="text-base text-zinc-600">
            {cat.label}
            {item.area_nome ? ` · ${item.area_nome}` : " · Sem área"}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border-l-[6px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60",
        cat.border
      )}
    >
      {editing ? (
        <ItemEditForm item={item} areas={areas} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <div className="flex items-start gap-3">
            <span
              className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", cat.iconBg, cat.iconText)}
              title={cat.label}
            >
              <cat.icon size={26} aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className={cn("w-fit rounded-full px-2.5 py-0.5 text-sm font-semibold", cat.chip)}>
                {cat.label}
              </span>
              <h3 className="text-lg font-semibold leading-snug text-zinc-900">{item.titulo}</h3>
            </div>
          </div>

          {item.area_nome && (
            <p className="text-base text-zinc-600">
              <span className="font-medium text-zinc-800">Área:</span> {item.area_nome}
            </p>
          )}

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
                className="flex min-h-11 items-center gap-1.5 rounded-lg bg-[#2195B9] px-4 py-2 text-base font-medium text-white transition-colors hover:bg-[#28627B]"
              >
                <ExternalLink size={16} aria-hidden="true" />
                Abrir link
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
  const [state, formAction, pending] = useActionState(atualizarUtilidadeItem, initialEdit);

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
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="flex min-h-12 items-center gap-1.5 rounded-lg bg-[#2195B9] px-4 text-lg font-medium text-white transition-colors hover:bg-[#28627B] disabled:cursor-wait disabled:opacity-70"
        >
          {pending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
          {pending ? "Salvando..." : "Salvar"}
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
