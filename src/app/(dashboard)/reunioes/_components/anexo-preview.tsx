"use client";

// Anexo de pauta com pré-visualização dentro do sistema. O arquivo está no
// Drive compartilhado "qualquer pessoa com o link" (leitor), então o próprio
// visualizador do Drive (/preview) abre imagens, vídeos, PDFs e documentos
// num iframe. Imagens e vídeos mostram miniatura no cartão; se o Drive ainda
// não gerou a miniatura (vídeo recém-enviado), cai num bloco com ícone.
import { useState } from "react";
import { ExternalLink, FileText, ImageIcon, Paperclip, Play } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { tipoDoAnexo } from "@/lib/pautas/anexo";

type Props = {
  driveId: string | null;
  url: string;
  nome: string | null;
};

const foco =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";

export default function AnexoPreview({ driveId, url, nome }: Props) {
  const [aberto, setAberto] = useState(false);
  const [semMiniatura, setSemMiniatura] = useState(false);
  const nomeArquivo = nome ?? "Anexo";
  const tipo = tipoDoAnexo(nomeArquivo);
  const visual = tipo === "imagem" || tipo === "video";

  // Anexos antigos sem id do Drive: só o link.
  if (!driveId) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex min-h-12 w-fit max-w-full items-center gap-2 rounded-xl bg-[#2195B9]/10 px-4 text-base font-semibold text-[#1d6f8d] hover:bg-[#2195B9]/15 ${foco}`}
      >
        <Paperclip size={18} aria-hidden="true" className="shrink-0" />
        <span className="truncate">{nomeArquivo}</span>
      </a>
    );
  }

  const id = encodeURIComponent(driveId);
  const miniatura = `https://drive.google.com/thumbnail?id=${id}&sz=w800`;
  const preview = `https://drive.google.com/file/d/${id}/preview`;
  const rotuloAcao = tipo === "video" ? "Assistir" : "Visualizar";

  return (
    <>
      {visual ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label={`${rotuloAcao}: ${nomeArquivo}`}
          className={`group relative flex aspect-video w-full max-w-sm items-center justify-center overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-zinc-200 ${foco}`}
        >
          {!semMiniatura ? (
            // eslint-disable-next-line @next/next/no-img-element -- miniatura externa do Drive, sem otimização do Next
            <img
              src={miniatura}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setSemMiniatura(true)}
              className="size-full object-cover transition-transform group-hover:scale-[1.02]"
            />
          ) : (
            <span className="flex flex-col items-center gap-2 text-zinc-600">
              {tipo === "video" ? <Play size={32} aria-hidden="true" /> : <ImageIcon size={32} aria-hidden="true" />}
              <span className="text-sm">{tipo === "video" ? "Vídeo" : "Imagem"}</span>
            </span>
          )}
          {tipo === "video" && !semMiniatura && (
            <span aria-hidden="true" className="absolute flex size-14 items-center justify-center rounded-full bg-black/60 text-white">
              <Play size={26} className="ml-1" />
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-left text-sm font-medium text-white">
            {nomeArquivo}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className={`flex min-h-12 w-fit max-w-full items-center gap-2 rounded-xl bg-[#2195B9]/10 px-4 text-base font-semibold text-[#1d6f8d] hover:bg-[#2195B9]/15 ${foco}`}
        >
          <FileText size={18} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{nomeArquivo}</span>
          <span className="shrink-0 text-sm font-medium text-zinc-600">· Visualizar</span>
        </button>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="flex h-[90dvh] w-full max-w-[calc(100%-1rem)] flex-col gap-3 p-4 sm:max-w-5xl sm:p-5">
          <div className="flex flex-wrap items-center gap-3 pr-10">
            <DialogTitle className="min-w-0 flex-1 truncate text-lg font-semibold text-zinc-900">{nomeArquivo}</DialogTitle>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 ${foco}`}
            >
              <ExternalLink size={16} aria-hidden="true" /> Abrir no Drive
            </a>
          </div>
          <DialogDescription className="sr-only">Pré-visualização do anexo da pauta.</DialogDescription>
          {aberto && (
            <iframe
              src={preview}
              title={`Pré-visualização: ${nomeArquivo}`}
              allow="autoplay; fullscreen"
              allowFullScreen
              className="min-h-0 w-full flex-1 rounded-lg border-0 bg-zinc-100"
            />
          )}
          {tipo === "video" && (
            <p className="text-sm text-zinc-600">
              Vídeo recém-enviado pode levar alguns minutos para ficar disponível enquanto o Google processa.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
