// src/app/(dashboard)/financeiro/propostas/proposta-schema.ts
// Contrato compartilhado da tela de Propostas financeiras com foco no
// ALUNO (cursos/eventos/atividades da Ectolab): rótulos, validação zod
// (mesmo padrão de contrato-schema.ts) e tipos usados pela page
// (server), pelo form (client) e pelas server actions.
import { z } from "zod";

export const METODOS = [
  "pix",
  "transferencia",
  "boleto",
  "cartao_credito",
  "cartao_debito",
  "dinheiro",
  "outro",
] as const;

export const STATUS = ["pendente", "pago", "cancelado"] as const;

export const METODO_LABELS: Record<(typeof METODOS)[number], string> = {
  pix: "Pix",
  transferencia: "Transferência",
  boleto: "Boleto",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

export const STATUS_LABELS: Record<(typeof STATUS)[number], string> = {
  pendente: "Pendente",
  pago: "Pago",
  cancelado: "Cancelado",
};

const sheetUrl = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v === "" ? undefined : v))
  .refine(
    (v) =>
      v === undefined || v.startsWith("https://docs.google.com/spreadsheets/"),
    "Cole o link da planilha do Google (https://docs.google.com/spreadsheets/…)"
  );

export const propostaSchema = z.object({
  id: z.string().regex(/^\d+$/, "Proposta inválida").optional(),
  aluno_nome: z.string().trim().min(3, "Informe o nome do aluno").max(200),
  aluno_email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .refine((v) => v === undefined || /.+@.+\..+/.test(v), "E-mail inválido"),
  curso_atividade: z
    .string()
    .trim()
    .min(3, "Informe o curso, evento ou atividade")
    .max(200),
  evento_id: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .refine((v) => v === undefined || /^\d+$/.test(v), "Evento inválido"),
  descricao: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  valor: z
    .string()
    .trim()
    .min(1, "Informe o valor")
    .refine((v) => {
      const n = Number(v.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) && n >= 0;
    }, "Valor inválido — use números (ex.: 1.234,56)"),
  metodo: z.enum(METODOS, { message: "Escolha o método de pagamento" }),
  prazo: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .refine(
      (v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v),
      "Prazo inválido"
    ),
  status: z.enum(STATUS).optional(),
  sheet_url: sheetUrl,
  observacoes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

export type PropostaFormValues = z.infer<typeof propostaSchema>;

export type Proposta = {
  id: number;
  titulo: string;
  aluno_nome: string;
  aluno_email: string | null;
  curso_atividade: string;
  evento_id: number | null;
  evento_titulo: string | null;
  descricao: string | null;
  valor: number;
  metodo: (typeof METODOS)[number];
  prazo: string | null;
  status: (typeof STATUS)[number];
  pago_em: string | null;
  sheet_url: string | null;
  observacoes: string | null;
  origem: "sistema" | "planilha";
  sincronizado_em: string | null;
};

export type AlunoSugestao = { nome: string; email: string };
export type EventoOpcao = { id: number; titulo: string };

/** "1.234,56" → 1234.56 */
export function brlParaNumero(raw: string): number {
  return Number(raw.replace(/\./g, "").replace(",", "."));
}

/** Hoje em "AAAA-MM-DD" (horário local) para comparar com prazo. */
export function hojeISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

/** Atrasada = pendente com prazo anterior a hoje (derivado, não gravado). */
export function estaAtrasada(p: Pick<Proposta, "status" | "prazo">): boolean {
  return p.status === "pendente" && p.prazo !== null && p.prazo < hojeISO();
}

/** Título exibido/legado: "Curso — Aluno" (máx. 200). */
export function gerarTitulo(curso: string, aluno: string): string {
  return `${curso} — ${aluno}`.slice(0, 200);
}
