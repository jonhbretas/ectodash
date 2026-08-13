"use client";

// src/components/notificacoes/notificacoes-resolvidas.tsx
// Mostra, ao entrar no dashboard, um dialog com as notificações não lidas:
// relatos de bug/sugestão que o autor abriu e o coordenador marcou como
// resolvido. Ao fechar, marca todas como lidas — aparece ao menos uma vez.
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { marcarNotificacoesLidas } from "./actions";

export type NotificacaoRow = {
  id: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  createdAt: string;
};

function formatarData(iso: string): string {
  return format(new Date(iso), "dd/MM/yyyy", { locale: ptBR });
}

export default function NotificacoesResolvidas({
  itens,
}: {
  itens: NotificacaoRow[];
}) {
  const [aberto, setAberto] = useState(itens.length > 0);

  if (itens.length === 0) return null;

  const fechar = () => {
    if (!aberto) return;
    setAberto(false);
    void marcarNotificacoesLidas(itens.map((n) => n.id));
  };

  return (
    <Dialog
      open={aberto}
      onOpenChange={(abrir) => {
        if (!abrir) fechar();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <CheckCircle2 size={26} className="text-green-700" aria-hidden="true" />
            Sua solicitação foi atendida
          </DialogTitle>
          <DialogDescription>
            {itens.length === 1
              ? "Um relato seu foi resolvido enquanto você estava fora:"
              : `${itens.length} relatos seus foram resolvidos enquanto você estava fora:`}
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-3">
          {itens.map((n) => (
            <li
              key={n.id}
              className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-4"
            >
              <p className="text-base font-medium leading-relaxed text-zinc-900">
                {n.mensagem}
              </p>
              <span className="text-sm text-zinc-500">
                Atendido em {formatarData(n.createdAt)}
              </span>
            </li>
          ))}
        </ul>

        <DialogFooter>
          {itens[0]?.link && (
            <Link
              href={itens[0].link}
              onClick={fechar}
              className="flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            >
              Ver meus relatos
            </Link>
          )}
          <button
            type="button"
            onClick={fechar}
            className="flex min-h-10 items-center justify-center rounded-lg bg-[#2195B9] px-4 text-sm font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            Entendi
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
