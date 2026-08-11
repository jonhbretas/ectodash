"use client";

// Dialog de detalhes de uma linha do log de ações — mostra o diff
// antes/depois calculado client-side a partir dos jsonb gravados pelo
// trigger (migração 0059). Só renderiza campos que mudaram (UPDATE), todos
// os do registro novo (INSERT) ou do removido (DELETE).
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye } from "lucide-react";
import {
  ACAO_AUDIT_CONFIG,
  auditEntidadeLabel,
} from "@/lib/audit-labels";
import type { AcaoAudit } from "@/lib/audit-labels";

export type LogAcoesDetailsProps = {
  acao: AcaoAudit;
  entidade: string;
  entidadeId: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  createdAt: string;
  usuario: string;
};

const CAMPOS_IGNORADOS = new Set([
  "id",
  "created_at",
  "updated_at",
  "criado_por",
]);

type CampoDiff = { nome: string; antes: string; depois: string };

function formatValor(valor: unknown): string {
  if (valor === null || valor === undefined) return "—";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

function calcularDiff(
  acao: AcaoAudit,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): CampoDiff[] {
  if (acao === "INSERT") {
    return Object.entries(after ?? {})
      .filter(([nome]) => !CAMPOS_IGNORADOS.has(nome))
      .map(([nome, valor]) => ({ nome, antes: "—", depois: formatValor(valor) }));
  }

  if (acao === "DELETE") {
    return Object.entries(before ?? {})
      .filter(([nome]) => !CAMPOS_IGNORADOS.has(nome))
      .map(([nome, valor]) => ({ nome, antes: formatValor(valor), depois: "—" }));
  }

  const nomes = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  const diff: CampoDiff[] = [];
  for (const nome of nomes) {
    if (CAMPOS_IGNORADOS.has(nome)) continue;
    const antes = before?.[nome];
    const depois = after?.[nome];
    if (JSON.stringify(antes) === JSON.stringify(depois)) continue;
    diff.push({ nome, antes: formatValor(antes), depois: formatValor(depois) });
  }
  return diff;
}

export default function LogAcoesDetails(props: LogAcoesDetailsProps) {
  const [open, setOpen] = useState(false);
  const diff = calcularDiff(props.acao, props.beforeData, props.afterData);
  const { label } = ACAO_AUDIT_CONFIG[props.acao];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Ver detalhes da ação ${label} em ${auditEntidadeLabel(props.entidade)}`}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-700 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          <Eye size={18} aria-hidden="true" />
          Detalhes
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {label} {auditEntidadeLabel(props.entidade)}
            {props.entidadeId ? ` #${props.entidadeId}` : ""}
          </DialogTitle>
          <DialogDescription>
            {props.usuario} ·{" "}
            {format(new Date(props.createdAt), "dd/MM/yyyy 'às' HH:mm", {
              locale: ptBR,
            })}
          </DialogDescription>
        </DialogHeader>

        {diff.length === 0 ? (
          <p className="text-base text-zinc-600">
            Nenhuma alteração de dados registrada nesta ação.
          </p>
        ) : (
          <div className="flex max-h-[50vh] flex-col overflow-y-auto rounded-xl ring-1 ring-zinc-200/60">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-600">
                    Campo
                  </th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-600">
                    Antes
                  </th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-zinc-600">
                    Depois
                  </th>
                </tr>
              </thead>
              <tbody>
                {diff.map((campo) => (
                  <tr
                    key={campo.nome}
                    className="border-t border-zinc-200 align-top"
                  >
                    <td className="px-3 py-2 text-sm font-medium text-zinc-800">
                      {campo.nome}
                    </td>
                    <td className="px-3 py-2 text-sm break-words text-zinc-600">
                      {campo.antes}
                    </td>
                    <td className="px-3 py-2 text-sm break-words text-zinc-900">
                      {campo.depois}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
