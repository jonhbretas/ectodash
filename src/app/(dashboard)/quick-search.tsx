"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  Loader2,
  X,
  ClipboardList,
  NotebookPen,
  CalendarDays,
  Users,
  FolderKanban,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type TipoResultado = "demanda" | "evento" | "ata" | "voluntario" | "projeto";

type Resultado = {
  tipo: TipoResultado;
  id: number;
  titulo: string;
  subtitulo?: string;
  href: string;
};

const META: Record<TipoResultado, { label: string; Icon: typeof ClipboardList }> = {
  demanda: { label: "Demandas", Icon: ClipboardList },
  evento: { label: "Eventos", Icon: CalendarDays },
  ata: { label: "Atas de reuniões", Icon: NotebookPen },
  voluntario: { label: "Voluntários", Icon: Users },
  projeto: { label: "Projetos", Icon: FolderKanban },
};

const ORDEM: TipoResultado[] = ["demanda", "evento", "ata", "voluntario", "projeto"];

function formatarData(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

export default function QuickSearch({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const ativoRef = useRef<HTMLButtonElement>(null);
  const seqRef = useRef(0);

  const [termo, setTermo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [destaque, setDestaque] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const aberto = pos !== null && termo.trim().length >= 2;

  useEffect(() => {
    const t = termo.trim().replace(/["'(),;]/g, " ");
    if (t.length < 2) return;
    const sanitized = t.replace(/%/g, "%%").replace(/_/g, "\\_").replace(/[()'"]/g, "").trim();

    const seq = ++seqRef.current;

    const timer = setTimeout(async () => {
      setBuscando(true);
      setErro(false);
      try {
        const [demandas, eventos, atas, voluntarios, projetos] = await Promise.all([
          supabase
            .from("demandas")
            .select("id, titulo, prazo")
            .ilike("titulo", `%${sanitized}%`)
            .order("updated_at", { ascending: false })
            .limit(5),
          supabase
            .from("eventos")
            .select("id, titulo, data_evento")
            .ilike("titulo", `%${sanitized}%`)
            .order("data_evento", { ascending: false })
            .limit(5),
          supabase
            .from("reunioes")
            .select("id, titulo, data_reuniao")
            .ilike("titulo", `%${sanitized}%`)
            .order("data_reuniao", { ascending: false })
            .limit(5),
          supabase
            .from("voluntarios")
            .select("id, nome, codigo_pf, funcao")
            .or(`nome.ilike.%${sanitized}%,codigo_pf.ilike.%${sanitized}%`)
            .order("nome", { ascending: true })
            .limit(5),
          supabase
            .from("projetos")
            .select("id, nome, area")
            .ilike("nome", `%${sanitized}%`)
            .order("nome", { ascending: true })
            .limit(5),
        ]);

        if (seqRef.current !== seq) return;

        const novos: Resultado[] = [];
        for (const row of demandas.data ?? []) {
          novos.push({
            tipo: "demanda",
            id: row.id,
            titulo: row.titulo,
            subtitulo: `Prazo ${formatarData(row.prazo)}`,
            href: `/demandas/${row.id}/editar`,
          });
        }
        for (const row of eventos.data ?? []) {
          novos.push({
            tipo: "evento",
            id: row.id,
            titulo: row.titulo,
            subtitulo: formatarData(row.data_evento),
            href: `/eventos/${row.id}`,
          });
        }
        for (const row of atas.data ?? []) {
          novos.push({
            tipo: "ata",
            id: row.id,
            titulo: row.titulo,
            subtitulo: formatarData(row.data_reuniao),
            href: `/reunioes/${row.id}`,
          });
        }
        for (const row of voluntarios.data ?? []) {
          novos.push({
            tipo: "voluntario",
            id: row.id,
            titulo: row.nome,
            subtitulo: [row.codigo_pf, row.funcao].filter(Boolean).join(" · "),
            href: `/voluntarios/${row.id}`,
          });
        }
        for (const row of projetos.data ?? []) {
          novos.push({
            tipo: "projeto",
            id: row.id,
            titulo: row.nome,
            subtitulo: row.area ?? undefined,
            href: "/projetos",
          });
        }

        setResultados(novos);
        setDestaque(0);
      } catch {
        if (seqRef.current === seq) setErro(true);
      } finally {
        if (seqRef.current === seq) setBuscando(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [termo, supabase]);

  const grupos = useMemo(() => {
    const porTipo = new Map<TipoResultado, Resultado[]>();
    for (const r of resultados) {
      const arr = porTipo.get(r.tipo) ?? [];
      arr.push(r);
      porTipo.set(r.tipo, arr);
    }
    return ORDEM.filter((t) => (porTipo.get(t)?.length ?? 0) > 0).map((tipo) => ({
      tipo,
      ...META[tipo],
      itens: porTipo.get(tipo)!,
    }));
  }, [resultados]);

  const itensAchatados = useMemo(() => grupos.flatMap((g) => g.itens), [grupos]);

  useEffect(() => {
    ativoRef.current?.scrollIntoView({ block: "nearest" });
  }, [destaque]);

  useEffect(() => {
    if (!aberto) return;
    function fechar() {
      setPos(null);
    }
    function onPointerDown(e: PointerEvent) {
      if (painelRef.current?.contains(e.target as Node)) return;
      if (inputRef.current?.contains(e.target as Node)) return;
      fechar();
    }
    window.addEventListener("scroll", fechar, true);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("scroll", fechar, true);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [aberto]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function abrirPainel() {
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const novo = e.target.value;
    setTermo(novo);
    const t = novo.trim().replace(/["'(),;]/g, " ");
    if (t.length < 2) {
      seqRef.current += 1;
      setResultados([]);
      setBuscando(false);
      setErro(false);
    } else {
      setBuscando(true);
    }
    abrirPainel();
  }

  function irPara(item: Resultado) {
    router.push(item.href);
    setTermo("");
    setResultados([]);
    setPos(null);
    onNavigate?.();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setDestaque((d) => (itensAchatados.length === 0 ? 0 : (d + 1) % itensAchatados.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDestaque((d) =>
        itensAchatados.length === 0 ? 0 : (d - 1 + itensAchatados.length) % itensAchatados.length
      );
    } else if (e.key === "Enter") {
      if (itensAchatados.length > 0) {
        e.preventDefault();
        irPara(itensAchatados[Math.min(destaque, itensAchatados.length - 1)]);
      }
    } else if (e.key === "Escape") {
      setTermo("");
      setResultados([]);
      setPos(null);
      inputRef.current?.blur();
    }
  }

  let flatIdx = -1;

  return (
    <div className="relative w-full" role="search">
      <div className="relative">
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          ref={inputRef}
          type="text"
          value={termo}
          onChange={handleChange}
          onFocus={abrirPainel}
          onKeyDown={handleKeyDown}
          placeholder="Busca rápida (Ctrl+K)"
          aria-label="Busca rápida"
          aria-autocomplete="list"
          className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#2195B9] focus:bg-white focus:ring-2 focus:ring-[#2195B9]/25"
        />
        {buscando && (
          <Loader2
            size={14}
            aria-hidden="true"
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
          />
        )}
        {termo && !buscando && (
          <button
            type="button"
            onClick={() => {
              setTermo("");
              setResultados([]);
              setPos(null);
              inputRef.current?.focus();
            }}
            aria-label="Limpar busca"
            className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {aberto && (
        <div
          ref={painelRef}
          role="listbox"
          aria-label="Resultados da busca"
          className="fixed z-[60] max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10"
          style={{ top: pos!.top, left: pos!.left, width: pos!.width }}
        >
          {buscando && (
            <p className="px-3 py-4 text-center text-sm text-slate-500">Buscando…</p>
          )}
          {!buscando && erro && (
            <p className="px-3 py-4 text-center text-sm text-slate-500">
              Não foi possível buscar agora. Tente novamente.
            </p>
          )}
          {!buscando && !erro && grupos.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-slate-500">
              Nenhum resultado para &ldquo;{termo.trim()}&rdquo;.
            </p>
          )}
          {!buscando &&
            !erro &&
            grupos.map((grupo) => (
              <div key={grupo.tipo} role="group" aria-label={grupo.label}>
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {grupo.label}
                </p>
                {grupo.itens.map((item) => {
                  flatIdx += 1;
                  const idx = flatIdx;
                  const ativo = idx === destaque;
                  return (
                    <button
                      key={`${item.tipo}-${item.id}`}
                      ref={ativo ? ativoRef : undefined}
                      type="button"
                      role="option"
                      aria-selected={ativo}
                      onClick={() => irPara(item)}
                      onMouseEnter={() => setDestaque(idx)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                        ativo ? "bg-[#2195B9]/10" : "hover:bg-slate-50"
                      }`}
                    >
                      <grupo.Icon
                        size={16}
                        aria-hidden="true"
                        strokeWidth={1.75}
                        className="shrink-0 text-slate-400"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">
                          {item.titulo}
                        </span>
                        {item.subtitulo && (
                          <span className="block truncate text-xs text-slate-500">
                            {item.subtitulo}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
