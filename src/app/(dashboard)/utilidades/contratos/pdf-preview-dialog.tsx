// src/app/(dashboard)/utilidades/contratos/pdf-preview-dialog.tsx
// Janela de pré-visualização de PDF (blob URL) usada no editor de modelos e
// no lote em massa. Em celulares o visualizador embutido pode não abrir —
// por isso há sempre "Abrir em nova aba" e "Baixar".
"use client";

import { useEffect, useRef } from "react";
import { Download, ExternalLink, X } from "lucide-react";

export type PdfAberto = { url: string; filename: string };

export default function PdfPreviewDialog({
  pdf,
  onClose,
}: {
  pdf: PdfAberto | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (pdf && !dialog.open) dialog.showModal();
    if (!pdf && dialog.open) dialog.close();
  }, [pdf]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto h-[92vh] w-[min(960px,96vw)] max-w-none rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-black/50"
      aria-label="Pré-visualização do contrato"
    >
      {pdf && (
        <div className="flex h-full flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
            <p className="min-w-0 truncate text-lg font-semibold text-zinc-900">{pdf.filename}</p>
            <div className="flex items-center gap-2">
              <a
                href={pdf.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-base font-medium text-[#2195B9] hover:bg-[#e8f4f8]"
              >
                <ExternalLink size={18} aria-hidden="true" />
                Nova aba
              </a>
              <a
                href={pdf.url}
                download={pdf.filename}
                className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-base font-medium text-[#2195B9] hover:bg-[#e8f4f8]"
              >
                <Download size={18} aria-hidden="true" />
                Baixar
              </a>
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100"
                aria-label="Fechar pré-visualização"
              >
                <X size={22} />
              </button>
            </div>
          </div>
          <iframe src={pdf.url} title="Contrato em PDF" className="w-full flex-1" />
        </div>
      )}
    </dialog>
  );
}
