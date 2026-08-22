"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, UserRoundPlus, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  adicionarNovoParticipanteLocalidade,
  buscarParticipantesLocalidade,
  salvarParticipantesLocalidade,
  type ParticipanteLocalidade,
} from "./actions";

type ParticipantesLocalidadeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  escalaId: number;
  sortearDepoisDeSalvar?: boolean;
  onSaved?: () => void;
};

export default function ParticipantesLocalidadeDialog({
  open,
  onOpenChange,
  escalaId,
  sortearDepoisDeSalvar = false,
  onSaved,
}: ParticipantesLocalidadeDialogProps) {
  const [pending, startTransition] = useTransition();
  const [carregado, setCarregado] = useState(false);
  const [localidade, setLocalidade] = useState<string | null>(null);
  const [participantes, setParticipantes] = useState<ParticipanteLocalidade[]>([]);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [mensagem, setMensagem] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let ativo = true;

    if (!open) return;

    buscarParticipantesLocalidade(escalaId)
      .then((result) => {
        if (!ativo) return;
        if (!result.ok) {
          setMensagem({ ok: false, text: result.message });
          setCarregado(true);
          return;
        }

        setLocalidade(result.localidade);
        setParticipantes(result.participantes);
        setSelecionados(
          result.configurado
            ? result.selecionados
            : result.participantes.map((participante) => participante.id)
        );
        setNovoNome("");
        setCarregado(true);
      })
      .catch(() => {
        if (!ativo) return;
        setMensagem({
          ok: false,
          text: "Não foi possível carregar os participantes. Tente novamente.",
        });
        setCarregado(true);
      });

    return () => {
      ativo = false;
    };
  }, [open, escalaId]);

  function handleOpenChange(nextOpen: boolean) {
    setCarregado(false);
    if (!nextOpen) {
      setLocalidade(null);
      setParticipantes([]);
      setSelecionados([]);
      setNovoNome("");
      setMensagem(null);
    }
    onOpenChange(nextOpen);
  }

  const selecionadosSet = new Set(selecionados);
  const ativosSelecionados = participantes.filter(
    (participante) => participante.ativo && selecionadosSet.has(participante.id)
  ).length;

  function alternarParticipante(id: number) {
    setSelecionados((atuais) =>
      atuais.includes(id)
        ? atuais.filter((atual) => atual !== id)
        : [...atuais, id]
    );
  }

  function marcarTodos() {
    setSelecionados(participantes.filter((p) => p.ativo).map((p) => p.id));
  }

  function limparSelecao() {
    setSelecionados([]);
  }

  function handleAdicionar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMensagem(null);

    if (!novoNome.trim()) {
      setMensagem({ ok: false, text: "Digite o nome do novo participante." });
      return;
    }

    startTransition(async () => {
      const result = await adicionarNovoParticipanteLocalidade(
        escalaId,
        novoNome
      );
      if (!result.ok) {
        setMensagem({ ok: false, text: result.message });
        return;
      }

      setParticipantes(result.participantes);
      if (result.novo) {
        setSelecionados((atuais) =>
          atuais.includes(result.novo!.id)
            ? atuais
            : [...atuais, result.novo!.id]
        );
      }
      setNovoNome("");
      setMensagem({ ok: true, text: result.message });
    });
  }

  function handleSalvar() {
    setMensagem(null);
    startTransition(async () => {
      const result = await salvarParticipantesLocalidade(
        escalaId,
        selecionados
      );
      if (!result.ok) {
        setMensagem({ ok: false, text: result.message });
        return;
      }

      setMensagem({ ok: true, text: result.message });
      onSaved?.();
      handleOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users size={22} className="text-[#2195B9]" aria-hidden="true" />
            {sortearDepoisDeSalvar
              ? "Participantes para o sorteio"
              : "Editar participantes da DIP"}
          </DialogTitle>
          <DialogDescription>
            {localidade
              ? `Escolha quem participa da DIP em ${localidade}.`
              : "Escolha os participantes que poderão ser sorteados para a DIP."}
            {sortearDepoisDeSalvar && " Depois de salvar, o sorteio será feito automaticamente."}
          </DialogDescription>
        </DialogHeader>

        {open && !carregado ? (
          <div className="flex items-center gap-2 py-8 text-base text-zinc-500">
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            Carregando participantes...
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-base font-medium text-zinc-700">
                {ativosSelecionados} selecionado
                {ativosSelecionados === 1 ? "" : "s"}
                {participantes.length > 0 && ` de ${participantes.length}`}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={marcarTodos}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-[#2195B9] hover:bg-[#2195B9]/10"
                >
                  Marcar todos
                </button>
                <button
                  type="button"
                  onClick={limparSelecao}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-xl border border-zinc-200">
              {participantes.length === 0 ? (
                <p className="px-4 py-6 text-center text-base text-zinc-500">
                  Nenhum voluntário encontrado para esta localidade. Adicione o
                  primeiro abaixo.
                </p>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {participantes.map((participante) => {
                    const selecionado = selecionadosSet.has(participante.id);
                    return (
                      <label
                        key={participante.id}
                        className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 ${
                          selecionado ? "bg-[#2195B9]/5" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selecionado}
                          onChange={() => alternarParticipante(participante.id)}
                          className="h-5 w-5 shrink-0 accent-[#2195B9]"
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-base font-medium text-zinc-900">
                            {participante.nome}
                          </span>
                          <span className="truncate text-sm text-zinc-500">
                            {participante.unidade ?? "Sem unidade"}
                            {!participante.ativo && " · inativo"}
                          </span>
                        </span>
                        {selecionado && (
                          <Check
                            size={18}
                            className="shrink-0 text-[#2195B9]"
                            aria-hidden="true"
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4">
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                  <UserRoundPlus size={18} className="text-[#2195B9]" aria-hidden="true" />
                  Adicionar voluntário novo
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Para alguém que ainda não consta no sistema. Será criado um
                  cadastro simples, sem conta de acesso.
                </p>
              </div>
              <form onSubmit={handleAdicionar} className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Nome completo"
                  aria-label="Nome do novo voluntário"
                  className="min-h-12 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-[#2195B9] focus:ring-2 focus:ring-[#2195B9]/20"
                />
                <Button type="submit" variant="outline" disabled={pending}>
                  <Plus size={18} aria-hidden="true" />
                  Adicionar
                </Button>
              </form>
            </div>
          </div>
        )}

        {mensagem && (
          <p
            className={`text-base font-medium ${
              mensagem.ok ? "text-emerald-700" : "text-red-600"
            }`}
            role={mensagem.ok ? "status" : "alert"}
          >
            {mensagem.text}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSalvar} disabled={pending || !carregado}>
            {pending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
            {sortearDepoisDeSalvar ? "Salvar e sortear" : "Salvar participantes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditarParticipantesButton({ escalaId }: { escalaId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="min-h-12 rounded-xl text-base"
      >
        <Users size={18} aria-hidden="true" />
        Editar participantes
      </Button>
      <ParticipantesLocalidadeDialog
        open={open}
        onOpenChange={setOpen}
        escalaId={escalaId}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
