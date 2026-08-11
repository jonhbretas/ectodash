// src/lib/audit-labels.ts
// Rótulos pt-BR e ícones para o log de ações (migração 0059_audit_log.sql).
// A tabela guarda o nome cru da tabela auditada em audit_log.entidade; a
// tela só traduz — nunca o banco. O filtro de entidade usa exatamente estes
// valores, então ENTIDADES_AUDITADAS deve permanecer espelhado na migração.
import { PencilLine, PlusCircle, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AcaoAudit = "INSERT" | "UPDATE" | "DELETE";

export const ENTIDADES_AUDITADAS: { valor: string; label: string }[] = [
  { valor: "demandas", label: "Demandas" },
  { valor: "demanda_responsaveis", label: "Responsáveis de demandas" },
  { valor: "demanda_comentarios", label: "Comentários de demandas" },
  { valor: "demanda_checklist", label: "Checklists de demandas" },
  { valor: "voluntarios", label: "Voluntários" },
  { valor: "voluntario_areas", label: "Áreas de voluntários" },
  { valor: "eventos", label: "Eventos" },
  { valor: "reunioes", label: "Reuniões" },
  { valor: "ata_participantes", label: "Participantes de atas" },
  { valor: "areas_institucionais", label: "Áreas institucionais" },
  { valor: "lider_areas", label: "Lideranças de áreas" },
  { valor: "contratos", label: "Contratos" },
  { valor: "utilidades_itens", label: "Utilidades" },
  { valor: "proep_students", label: "Estudantes PROEP" },
  { valor: "profiles", label: "Perfis de usuários" },
];

const LABEL_POR_ENTIDADE = new Map(
  ENTIDADES_AUDITADAS.map((e) => [e.valor, e.label])
);

export function auditEntidadeLabel(entidade: string): string {
  return LABEL_POR_ENTIDADE.get(entidade) ?? entidade;
}

export const ACAO_AUDIT_CONFIG: Record<
  AcaoAudit,
  { label: string; verbo: string; Icon: LucideIcon; className: string }
> = {
  INSERT: {
    label: "Criou",
    verbo: "criou",
    Icon: PlusCircle,
    className: "text-green-700",
  },
  UPDATE: {
    label: "Alterou",
    verbo: "alterou",
    Icon: PencilLine,
    className: "text-[#2195B9]",
  },
  DELETE: {
    label: "Removeu",
    verbo: "removeu",
    Icon: Trash2,
    className: "text-red-700",
  },
};

export function auditAcaoLabel(acao: string): string {
  return ACAO_AUDIT_CONFIG[acao as AcaoAudit]?.label ?? acao;
}
