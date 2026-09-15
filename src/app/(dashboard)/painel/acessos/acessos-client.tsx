"use client";

// Tela /painel/acessos: matriz de menus por modelo de cargo + prévia
// "ver como o usuário" (simulação de sidebar por preset — UX apenas, sem
// trocar a sessão; o limite real continua na RLS).
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, Pencil, PlusCircle, ShieldCheck, Trash2, X } from "lucide-react";
import {
  MODULOS_CONCEDIVEIS,
  MODULOS_LABELS,
  NIVEL_CARGO_LABELS,
  podeAcessar,
  type Acesso,
  type ModuloAcesso,
} from "@/lib/acesso";
import {
  filterEntries,
  navEntries,
  type SidebarEntry,
} from "../../nav-items";
import {
  aplicarModelo,
  atualizarModelo,
  criarModelo,
  excluirModelo,
  type ModeloState,
} from "./actions";

export type ModeloRow = {
  id: number;
  nome: string;
  descricao: string;
  nivel: string;
  area_id: number | null;
  area_nome: string | null;
  modulos: string[];
};

export type AreaRow = { id: number; nome: string };
export type PessoaRow = { profile_id: string; nome: string };

const initial: ModeloState = { ok: false, message: "" };

function SubmitButton({ label, className = "" }: { label: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Salvando..." : label}
    </button>
  );
}

function StatusLine({ state }: { state: ModeloState }) {
  if (!state.message) return null;
  return (
    <p className={`text-base ${state.ok ? "text-green-800" : "text-red-700"}`}>
      {state.message}
    </p>
  );
}

const inputClass =
  "min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";

function ModulosPills({
  selecionados,
  onToggle,
}: {
  selecionados: string[];
  onToggle: (modulo: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {MODULOS_CONCEDIVEIS.map((modulo) => {
        const ativo = selecionados.includes(modulo);
        return (
          <button
            key={modulo}
            type="button"
            onClick={() => onToggle(modulo)}
            aria-pressed={ativo}
            className={`rounded-full px-3 py-1 text-base font-medium ring-1 transition-colors ${
              ativo
                ? "bg-[#2195B9] text-white ring-[#2195B9]"
                : "bg-white text-zinc-500 ring-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {MODULOS_LABELS[modulo]}
          </button>
        );
      })}
    </div>
  );
}

// ── Prévia "ver como": sidebar simulada a partir dos módulos do modelo ──

function PreviewSidebar({ modelo }: { modelo: ModeloRow }) {
  const entries = useMemo(() => {
    const acesso: Acesso = {
      role: null,
      cargos: [
        {
          cargo_id: 0,
          nivel: (modelo.nivel as Acesso["cargos"][number]["nivel"]) ?? "coordenador_area",
          area_id: modelo.area_id,
          area_nome: modelo.area_nome,
          localidade_id: null,
          localidade_nome: null,
          modulos: modelo.modulos,
        },
      ],
    };
    const vis = (modulo: ModuloAcesso) => podeAcessar(acesso, modulo);
    return filterEntries(navEntries, vis);
  }, [modelo]);

  const renderEntry = (entry: SidebarEntry) => {
    if (entry.type === "group") {
      return (
        <div key={entry.label} className="flex flex-col gap-1">
          <p className="px-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            {entry.label}
          </p>
          <div className="ml-2 flex flex-col gap-1 border-l-2 border-zinc-200 pl-2">
            {entry.children.map((child) => (
              <span
                key={child.href}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-base text-zinc-700"
              >
                {child.label}
              </span>
            ))}
          </div>
        </div>
      );
    }
    return (
      <span
        key={entry.href}
        className="rounded-lg bg-zinc-100 px-3 py-1.5 text-base text-zinc-700"
      >
        {entry.label}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-[#2195B9]/40 bg-[#2195B9]/5 p-4">
      <p className="flex items-center gap-2 text-base font-semibold text-[#28627B]">
        <Eye size={18} aria-hidden="true" />
        Ver como “{modelo.nome}” — prévia do menu
      </p>
      <p className="text-sm text-zinc-500">
        Simulação visual: é assim que o menu aparece para quem tem este cargo
        (conta comum + módulos do modelo). Não troca a sua sessão.
      </p>
      <div className="flex flex-col gap-2">{entries.map(renderEntry)}</div>
    </div>
  );
}

// ── Cartão de um modelo (editar matriz + aplicar + excluir) ──

function ModeloCard({
  modelo,
  areas,
  pessoas,
  expandido,
  onExpandir,
}: {
  modelo: ModeloRow;
  areas: AreaRow[];
  pessoas: PessoaRow[];
  expandido: boolean;
  onExpandir: () => void;
}) {
  const [editState, editAction] = useActionState(atualizarModelo, initial);
  const [delState, delAction] = useActionState(excluirModelo, initial);
  const [modulos, setModulos] = useState<string[]>(modelo.modulos);
  const [aplicando, setAplicando] = useState(false);
  const [aplicMsg, setAplicMsg] = useState<string | null>(null);
  const [pessoaId, setPessoaId] = useState("");
  const [areaAplicar, setAreaAplicar] = useState(
    modelo.area_id ? String(modelo.area_id) : ""
  );

  function toggle(modulo: string) {
    setModulos((prev) =>
      prev.includes(modulo) ? prev.filter((m) => m !== modulo) : [...prev, modulo]
    );
  }

  async function rodarAplicar() {
    setAplicando(true);
    setAplicMsg(null);
    const areaNum = areaAplicar !== "" ? Number(areaAplicar) : null;
    const res = await aplicarModelo(modelo.id, pessoaId, areaNum);
    setAplicando(false);
    setAplicMsg(res.message);
    if (res.ok) setPessoaId("");
  }

  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-xl font-semibold text-zinc-900">{modelo.nome}</h3>
          {modelo.descricao && (
            <p className="text-base text-zinc-500">{modelo.descricao}</p>
          )}
          <p className="text-sm text-zinc-400">
            {NIVEL_CARGO_LABELS[modelo.nivel as keyof typeof NIVEL_CARGO_LABELS] ??
              modelo.nivel}
            {" · "}
            {modelo.area_nome ?? "sem área fixa"}
            {" · "}
            {modelo.modulos.length} {modelo.modulos.length === 1 ? "menu" : "menus"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onExpandir}
            className="flex min-h-10 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <Pencil size={16} aria-hidden="true" />
            {expandido ? "Fechar" : "Menus"}
          </button>
          <form action={delAction}>
            <input type="hidden" name="id" value={modelo.id} />
            <button
              type="submit"
              aria-label={`Excluir ${modelo.nome}`}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 size={18} />
            </button>
          </form>
        </div>
      </div>

      {!expandido && (
        <div className="flex flex-wrap gap-1.5">
          {modelo.modulos.length === 0 ? (
            <span className="text-base text-zinc-400">Nenhum menu liberado.</span>
          ) : (
            modelo.modulos.map((m) => (
              <span
                key={m}
                className="rounded-full bg-[#2195B9] px-3 py-1 text-base font-medium text-white"
              >
                {MODULOS_LABELS[m as ModuloAcesso] ?? m}
              </span>
            ))
          )}
        </div>
      )}

      {expandido && (
        <form action={editAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={modelo.id} />
          <input type="hidden" name="modulos" value={modulos.join(",")} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-base text-zinc-600">
              Nome
              <input name="nome" required defaultValue={modelo.nome} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-base text-zinc-600">
              Nível
              <select name="nivel" defaultValue={modelo.nivel} className={inputClass}>
                <option value="coordenador_area">Coordenador de área</option>
                <option value="coordenador_geral_area">Coordenador geral de área</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-base text-zinc-600">
              Área do cargo
              <select name="area_id" defaultValue={modelo.area_id ?? ""} className={inputClass}>
                <option value="">Sem área fixa</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-base text-zinc-600">
            Descrição
            <input name="descricao" defaultValue={modelo.descricao} className={inputClass} />
          </label>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-base font-medium text-zinc-700">
              Menus liberados — toque para ligar/desligar
            </legend>
            <ModulosPills selecionados={modulos} onToggle={toggle} />
          </fieldset>
          <div>
            <SubmitButton
              label="Salvar menus"
              className="flex min-h-12 items-center rounded-xl bg-[#2195B9] px-4 text-lg font-medium text-white transition-colors hover:bg-[#28627B]"
            />
          </div>
          <StatusLine state={editState} />
          {delState.message && <StatusLine state={delState} />}
        </form>
      )}

      {/* Aplicar modelo a uma pessoa */}
      <details className="rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200/60">
        <summary className="cursor-pointer text-base font-medium text-zinc-700">
          Aplicar este modelo a uma pessoa
        </summary>
        <div className="mt-3 flex flex-col gap-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-base text-zinc-600">
              Pessoa (com conta vinculada)
              <select
                value={pessoaId}
                onChange={(e) => setPessoaId(e.target.value)}
                className={inputClass}
              >
                <option value="">Selecione…</option>
                {pessoas.map((p) => (
                  <option key={p.profile_id} value={p.profile_id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-base text-zinc-600">
              Área do cargo
              <select
                value={areaAplicar}
                onChange={(e) => setAreaAplicar(e.target.value)}
                className={inputClass}
              >
                <option value="">Selecione…</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <button
              type="button"
              onClick={rodarAplicar}
              disabled={aplicando || !pessoaId}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-[#28627B] px-4 text-base font-medium text-white transition-colors hover:bg-[#1d4a5e] disabled:opacity-60"
            >
              <ShieldCheck size={18} aria-hidden="true" />
              {aplicando ? "Aplicando..." : "Criar cargo para a pessoa"}
            </button>
          </div>
          {aplicMsg && <p className="text-base text-zinc-700">{aplicMsg}</p>}
        </div>
      </details>
    </article>
  );
}

// ── Página ──

export default function AcessosClient({
  modelos,
  areas,
  pessoas,
}: {
  modelos: ModeloRow[];
  areas: AreaRow[];
  pessoas: PessoaRow[];
}) {
  const [createState, createAction] = useActionState(criarModelo, initial);
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [novosModulos, setNovosModulos] = useState<string[]>([
    "demandas",
    "reunioes",
  ]);
  const [previewId, setPreviewId] = useState<string>(
    modelos.length > 0 ? String(modelos[0].id) : ""
  );
  const [expandidoId, setExpandidoId] = useState<number | null>(null);

  const previewModelo = modelos.find((m) => String(m.id) === previewId) ?? null;

  function toggleNovo(modulo: string) {
    setNovosModulos((prev) =>
      prev.includes(modulo) ? prev.filter((m) => m !== modulo) : [...prev, modulo]
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Ver como o usuário */}
      <section className="flex flex-col gap-3">
        <label className="flex max-w-md flex-col gap-1 text-base text-zinc-600">
          Ver como (prévia do menu por cargo)
          <select
            value={previewId}
            onChange={(e) => setPreviewId(e.target.value)}
            className={inputClass}
          >
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </label>
        {previewModelo && <PreviewSidebar modelo={previewModelo} />}
      </section>

      {/* Modelos */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold text-zinc-900">
            Modelos de cargo ({modelos.length})
          </h2>
          {!mostrarNovo && (
            <button
              type="button"
              onClick={() => setMostrarNovo(true)}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white px-4 text-base font-medium text-zinc-700 transition-colors hover:border-zinc-400"
            >
              <PlusCircle size={18} aria-hidden="true" />
              Novo modelo
            </button>
          )}
        </div>

        {mostrarNovo && (
          <form
            action={createAction}
            className="flex flex-col gap-3 rounded-2xl bg-white p-5 ring-1 ring-zinc-200/60"
          >
            <input type="hidden" name="modulos" value={novosModulos.join(",")} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-base text-zinc-600">
                Nome
                <input name="nome" required placeholder="Ex.: Comunicação" className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-base text-zinc-600">
                Nível
                <select name="nivel" defaultValue="coordenador_area" className={inputClass}>
                  <option value="coordenador_area">Coordenador de área</option>
                  <option value="coordenador_geral_area">Coordenador geral de área</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-base text-zinc-600">
                Área do cargo
                <select name="area_id" defaultValue="" className={inputClass}>
                  <option value="">Sem área fixa</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1 text-base text-zinc-600">
              Descrição
              <input name="descricao" placeholder="Para que serve este cargo" className={inputClass} />
            </label>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-base font-medium text-zinc-700">
                Menus liberados
              </legend>
              <ModulosPills selecionados={novosModulos} onToggle={toggleNovo} />
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <SubmitButton
                label="Criar modelo"
                className="flex min-h-12 items-center rounded-xl bg-[#2195B9] px-4 text-lg font-medium text-white transition-colors hover:bg-[#28627B]"
              />
              <button
                type="button"
                onClick={() => setMostrarNovo(false)}
                className="flex min-h-12 items-center rounded-xl border border-zinc-300 bg-white px-4 text-lg font-medium text-zinc-900"
              >
                <X size={18} aria-hidden="true" />
                Cancelar
              </button>
            </div>
            <StatusLine state={createState} />
          </form>
        )}

        <div className="flex flex-col gap-3">
          {modelos.map((modelo) => (
            <ModeloCard
              key={modelo.id}
              modelo={modelo}
              areas={areas}
              pessoas={pessoas}
              expandido={expandidoId === modelo.id}
              onExpandir={() =>
                setExpandidoId((prev) => (prev === modelo.id ? null : modelo.id))
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}
