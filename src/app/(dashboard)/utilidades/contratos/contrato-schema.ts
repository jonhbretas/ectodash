// src/app/(dashboard)/utilidades/contratos/contrato-schema.ts
// Schema compartilhado entre o formulário de novo contrato e a server action
// (mesmo padrão do módulo de demandas). IDs chegam como string do FormData
// (hidden inputs) e são validados por regex antes de converter.

import { z } from "zod";

const idString = z.string().regex(/^\d+$/, "Selecione uma opção válida");

export const contratoSchema = z.object({
  modeloId: idString,
  eventoId: z.string().optional(),
  alunoNome: z.string().trim().min(3, "Informe o nome completo do aluno"),
  alunoEmail: z
    .string()
    .trim()
    .email("E-mail inválido")
    .or(z.literal(""))
    .optional(),
  alunoDocumento: z.string().trim().optional(),
  alunoTelefone: z.string().trim().optional(),
  valor: z.string().trim().optional(),
});

export type ContratoFormValues = z.infer<typeof contratoSchema>;

export const contratoModeloSchema = z.object({
  titulo: z.string().trim().min(3, "Informe o título do modelo"),
  categoria: z.enum(["curso", "evento", "cessao_imagem", "consentimento", "outro"]),
  descricao: z.string().trim().optional(),
  conteudo: z
    .string()
    .trim()
    .min(20, "O texto do modelo está muito curto para um contrato"),
});

export type ContratoModeloFormValues = z.infer<typeof contratoModeloSchema>;
