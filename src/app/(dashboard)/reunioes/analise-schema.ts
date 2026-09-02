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
//   eventos    — events mentioned in the meeting (titulo, data, local,
//                descricao) that should be created/catalogued;
//   dips       — DIP mentions, one record per mention (localidade, pais,
//                data, participantes, observacoes);
//   pautas     — agenda topics deferred to the NEXT meeting ("vamos falar
//                semana que vem sobre X"), one record per topic, that feed
//                the Reuniões hub's pauta list.
import { z } from "zod";

const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const dataRegex = /^\d{4}-\d{2}-\d{2}$/;

// Demanda suggestion from the ata analysis: the extrair fields (titulo,
// responsavel_texto, prazo_*) plus the contextual dimensions the AI must
// always identify for navigation — area, projeto and the related event.
// All three are free text from the transcript; the review screen resolves
// them into selects/datalists and the save maps evento_texto to an
// evento_id (existing or created in the same analysis).
const ataDemandaSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  responsavel_texto: z.string().trim().max(200),
  prazo_texto: z.string().trim().max(200),
  prazo_sugerido: z
    .string()
    .regex(dataRegex, "prazo_sugerido deve ser yyyy-MM-dd")
    .optional()
    .or(z.literal("")),
  area_texto: z.string().trim().max(200).optional().or(z.literal("")),
  projeto_texto: z.string().trim().max(200).optional().or(z.literal("")),
  evento_texto: z.string().trim().max(200).optional().or(z.literal("")),
  etiqueta_texto: z.string().trim().max(200).optional().or(z.literal("")),
});

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
  demandas: z.array(ataDemandaSchema).max(50),
  eventos: z
    .array(
      z.object({
        titulo: z.string().trim().min(1).max(200),
        data: z
          .string()
          .regex(dataRegex, "data deve ser yyyy-MM-dd")
          .optional()
          .or(z.literal("")),
        local: z.string().trim().max(300).optional().or(z.literal("")),
        descricao: z.string().trim().max(3000).optional().or(z.literal("")),
      })
    )
    .max(50),
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
  pautas: z
    .array(
      z.object({
        titulo: z.string().trim().min(1).max(200),
        contexto: z.string().trim().max(3000).optional().or(z.literal("")),
      })
    )
    .max(50),
});

export type AtaAnalise = z.infer<typeof ataAnaliseSchema>;
export type AtaAnaliseDemanda = AtaAnalise["demandas"][number];
export type AtaAnaliseEvento = AtaAnalise["eventos"][number];
export type AtaAnaliseAtualizacao = AtaAnalise["atualizacoes"][number];
export type AtaAnaliseDip = AtaAnalise["dips"][number];
export type AtaAnalisePauta = AtaAnalise["pautas"][number];

// Envelope for JSON-mode (Muse Spark/Zen requires a top-level object).
export const ataAnaliseEnvelopeSchema = z.object({
  analise: ataAnaliseSchema,
});

// The saved analysis's flowable form: demandas carry the resolved
// responsavel id (or null) and the human-approved prazo; dips keep their
// fields; atualizacoes carry the target demanda id resolved at save time.
// area/projeto are the review-approved free texts; eventoRef is one of
// "" (nenhum), "novo:<index>" (evento criado nesta análise) or
// "existente:<id>" (evento já cadastrado) — resolved to evento_id at save.
export type AtaSalvarDemanda = {
  titulo: string;
  responsavelId: string | null;
  prazo: string | null;
  area: string | null;
  projeto: string | null;
  eventoRef: string | null;
  etiquetaId: number | null;
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

export type AtaSalvarEvento = {
  titulo: string;
  data: string | null;
  local: string | null;
  descricao: string | null;
};

export type AtaSalvarPauta = {
  titulo: string;
  contexto: string | null;
};
