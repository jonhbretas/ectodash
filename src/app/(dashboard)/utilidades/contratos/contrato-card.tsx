// src/app/(dashboard)/utilidades/contratos/contrato-card.tsx
// Card de um contrato na listagem: status, links (PDF, pasta no Drive) e as
// ações do ciclo de assinatura (enviar para Assinafy, upload do assinado,
// marcar assinado, sincronizar, cancelar). Cada ação é um form com
// useActionState seguindo o padrão do projeto.
"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  FileText,
  FolderOpen,
  ExternalLink,
  Copy,
  Check,
  Upload,
  X,
  Send,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import type { ContratoStatus } from "@/lib/contratos/render";
import {
  cancelarContrato,
  enviarParaAssinatura,
  marcarAssinadoManual,
  sincronizarAssinado,
  uploadAssinado,
  type ContratoActionState,
} from "./actions";

export type ContratoCardProps = {
  contrato: {
    id: number;
    modelo_titulo: string;
    aluno_nome: string;
    aluno_email: string | null;
    aluno_documento: string | null;
    status: ContratoStatus;
    expira_em: string | null;
    drive_pasta_url: string | null;
    drive_arquivo_url: string | null;
    drive_assinado_url: string | null;
    assinafy_document_id: string | null;
    created_at: string;
  };
  vencido?: boolean;
  eventoData: string | null;
  categoriaLabel: string;
  valorLabel: string | null;
};

const initial: ContratoActionState = { ok: true, message: "" };

const STATUS_INFO: Record<
  ContratoStatus,
  { label: string; className: string }
> = {
  gerado: {
    label: "Aguardando assinatura",
    className: "bg-blue-50 text-blue-800 ring-blue-200/60",
  },
  assinando: {
    label: "Em assinatura",
    className: "bg-amber-50 text-amber-800 ring-amber-200/60",
  },
  assinado: {
    label: "Assinado",
    className: "bg-green-50 text-green-800 ring-green-200/60",
  },
  recusado: {
    label: "Recusado",
    className: "bg-red-50 text-red-800 ring-red-200/60",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-zinc-100 text-zinc-600 ring-zinc-200/60",
  },
};

function Message({ state }: { state: ContratoActionState }) {
  if (!state.message) return null;
  return (
    <p
      className={`text-base ${
        state.ok ? "text-green-700" : "text-red-700"
      }`}
    >
      {state.message}
    </p>
  );
}

function CopyLink({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-11 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-4 text-base font-medium text-[#2195B9] transition-colors hover:bg-zinc-50"
      >
        <ExternalLink size={16} aria-hidden="true" />
        {label}
      </a>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(url).catch(() => undefined);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="flex min-h-11 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
      >
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        {copied ? "Copiado!" : "Copiar"}
      </button>
    </span>
  );
}

export default function ContratoCard({ contrato, vencido = false, eventoData, categoriaLabel, valorLabel }: ContratoCardProps) {
  const statusInfo = STATUS_INFO[contrato.status];
  const [enviarState, enviarAction, enviarPending] = useActionState(
    enviarParaAssinatura.bind(null, contrato.id),
    initial
  );
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadAssinado.bind(null, contrato.id),
    initial
  );
  const [marcarState, marcarAction, marcarPending] = useActionState(
    marcarAssinadoManual.bind(null, contrato.id),
    initial
  );
  const [sincState, sincAction, sincPending] = useActionState(
    sincronizarAssinado.bind(null, contrato.id),
    initial
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelarContrato.bind(null, contrato.id),
    initial
  );

  const podeAcao =
    contrato.status === "gerado" ||
    contrato.status === "assinando" ||
    contrato.status === "recusado";
  const podeSincronizar =
    (contrato.status === "assinando" || contrato.status === "assinado") &&
    Boolean(contrato.assinafy_document_id);

  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-xl font-semibold text-zinc-900">
            {contrato.modelo_titulo}
          </h3>
          <p className="text-base font-medium text-zinc-600">
            {contrato.aluno_nome}
            {eventoData ? ` · ${eventoData}` : ""}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
            vencido
              ? "bg-red-50 text-red-800 ring-red-200/60"
              : statusInfo.className
          }`}
        >
          {vencido ? "Vencido" : statusInfo.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-base text-zinc-500">
        <span className="rounded-full bg-purple-50 px-2.5 py-0.5 font-medium text-purple-800 ring-1 ring-purple-200/60">
          {categoriaLabel}
        </span>
        {contrato.aluno_email && <span className="break-all">{contrato.aluno_email}</span>}
        {contrato.aluno_documento && <span className="break-all">{contrato.aluno_documento}</span>}
        {valorLabel && <span className="font-semibold text-zinc-700">{valorLabel}</span>}
        {!vencido && contrato.expira_em && (
          <span className="text-amber-700">
            Vence em{" "}
            {new Date(`${contrato.expira_em.slice(0, 10)}T00:00:00`).toLocaleDateString(
              "pt-BR"
            )}
          </span>
        )}
        <span>
          Criado em{" "}
          {new Date(`${contrato.created_at.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR")}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/api/contratos/${contrato.id}/pdf`}
          className="flex min-h-12 items-center gap-1.5 rounded-xl bg-[#2195B9] px-4 text-base font-medium text-white transition-colors hover:bg-[#28627B]"
        >
          <FileText size={17} aria-hidden="true" />
          Baixar PDF
        </Link>
        {contrato.drive_pasta_url && (
          <a
            href={contrato.drive_pasta_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <FolderOpen size={17} aria-hidden="true" />
            Pasta no Drive
          </a>
        )}
        {contrato.status === "assinado" && contrato.drive_assinado_url && (
          <a
            href={contrato.drive_assinado_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center gap-1.5 rounded-xl border border-green-300 bg-green-50 px-4 text-base font-medium text-green-800 transition-colors hover:bg-green-100"
          >
            <CheckCircle2 size={17} aria-hidden="true" />
            PDF assinado
          </a>
        )}
      </div>

      {(contrato.status === "gerado" || contrato.status === "recusado") && (
        <form action={enviarAction} className="flex flex-col gap-1">
          <button
            type="submit"
            disabled={enviarPending}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#FDBA2F] px-4 text-base font-semibold text-zinc-900 transition-colors hover:bg-[#f0ac1a] disabled:opacity-60"
          >
            <Send size={17} aria-hidden="true" />
            {enviarPending
              ? "Enviando..."
              : contrato.status === "recusado"
                ? "Reenviar para assinatura"
                : "Enviar para assinatura"}
          </button>
          <Message state={enviarState} />
          {enviarState.assinaturaUrl && (
            <CopyLink url={enviarState.assinaturaUrl} label="Link de assinatura" />
          )}
        </form>
      )}

      {podeAcao && (
        <div className="flex flex-col gap-3 border-t border-zinc-100 pt-3">
          <form action={uploadAction} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50">
                <Upload size={17} aria-hidden="true" />
                Escolher PDF assinado
                <input
                  type="file"
                  name="arquivo"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                />
              </label>
              <button
                type="submit"
                disabled={uploadPending}
                className="flex min-h-12 items-center gap-1.5 rounded-xl border border-green-300 bg-green-50 px-4 text-base font-medium text-green-800 transition-colors hover:bg-green-100 disabled:opacity-60"
              >
                {uploadPending ? "Salvando..." : "Salvar assinado"}
              </button>
            </div>
            <Message state={uploadState} />
          </form>
          <div className="flex flex-wrap gap-2">
            {podeSincronizar && (
              <form action={sincAction}>
                <button
                  type="submit"
                  disabled={sincPending}
                  className="flex min-h-11 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60"
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  {sincPending ? "Sincronizando..." : "Sincronizar assinatura"}
                </button>
              </form>
            )}
            <form action={marcarAction}>
              <button
                type="submit"
                disabled={marcarPending}
                className="flex min-h-11 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60"
              >
                <CheckCircle2 size={16} aria-hidden="true" />
                {marcarPending ? "Marcando..." : "Marcar assinado"}
              </button>
            </form>
            {contrato.status !== "cancelado" && (
              <form action={cancelAction}>
                <button
                  type="submit"
                  disabled={cancelPending}
                  className="flex min-h-11 items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3.5 text-base font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
                >
                  <X size={16} aria-hidden="true" />
                  {cancelPending ? "Cancelando..." : "Cancelar"}
                </button>
              </form>
            )}
          </div>
          <Message state={sincState} />
          <Message state={marcarState} />
          <Message state={cancelState} />
        </div>
      )}
    </article>
  );
}
