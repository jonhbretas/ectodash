"use client";

import { useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  FileText,
  HelpCircle,
  MessageSquarePlus,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStoredPreference } from "@/lib/use-stored-preference";

const NAO_MOSTRAR_KEY = "ectodash:atalhos-nao-mostrar";

type AtalhosAjudaProps = {
  voluntarioId?: number | null;
};

type Atalho = {
  href: string;
  label: string;
  descricao: string;
  Icon: typeof ClipboardList;
  color: string;
};

export default function AtalhosAjuda({ voluntarioId }: AtalhosAjudaProps) {
  const [naoMostrar, setNaoMostrar] = useStoredPreference(NAO_MOSTRAR_KEY, "0");
  const [open, setOpen] = useState(false);
  const autoOpenedRef = useRef(false);

  const atalhos: Atalho[] = [
    {
      href: voluntarioId ? `/?responsavel=${voluntarioId}` : "/",
      label: "Ver minhas demandas",
      descricao: "Veja suas tarefas, prazos e o que está com você",
      Icon: ClipboardList,
      color: "bg-[#2195B9]",
    },
    {
      href: "/reunioes#pedir-pauta",
      label: "Pedir pauta",
      descricao: "Sugira um assunto para a próxima reunião",
      Icon: MessageSquarePlus,
      color: "bg-[#FDBA2F]",
    },
    {
      href: "/reunioes#atas",
      label: "Ver atas das reuniões",
      descricao: "Consulte o histórico e as decisões registradas",
      Icon: FileText,
      color: "bg-[#28627B]",
    },
  ];

  // Auto-abre uma vez para quem nunca dispensou com "não mostrar novamente"
  useEffect(() => {
    if (naoMostrar === "1" || autoOpenedRef.current) return;
    const t = window.setTimeout(() => {
      autoOpenedRef.current = true;
      setOpen(true);
    }, 900);
    return () => window.clearTimeout(t);
  }, [naoMostrar]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
  }

  return (
    <>
      {/* Botão flutuante — espelho do FeedbackButton (que fica à direita) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ver atalhos — Minhas demandas, Pedir pauta, Ver atas"
        title="Atalhos — Minhas demandas, Pedir pauta, Ver atas"
        className="fixed bottom-6 left-6 z-40 flex size-14 items-center justify-center rounded-full bg-white text-[#2195B9] shadow-[0_4px_16px_rgba(0,0,0,0.12)] ring-1 ring-slate-200 transition-all hover:bg-[#2195B9] hover:text-white hover:shadow-[0_6px_20px_rgba(33,149,185,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] lg:bottom-6"
      >
        <HelpCircle size={26} aria-hidden="true" />
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-[560px]">
          {/* Header com gradiente da marca */}
          <div className="bg-gradient-to-r from-[#2195B9] to-[#28627B] px-6 py-6 text-white">
            <DialogHeader className="gap-1.5 text-left sm:text-left">
              <DialogTitle className="flex items-center gap-2.5 text-2xl font-bold leading-tight text-white">
                <span className="flex size-9 items-center justify-center rounded-full bg-white/20">
                  <HelpCircle size={20} aria-hidden="true" className="text-white" />
                </span>
                Atalhos rápidos
              </DialogTitle>
              <DialogDescription className="text-base leading-relaxed text-white/90">
                As 3 coisas que você mais vai usar no EctoDash — toque em
                qualquer cartão para ir direto.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex flex-col gap-3 bg-white px-5 py-5 sm:px-6">
            {atalhos.map(({ href, label, descricao, Icon, color }) => (
              <a
                key={href + label}
                href={href}
                onClick={() => setOpen(false)}
                className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-[#2195B9]/30 hover:bg-[#2195B9]/5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] active:scale-[0.99]"
              >
                <span
                  className={`flex size-14 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${color}`}
                  aria-hidden="true"
                >
                  <Icon size={26} strokeWidth={1.75} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-lg font-semibold leading-tight text-zinc-900 group-hover:text-[#2195B9]">
                    {label}
                  </span>
                  <span className="text-sm leading-snug text-zinc-500">
                    {descricao}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors group-hover:bg-[#2195B9] group-hover:text-white"
                >
                  ›
                </span>
              </a>
            ))}

            <p className="px-1 pt-1 text-sm leading-relaxed text-zinc-500">
              Dica: este menu fica sempre no botão{" "}
              <span className="inline-flex items-center gap-1 font-medium text-[#2195B9]">
                <HelpCircle size={14} aria-hidden="true" /> Ajuda
              </span>{" "}
              no canto inferior esquerdo.
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
              <input
                type="checkbox"
                checked={naoMostrar === "1"}
                onChange={(e) => setNaoMostrar(e.target.checked ? "1" : "0")}
                className="size-4 rounded border-slate-300 text-[#2195B9] focus:ring-[#2195B9]"
              />
              Não mostrar automaticamente
            </label>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-5 text-sm font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            >
              <X size={16} aria-hidden="true" />
              Fechar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
