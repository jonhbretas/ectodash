"use client";

// Miniaturas passam pela rota autenticada do Ectodash; o visualizador do
// Drive (/preview) continua disponível para abrir o arquivo completo.
import { useState } from "react";
import { ExternalLink, FileText, ImageIcon, Loader2, Maximize2, Paperclip, Play } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { tipoDoAnexo } from "@/lib/pautas/anexo";

type Props = {
  pautaId: number;
  driveId: string | null;
  url: string;
  nome: string | null;
};

const foco =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";

export default function AnexoPreview({ pautaId, driveId, url, nome }: Props) {
  const [aberto, setAberto] = useState(false);
  const [erroSrc, setErroSrc] = useState<string | null>(null);
  const [carregadaSrc, setCarregadaSrc] = useState<string | null>(null);
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
  const miniatura = `/api/pautas/${pautaId}/anexo/preview?v=${id}`;
  const semMiniatura = erroSrc === miniatura;
  const carregada = carregadaSrc === miniatura;
  const preview = `https://drive.google.com/file/d/${id}/preview`;
  const rotuloAcao = tipo === "video" ? "Assistir" : "Visualizar";

  return (
    <>
      {visual ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label={`${rotuloAcao}: ${nomeArquivo}`}
          className={`group flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md ${foco}`}
        >
          <span className={`relative flex w-full items-center justify-center overflow-hidden bg-slate-50 ${semMiniatura ? "min-h-28" : "aspect-video"}`}>
          {!semMiniatura && !carregada && (
            <span role="status" className="absolute flex items-center gap-2 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Carregando prévia…</span>
          )}
          {!semMiniatura ? (
            // eslint-disable-next-line @next/next/no-img-element -- rota autenticada, sem cache compartilhado do otimizador
            <img
              src={miniatura}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onLoad={() => setCarregadaSrc(miniatura)}
              onError={() => setErroSrc(miniatura)}
              className={`absolute inset-0 size-full object-contain transition-opacity ${carregada ? "opacity-100" : "opacity-0"}`}
            />
          ) : (
            <span className="flex flex-col items-center gap-2 text-zinc-600">
              {tipo === "video" ? <Play size={32} aria-hidden="true" /> : <ImageIcon size={32} aria-hidden="true" />}
              <span className="text-sm font-medium">Prévia indisponível</span>
              <span className="text-xs">Clique para abrir {tipo === "video" ? "o vídeo" : "a imagem"}</span>
            </span>
          )}
          {tipo === "video" && carregada && !semMiniatura && (
            <span aria-hidden="true" className="absolute flex size-14 items-center justify-center rounded-full bg-black/60 text-white">
              <Play size={26} className="ml-1" />
            </span>
          )}
          </span>
          <span className="flex w-full items-center gap-3 border-t border-zinc-100 px-3 py-3">
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800" title={nomeArquivo}>{nomeArquivo}</span><span className="mt-0.5 block text-xs text-slate-500">{tipo === "video" ? "Vídeo anexado · assistir" : "Imagem anexada · ampliar"}</span></span>
            <Maximize2 size={17} className="shrink-0 text-[#2195B9]" aria-hidden="true" />
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
