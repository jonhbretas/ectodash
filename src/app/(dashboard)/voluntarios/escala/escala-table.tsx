"use client";

import { useState, useTransition } from "react";
import { UserX, UserCheck, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { marcarAusencia, removerAusencia, excluirEscala, atualizarStatusEscala } from "./actions";
import AusenciaDialog from "./ausencia-dialog";

type Alocacao = {
  id: number;
  funcao: string;
  voluntario_id: number;
  voluntario_nome: string;
  voluntario_unidade: string | null;
  is_ausente: boolean;
};

type Ausencia = {
  voluntario_id: number;
  voluntario_nome: string;
  motivo: string | null;
};

const FUNCOES_ORDEM = [
  "Epicon",
  "Observador Parapsíquico",
  "Cronometrista",
  "Energizador 1",
  "Energizador 2",
  "Energizador 3",
  "Monitor 1",
  "Monitor 2",
  "Acoplador 1",
  "Acoplador 12",
];

export default function EscalaTable({
  escalaId,
  alocacoes,
  ausencias,
  status,
  canManage,
  isCoordenadorGeral,
}: {
  escalaId: number;
  alocacoes: Alocacao[];
  ausencias: Ausencia[];
  status: string;
  canManage: boolean;
  isCoordenadorGeral: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [ausenciaDialogOpen, setAusenciaDialogOpen] = useState(false);
  const [selectedVoluntario, setSelectedVoluntario] = useState<{
    id: number;
    nome: string;
  } | null>(null);

  const ausentesSet = new Set(ausencias.map((a) => a.voluntario_id));

  // Agrupar alocações por função
  const porFuncao = new Map<string, Alocacao[]>();
  for (const f of FUNCOES_ORDEM) {
    porFuncao.set(f, []);
  }
  for (const a of alocacoes) {
    // Mapear nomes com vagas múltiplas: "Monitoria 1" → "Monitoria"
    const base = a.funcao.replace(/ \d+$/, "");
    const lista = porFuncao.get(base);
    if (lista) lista.push(a);
  }

  function handleMarcarAusencia(voluntarioId: number, voluntarioNome: string) {
    setSelectedVoluntario({ id: voluntarioId, nome: voluntarioNome });
    setAusenciaDialogOpen(true);
  }

  function handleRemoverAusencia(voluntarioId: number) {
    startTransition(async () => {
      await removerAusencia(escalaId, voluntarioId);
    });
  }

  function handlePublicar() {
    startTransition(async () => {
      await atualizarStatusEscala(escalaId, "publicada");
    });
  }

  function handleCancelar() {
    startTransition(async () => {
      await atualizarStatusEscala(escalaId, "cancelada");
    });
  }

  function handleExcluir() {
    if (!confirm("Tem certeza que deseja excluir esta escala?")) return;
    startTransition(async () => {
      await excluirEscala(escalaId);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px] text-lg font-semibold text-zinc-900">
                Função
              </TableHead>
              <TableHead className="text-lg font-semibold text-zinc-900">
                Voluntário(s)
              </TableHead>
              {canManage && status === "rascunho" && (
                <TableHead className="w-[100px] text-right text-lg font-semibold text-zinc-900">
                  Ações
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {FUNCOES_ORDEM.map((funcao) => {
              const alocacoesFuncao = porFuncao.get(funcao) ?? [];
              return (
                <TableRow key={funcao}>
                  <TableCell className="text-lg font-medium text-zinc-900">
                    {funcao}
                  </TableCell>
                  <TableCell>
                    {alocacoesFuncao.length === 0 ? (
                      <span className="text-lg text-zinc-400 italic">
                        Vaga aberta
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {alocacoesFuncao.map((a) => {
                          const isAusente = ausentesSet.has(a.voluntario_id);
                          return (
                            <div
                              key={a.id}
                              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-lg ${
                                isAusente
                                  ? "bg-red-50 text-red-700 line-through"
                                  : "bg-zinc-50 text-zinc-900"
                              }`}
                            >
                              {isAusente && (
                                <UserX size={16} className="text-red-500" aria-hidden="true" />
                              )}
                              <span>{a.voluntario_nome}</span>
                              {a.voluntario_unidade && (
                                <span className="text-sm text-zinc-400 ml-1">
                                  ({a.voluntario_unidade})
                                </span>
                              )}
                              {canManage && status === "rascunho" && (
                                <div className="flex items-center gap-1 ml-2">
                                  {isAusente ? (
                                    <button
                                      onClick={() =>
                                        handleRemoverAusencia(a.voluntario_id)
                                      }
                                      className="text-emerald-600 hover:text-emerald-800 transition-colors"
                                      title="Restaurar voluntário"
                                    >
                                      <UserCheck size={14} aria-hidden="true" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        handleMarcarAusencia(
                                          a.voluntario_id,
                                          a.voluntario_nome
                                        )
                                      }
                                      className="text-amber-600 hover:text-amber-800 transition-colors"
                                      title="Marcar ausência"
                                    >
                                      <UserX size={14} aria-hidden="true" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </TableCell>
                  {canManage && status === "rascunho" && (
                    <TableCell className="text-right">
                      {/* Actions column - empty for now, actions are inline */}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Ausências */}
      {ausencias.length > 0 && (
        <div className="rounded-2xl bg-amber-50 px-6 py-4 ring-1 ring-amber-200/60">
          <h3 className="text-lg font-semibold text-amber-800 mb-2">
            Ausências registradas
          </h3>
          <div className="flex flex-wrap gap-2">
            {ausencias.map((a) => (
              <div
                key={a.voluntario_id}
                className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-base text-amber-700 ring-1 ring-amber-200"
              >
                <UserX size={14} aria-hidden="true" />
                <span className="font-medium">{a.voluntario_nome}</span>
                {a.motivo && (
                  <span className="text-amber-600">— {a.motivo}</span>
                )}
                {canManage && status === "rascunho" && (
                  <button
                    onClick={() => handleRemoverAusencia(a.voluntario_id)}
                    className="ml-2 text-amber-500 hover:text-amber-700 transition-colors"
                    title="Remover ausência"
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ações do coordenador */}
      {canManage && (
        <div className="flex flex-wrap gap-3">
          {status === "rascunho" && (
            <>
              <button
                onClick={handlePublicar}
                disabled={pending || alocacoes.length === 0}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-lg font-medium text-white transition-all duration-200 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              >
                Publicar escala
              </button>
              <button
                onClick={handleCancelar}
                disabled={pending}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-lg font-medium text-zinc-700 transition-all duration-200 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
              >
                Cancelar escala
              </button>
            </>
          )}
          {status === "publicada" && (
            <button
              onClick={handleCancelar}
              disabled={pending}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-lg font-medium text-zinc-700 transition-all duration-200 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            >
              Despublicar
            </button>
          )}
          {isCoordenadorGeral && (
            <button
              onClick={handleExcluir}
              disabled={pending}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 text-lg font-medium text-red-600 transition-all duration-200 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
              <Trash2 size={18} aria-hidden="true" />
              Excluir
            </button>
          )}
        </div>
      )}

      {/* Dialog de ausência */}
      {selectedVoluntario && (
        <AusenciaDialog
          open={ausenciaDialogOpen}
          onOpenChange={setAusenciaDialogOpen}
          escalaId={escalaId}
          voluntarioId={selectedVoluntario.id}
          voluntarioNome={selectedVoluntario.nome}
        />
      )}
    </div>
  );
}
