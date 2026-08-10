"use client";

// Gestão de cargos de acesso (migration 0043) no perfil do voluntário:
// cargo = nível + escopo (área ou localidade) + módulos concedidos. A RLS
// do banco é o limite real (pode_conceder_cargo/pode_gerir_cargos_de) —
// aqui é o gate de UX e a tradução de erros.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldPlus, ShieldX, Trash2 } from "lucide-react";
import { MODULOS_CONCEDIVEIS, MODULOS_LABELS, nivelCargoLabel } from "@/lib/acesso";
import {
  alternarModuloCargo,
  criarCargo,
  excluirCargo,
} from "./actions";

export type CargoRow = {
  id: number;
  nivel: string;
  area_id: number | null;
  localidade_id: number | null;
  area_nome: string | null;
  localidade_nome: string | null;
  modulos: string[];
};

export type CargosManagerProps = {
  voluntarioId: number;
  profileId: string | null;
  cargos: CargoRow[];
  areas: { id: number; nome: string }[];
  localidades: { id: number; nome: string }[];
  canManage: boolean;
};

export default function CargosManager({
  voluntarioId,
  profileId,
  cargos,
  areas,
  localidades,
  canManage,
}: CargosManagerProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [nivel, setNivel] = useState("coordenador_area");
  const [areaId, setAreaId] = useState<string>("");
  const [localidadeId, setLocalidadeId] = useState<string>("");
  const [modulos, setModulos] = useState<string[]>([]);

  async function rodar(
    acao: () => Promise<{ ok: boolean; message: string }>
  ) {
    setPending(true);
    setErro(null);
    setMensagem(null);
    const resultado = await acao();
    setPending(false);
    if (resultado.ok) {
      setMensagem(resultado.message);
      startTransition(() => router.refresh());
    } else {
      setErro(resultado.message);
    }
    return resultado;
  }

  function alternarModulo(desejado: string) {
    setModulos((prev) =>
      prev.includes(desejado)
        ? prev.filter((m) => m !== desejado)
        : [...prev, desejado]
    );
  }

  function submitNovoCargo(e: React.FormEvent) {
    e.preventDefault();
    if (!profileId) return;
    const escopoArea = nivel !== "coordenador_localidade";
    rodar(() =>
      criarCargo(
        voluntarioId,
        profileId,
        nivel,
        escopoArea ? Number(areaId) : null,
        escopoArea ? null : Number(localidadeId),
        modulos
      )
    ).then((resultado) => {
      if (resultado.ok) {
        setMostrarNovo(false);
        setNivel("coordenador_area");
        setAreaId("");
        setLocalidadeId("");
        setModulos([]);
      }
    });
  }

  if (!profileId) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <ShieldPlus size={24} aria-hidden="true" />
          Cargos de acesso
        </h2>
        <p className="rounded-2xl bg-white px-5 py-4 text-xl text-zinc-700 ring-1 ring-zinc-200/60">
          Este voluntário ainda não vinculou a conta de acesso — os cargos
          aparecem aqui depois do vínculo.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
        <ShieldPlus size={24} aria-hidden="true" />
        Cargos de acesso ({cargos.length})
      </h2>

      {cargos.length === 0 && (
        <p className="rounded-2xl bg-white px-5 py-4 text-xl text-zinc-700 ring-1 ring-zinc-200/60">
          Nenhum cargo de acesso — acesso de voluntário comum.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {cargos.map((cargo) => (
          <div
            key={cargo.id}
            className="flex flex-col gap-2 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#E6E6E6] px-3 py-1 text-base font-medium text-[#28627B] ring-1 ring-[#E6E6E6]/60">
                  {nivelCargoLabel(cargo.nivel)}
                </span>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-base font-medium text-zinc-800 ring-1 ring-zinc-200/60">
                  {cargo.area_nome ?? cargo.localidade_nome ?? "—"}
                </span>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => rodar(() => excluirCargo(voluntarioId, cargo.id))}
                  disabled={pending}
                  className="flex min-h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-base font-medium text-red-800 transition-colors hover:bg-red-100 disabled:opacity-60"
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Remover
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MODULOS_CONCEDIVEIS.map((modulo) => {
                const concedido = cargo.modulos.includes(modulo);
                const botao = (
                  <button
                    type="button"
                    disabled={!canManage || pending}
                    onClick={() =>
                      rodar(() =>
                        alternarModuloCargo(
                          voluntarioId,
                          cargo.id,
                          modulo,
                          !concedido
                        )
                      )
                    }
                    className={`rounded-full px-3 py-1 text-base font-medium ring-1 transition-colors disabled:cursor-default ${
                      concedido
                        ? "bg-[#2195B9] text-white ring-[#2195B9]"
                        : "bg-white text-zinc-500 ring-zinc-200 hover:bg-zinc-50 disabled:hover:bg-white"
                    }`}
                  >
                    {MODULOS_LABELS[modulo]}
                  </button>
                );
                return <span key={modulo}>{botao}</span>;
              })}
            </div>
          </div>
        ))}
      </div>

      {canManage && (
        <div className="flex flex-col gap-2">
          {!mostrarNovo ? (
            <button
              type="button"
              onClick={() => setMostrarNovo(true)}
              className="flex min-h-12 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 text-lg font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            >
              <ShieldPlus size={18} aria-hidden="true" />
              Novo cargo
            </button>
          ) : (
            <form
              onSubmit={submitNovoCargo}
              className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
            >
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-base text-zinc-600">
                  Nível
                  <select
                    value={nivel}
                    onChange={(e) => setNivel(e.target.value)}
                    className="min-h-12 rounded-xl border border-zinc-300 bg-white px-3 text-lg text-zinc-900"
                  >
                    <option value="coordenador_area">Coordenador de área</option>
                    <option value="coordenador_geral_area">
                      Coordenador geral de área
                    </option>
                    <option value="coordenador_localidade">
                      Coordenador geral de localidade
                    </option>
                  </select>
                </label>
                {nivel !== "coordenador_localidade" ? (
                  <label className="flex flex-col gap-1 text-base text-zinc-600">
                    Área
                    <select
                      value={areaId}
                      onChange={(e) => setAreaId(e.target.value)}
                      className="min-h-12 rounded-xl border border-zinc-300 bg-white px-3 text-lg text-zinc-900"
                    >
                      <option value="">Selecione a área…</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="flex flex-col gap-1 text-base text-zinc-600">
                    Localidade
                    <select
                      value={localidadeId}
                      onChange={(e) => setLocalidadeId(e.target.value)}
                      className="min-h-12 rounded-xl border border-zinc-300 bg-white px-3 text-lg text-zinc-900"
                    >
                      <option value="">Selecione a localidade…</option>
                      {localidades.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-base text-zinc-600">
                  Módulos concedidos
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {MODULOS_CONCEDIVEIS.map((modulo) => {
                    const marcado = modulos.includes(modulo);
                    return (
                      <label
                        key={modulo}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-base font-medium ring-1 transition-colors ${
                          marcado
                            ? "bg-[#2195B9] text-white ring-[#2195B9]"
                            : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => alternarModulo(modulo)}
                          className="sr-only"
                        />
                        {MODULOS_LABELS[modulo]}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="flex min-h-12 items-center gap-2 rounded-xl bg-[#2195B9] px-4 text-lg font-medium text-white transition-colors hover:bg-[#28627B] disabled:opacity-60"
                >
                  <ShieldPlus size={18} aria-hidden="true" />
                  Criar cargo
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarNovo(false)}
                  disabled={pending}
                  className="flex min-h-12 items-center rounded-xl border border-zinc-300 bg-white px-4 text-lg font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {erro && <p className="text-base text-red-700">{erro}</p>}
      {mensagem && <p className="text-base text-green-700">{mensagem}</p>}
    </section>
  );
}
