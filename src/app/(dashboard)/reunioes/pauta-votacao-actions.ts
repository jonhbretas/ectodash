"use server";

// Votação prévia das pautas deliberativas. A autorização real vive no banco
// (RLS de pauta_votos + funções encerrar/reabrir_votacao_pauta, migration
// 20261021150000); estas actions são a camada de UX e mensagens.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { PautaAcaoResult } from "./pauta-actions";

const votoSchema = z.object({
  pautaId: z.number().int().positive(),
  voto: z.enum(["aprovar", "rejeitar", "abster"]),
  comentario: z.string().trim().max(500).optional(),
});

const pautaIdSchema = z.number().int().positive();

export async function votarPauta(
  pautaId: number,
  voto: "aprovar" | "rejeitar" | "abster",
  comentario?: string
): Promise<PautaAcaoResult> {
  const parsed = votoSchema.safeParse({ pautaId, voto, comentario });
  if (!parsed.success) {
    return { ok: false, message: "Voto inválido. Confira a escolha e o comentário (até 500 letras)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada. Faça login novamente." };

  const { error } = await supabase.from("pauta_votos").upsert(
    {
      pauta_id: parsed.data.pautaId,
      user_id: user.id,
      voto: parsed.data.voto,
      comentario: parsed.data.comentario || null,
    },
    { onConflict: "pauta_id,user_id" }
  );

  if (error) {
    console.error("votarPauta: upsert failed", error);
    if (error.code === "42501" || error.code === "23503") {
      return { ok: false, message: "A votação desta pauta não está aberta." };
    }
    return { ok: false, message: "Não foi possível registrar seu voto agora. Tente novamente." };
  }

  revalidatePath("/reunioes");
  return { ok: true, message: "Voto registrado." };
}

export async function removerVoto(pautaId: number): Promise<PautaAcaoResult> {
  const parsed = pautaIdSchema.safeParse(pautaId);
  if (!parsed.success) return { ok: false, message: "Pauta inválida." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada. Faça login novamente." };

  const { data, error } = await supabase
    .from("pauta_votos")
    .delete()
    .eq("pauta_id", parsed.data)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    console.error("removerVoto: delete failed", error);
    return { ok: false, message: "Não foi possível retirar seu voto agora. Tente novamente." };
  }
  if (!data || data.length === 0) {
    return { ok: false, message: "A votação desta pauta não está aberta." };
  }

  revalidatePath("/reunioes");
  return { ok: true, message: "Voto retirado." };
}

export async function encerrarVotacao(pautaId: number): Promise<PautaAcaoResult> {
  const parsed = pautaIdSchema.safeParse(pautaId);
  if (!parsed.success) return { ok: false, message: "Pauta inválida." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada. Faça login novamente." };

  const { data, error } = await supabase.rpc("encerrar_votacao_pauta", {
    p_pauta_id: parsed.data,
  });

  if (error) {
    console.error("encerrarVotacao: rpc failed", error);
    if (error.code === "42501") {
      return { ok: false, message: "Somente a coordenação geral pode encerrar a votação." };
    }
    return { ok: false, message: "Não foi possível encerrar a votação agora." };
  }

  revalidatePath("/reunioes");
  const resultado = String(data);
  if (resultado === "aprovada") return { ok: true, message: "Votação encerrada: aprovada previamente." };
  if (resultado === "rejeitada") return { ok: true, message: "Votação encerrada: rejeitada." };
  return { ok: true, message: "Votação encerrada: sem quórum." };
}

export async function reabrirVotacao(pautaId: number): Promise<PautaAcaoResult> {
  const parsed = pautaIdSchema.safeParse(pautaId);
  if (!parsed.success) return { ok: false, message: "Pauta inválida." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada. Faça login novamente." };

  const { error } = await supabase.rpc("reabrir_votacao_pauta", {
    p_pauta_id: parsed.data,
  });

  if (error) {
    console.error("reabrirVotacao: rpc failed", error);
    if (error.code === "42501") {
      return { ok: false, message: "Somente a coordenação geral pode reabrir a votação." };
    }
    return { ok: false, message: "Não foi possível reabrir a votação agora." };
  }

  revalidatePath("/reunioes");
  return { ok: true, message: "Votação reaberta." };
}
