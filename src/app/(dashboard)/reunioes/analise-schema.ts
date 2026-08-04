// src/app/(dashboard)/reunioes/analise-schema.ts
// Validates the AI's full meeting analysis (untrusted external output, the
// same boundary discipline as demandas/extrair/extraction-schema.ts). One
// AI call produces every destination in one envelope:
//   ata        — structured minutes (titulo, data, horario, participantes,
//                pontos_principais, deliberacoes, resumo);
//   demandas   — NEW demandas from deliberations (reuses the extrair
//                shape verbatim so the same review conventions apply);
//   atualizacoes — mentions of EXISTING demandas ("atualizar demanda X")
//                that become comments on the matching demanda
//                (user decision 2026-08-04: comment, never field edit);
//   dips       — DIP mentions, one record per mention (localidade, pais,
//                data, participantes, observacoes).
import { z } from "zod";
import { extractionResponseSchema } from "../demandas/extrair/extraction-schema";

const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const dataRegex = /^\d{4}-\d{2}-\d{2}$/;

export const ataAnaliseSchema = z.object({
  ata: z.object({
    titulo: z.string().trim().min(1).max(200),
    // data may be missing ("hoje" is used server-side as fallback).
    data: z
      .string()
      .regex(dataRegex, "data deve ser yyyy-MM-dd")
      .optional()
      .or(z.literal("")),
    horario: z
      .string()
      .regex(horaRegex, "horario deve ser HH:mm")
      .optional()
      .or(z.literal("")),
    participantes: z.array(z.string().trim().min(1).max(200)).max(200),
    pontos_principais: z.array(z.string().trim().min(1).max(2000)).max(50),
    deliberacoes: z.array(z.string().trim().min(1).max(2000)).max(100),
    resumo: z.string().trim().min(1).max(10000),
  }),
  demandas: extractionResponseSchema,
  atualizacoes: z
    .array(
      z.object({
        titulo: z.string().trim().min(1).max(300),
        comentario: z.string().trim().min(1).max(3000),
      })
    )
    .max(50),
  dips: z
    .array(
      z.object({
        localidade: z.string().trim().min(1).max(200),
        pais: z.string().trim().min(1).max(100),
        data: z
          .string()
          .regex(dataRegex, "data_dip deve ser yyyy-MM-dd")
          .optional()
          .or(z.literal("")),
        participantes: z
          .union([z.number().int().nonnegative(), z.literal("")])
          .optional(),
        observacoes: z.string().trim().max(3000).optional().or(z.literal("")),
      })
    )
    .max(100),
});

export type AtaAnalise = z.infer<typeof ataAnaliseSchema>;
export type AtaAnaliseDemanda = AtaAnalise["demandas"][number];
export type AtaAnaliseAtualizacao = AtaAnalise["atualizacoes"][number];
export type AtaAnaliseDip = AtaAnalise["dips"][number];

// Envelope for JSON-mode (DeepSeek/Zen requires a top-level object).
export const ataAnaliseEnvelopeSchema = z.object({
  analise: ataAnaliseSchema,
});

// The saved analysis's flowable form: demandas carry the resolved
// responsavel id (or null) and the human-approved prazo; dips keep their
// fields; atualizacoes carry the target demanda id resolved at save time.
export type AtaSalvarDemanda = {
  titulo: string;
  responsavelId: string | null;
  prazo: string | null;
};

export type AtaSalvarAtualizacao = {
  titulo: string;
  comentario: string;
  demandaId: number | null;
};

export type AtaSalvarDip = {
  localidade: string;
  pais: string;
  data: string | null;
  participantes: number | null;
  observacoes: string;
};
