"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { alocarVoluntario, listarVoluntariosElegiveis } from "./actions";

type VoluntarioElegivel = {
  id: number;
  nome: string;
  unidade: string | null;
  total_funcao_mes: number;
};

export default function AlocacaoManualDialog({
  open,
  onOpenChange,
  escalaId,
  funcao,
  onAlocado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  escalaId: number;
  funcao: string;
  onAlocado?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [voluntarios, setVoluntarios] = useState<VoluntarioElegivel[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [mensagem, setMensagem] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!open) {
      setVoluntarios([]);
      setBusca("");
      setMensagem(null);
      return;
    }
    setLoading(true);
    listarVoluntariosElegiveis(escalaId, funcao).then((data) => {
      setVoluntarios(data);
      setLoading(false);
    });
  }, [open, escalaId, funcao]);

  const filtrados = voluntarios.filter((v) =>
    v.nome.toLowerCase().includes(busca.toLowerCase())
  );

  function handleAlocar(voluntarioId: number) {
    setMensagem(null);
    startTransition(async () => {
      const result = await alocarVoluntario(escalaId, funcao, voluntarioId);
      setMensagem({ ok: result.ok, text: result.message });
      if (result.ok) {
        onAlocado?.();
        setTimeout(() => onOpenChange(false), 800);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Alocar em {funcao}</DialogTitle>
          <DialogDescription>
            Selecione um voluntário elegível para esta função.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-base text-zinc-500 py-4">Carregando voluntários...</p>
        ) : (
          <>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nome..."
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-lg text-zinc-900 outline-none focus:ring-2 focus:ring-[#2195B9]"
            />

            <div className="max-h-72 overflow-y-auto mt-2">
              {filtrados.length === 0 ? (
                <p className="text-base text-zinc-400 py-4">
                  {voluntarios.length === 0
                    ? "Nenhum voluntário elegível encontrado."
                    : "Nenhum voluntário encontrado para esta busca."}
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {filtrados.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => handleAlocar(v.id)}
                      disabled={pending}
                      className="flex items-center justify-between rounded-xl px-4 py-3 text-left text-base transition-colors hover:bg-zinc-100 disabled:opacity-50"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-zinc-900">{v.nome}</span>
                        {v.unidade && (
                          <span className="text-sm text-zinc-400">{v.unidade}</span>
                        )}
                      </div>
                      {v.total_funcao_mes > 0 && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-700">
                          {v.total_funcao_mes}× este mês
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {mensagem && (
          <p
            className={`text-base font-medium ${
              mensagem.ok ? "text-emerald-700" : "text-red-600"
            }`}
          >
            {mensagem.text}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
