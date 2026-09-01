"use client";

import { useState, useTransition } from "react";
import { UserX, UserCheck, Trash2, UserPlus, ArrowLeftRight, CheckCircle2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { marcarAusencia, removerAusencia, excluirEscala, atualizarStatusEscala, desalocarVoluntario, efetivarAlocacao, desefetivarAlocacao } from "./actions";
import AusenciaDialog from "./ausencia-dialog";
import AlocacaoManualDialog from "./alocacao-manual-dialog";
import SubstituicaoDialog from "./substituicao-dialog";

type Alocacao = {
  id: number;
  funcao: string;
  voluntario_id: number;
  voluntario_nome: string;
  voluntario_unidade: string | null;
  efetivado: boolean;
  substituido_por: number | null;
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
  "Monitoria",
  "Acoplador 1",
  "Acoplador 2",
];

const FUNCOES_VAGAS: Record<string, number> = {
  Epicon: 1,
  "Observador Parapsíquico": 1,
  Cronometrista: 1,
  "Energizador 1": 1,
  "Energizador 2": 1,
  "Energizador 3": 1,
  Monitoria: 2,
  "Acoplador 1": 1,
  "Acoplador 2": 1,
};

function monitorLabel(funcao: string): string | null {
  const m = funcao.match(/^Monitoria (\d+)$/);
  return m ? `M${m[1]}` : null;
}

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
  const [alocacaoDialogOpen, setAlocacaoDialogOpen] = useState(false);
  const [substituicaoDialogOpen, setSubstituicaoDialogOpen] = useState(false);
  const [selectedVoluntario, setSelectedVoluntario] = useState<{
    id: number;
    nome: string;
  } | null>(null);
  const [selectedFuncao, setSelectedFuncao] = useState<string>("");
  const [substituicaoData, setSubstituicaoData] = useState<{
    funcao: string;
    voluntarioId: number;
    voluntarioNome: string;
  } | null>(null);

  const ausentesSet = new Set(ausencias.map((a) => a.voluntario_id));

  // Agrupar alocações por função
  const porFuncao = new Map<string, Alocacao[]>();
  for (const f of FUNCOES_ORDEM) {
    porFuncao.set(f, []);
  }
  for (const a of alocacoes) {
    let lista = porFuncao.get(a.funcao);
    if (!lista) {
      const base = a.funcao.replace(/ \d+$/, "");
      lista = porFuncao.get(base);
    }
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

  function handleAlocar(funcao: string) {
    // Se a função tem vagas múltiplas, gerar o nome com vaga
    const vagas = FUNCOES_VAGAS[funcao] ?? 1;
    const alocacoesExistentes = porFuncao.get(funcao) ?? [];
    if (alocacoesExistentes.length < vagas) {
      const nomeFuncao = vagas > 1 ? `${funcao} ${alocacoesExistentes.length + 1}` : funcao;
      setSelectedFuncao(nomeFuncao);
      setAlocacaoDialogOpen(true);
    }
  }

  function handleDesalocar(voluntarioId: number) {
    if (!confirm("Remover este voluntário da escala?")) return;
    startTransition(async () => {
      await desalocarVoluntario(escalaId, voluntarioId);
    });
  }

  function handleSubstituir(funcao: string, voluntarioId: number, voluntarioNome: string) {
    setSubstituicaoData({ funcao, voluntarioId, voluntarioNome });
    setSubstituicaoDialogOpen(true);
  }

  function handleEfetivar(voluntarioId: number) {
    startTransition(async () => {
      await efetivarAlocacao(escalaId, voluntarioId);
    });
  }

  function handleDesefetivar(voluntarioId: number) {
    startTransition(async () => {
      await desefetivarAlocacao(escalaId, voluntarioId);
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
              {canManage && (
                <TableHead className="w-[120px] text-right text-lg font-semibold text-zinc-900">
                  Ações
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {FUNCOES_ORDEM.map((funcao) => {
              const alocacoesFuncao = porFuncao.get(funcao) ?? [];
              const vagas = FUNCOES_VAGAS[funcao] ?? 1;
              const vagasRestantes = vagas - alocacoesFuncao.length;
              return (
                <TableRow key={funcao}>
                  <TableCell className="text-lg font-medium text-zinc-900">
                    {funcao}
                    {vagas > 1 && (
                      <span className="ml-1 text-sm text-zinc-400">
                        ({alocacoesFuncao.length}/{vagas})
                      </span>
                    )}
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
                                  : a.efetivado
                                    ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                                    : "bg-zinc-50 text-zinc-900"
                              }`}
                            >
                              {isAusente && (
                                <UserX size={16} className="text-red-500" aria-hidden="true" />
                              )}
                              {a.efetivado && !isAusente && (
                                <CheckCircle2 size={16} className="text-emerald-500" aria-hidden="true" />
                              )}
                              {monitorLabel(a.funcao) && (
                                <span className="font-semibold text-[#2195B9]">
                                  {monitorLabel(a.funcao)}
                                </span>
                              )}
                              <span>{a.voluntario_nome}</span>
                              {a.voluntario_unidade && (
                                <span className="text-sm text-zinc-400 ml-1">
                                  ({a.voluntario_unidade})
                                </span>
                              )}
                              {canManage && (
                                <div className="flex items-center gap-1 ml-2">
                                  {/* Efetivação toggle */}
                                  {!isAusente && status === "publicada" && (
                                    a.efetivado ? (
                                      <button
                                        onClick={() => handleDesefetivar(a.voluntario_id)}
                                        className="text-emerald-600 hover:text-emerald-800 transition-colors"
                                        title="Desmarcar efetivação"
                                      >
                                        <CheckCircle2 size={14} aria-hidden="true" />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleEfetivar(a.voluntario_id)}
                                        className="text-zinc-400 hover:text-emerald-600 transition-colors"
                                        title="Marcar como efetivado (quem realmente fez)"
                                      >
                                        <CheckCircle2 size={14} aria-hidden="true" />
                                      </button>
                                    )
                                  )}
                                  {/* Ausência/Restaurar */}
                                  {status === "rascunho" && (
                                    isAusente ? (
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
                                    )
                                  )}
                                  {/* Substituir */}
                                  {status === "rascunho" && !isAusente && (
                                    <button
                                      onClick={() =>
                                        handleSubstituir(
                                          a.funcao,
                                          a.voluntario_id,
                                          a.voluntario_nome
                                        )
                                      }
                                      className="text-blue-500 hover:text-blue-700 transition-colors"
                                      title="Trocar voluntário"
                                    >
                                      <ArrowLeftRight size={14} aria-hidden="true" />
                                    </button>
                                  )}
                                  {/* Desalocar */}
                                  {status === "rascunho" && (
                                    <button
                                      onClick={() => handleDesalocar(a.voluntario_id)}
                                      className="text-red-400 hover:text-red-600 transition-colors"
                                      title="Remolver da escala"
                                    >
                                      <Trash2 size={12} aria-hidden="true" />
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
                  {canManage && (
                    <TableCell className="text-right">
                      {status === "rascunho" && vagasRestantes > 0 && (
                        <button
                          onClick={() => handleAlocar(funcao)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2195B9]/10 px-3 py-1.5 text-sm font-medium text-[#2195B9] transition-colors hover:bg-[#2195B9]/20"
                          title={`Alocar voluntário em ${funcao}`}
                        >
                          <UserPlus size={14} aria-hidden="true" />
                          Alocar
                        </button>
                      )}
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

      {/* Dialog de alocação manual */}
      {selectedFuncao && (
        <AlocacaoManualDialog
          open={alocacaoDialogOpen}
          onOpenChange={setAlocacaoDialogOpen}
          escalaId={escalaId}
          funcao={selectedFuncao}
        />
      )}

      {/* Dialog de substituição */}
      {substituicaoData && (
        <SubstituicaoDialog
          open={substituicaoDialogOpen}
          onOpenChange={setSubstituicaoDialogOpen}
          escalaId={escalaId}
          funcao={substituicaoData.funcao}
          antigoVoluntarioId={substituicaoData.voluntarioId}
          antigoVoluntarioNome={substituicaoData.voluntarioNome}
        />
      )}
    </div>
  );
}
