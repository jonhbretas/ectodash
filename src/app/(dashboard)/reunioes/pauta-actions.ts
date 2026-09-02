"use server";

// Pauta server actions — "pedir pauta" and the small lifecycle controls
// (mark discussed / stand by / reopen / delete). Every write goes through the
// pautas table's own RLS (0076): any authenticated volunteer can insert a
// pauta (self-authored), only the creator or a coordenador_geral can update
// or delete it. These actions are the UX layer; RLS is the real boundary.
//
// "Discutida" auto-resolves the ata by looking up the reuniao whose
// data_reuniao matches the next Tuesday (proximaTerca). The dropdown was
// removed — pauta always lands in the next meeting. Use "em espera" to
// defer to a later meeting.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { proximaTerca } from "@/lib/proxima-reuniao";

export type CriarPautaState = {
  ok: boolean;
  message: string;
};

export type ReuniaoDisponivel = {
  id: number;
  titulo: string;
  data_reuniao: string;
  horario: string | null;
};

/**
 * Retorna as próximas reuniões (atas já criadas) disponíveis para vincular
 * uma pauta. Mostra apenas reuniões futuras (ou de hoje) com data >= hoje em BRT.
 */
export async function listarReunioesDisponiveis(): Promise<ReuniaoDisponivel[]> {
  const supabase = await createClient();

  // Data de hoje em BRT (YYYY-MM-DD)
  const hojeStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const { data, error } = await supabase
    .from("reunioes")
    .select("id, titulo, data_reuniao, horario")
    .gte("data_reuniao", hojeStr)
    .order("data_reuniao", { ascending: true })
    .limit(12);

  if (error) {
    console.error("listarReunioesDisponiveis: query failed", error);
    return [];
  }

  return data ?? [];
}

const criarPautaSchema = z.object({
  titulo: z.string().trim().min(1, "Descreva o assunto da pauta.").max(200),
  contexto: z.string().trim().max(3000).optional().or(z.literal("")),
  ata_id: z.number().int().positive().optional(),
  data_solicitada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  horario_solicitado: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  reuniao_selecionada_id: z.number().int().positive().optional(),
});

export async function criarPauta(
  prevState: CriarPautaState,
  formData: FormData
): Promise<CriarPautaState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada. Faça login novamente." };
  }

  const rawReuniao = formData.get("reuniao_selecionada_id");
  const isEspera = String(rawReuniao ?? "").trim() === "espera";
  const reuniaoIdNum = !isEspera && rawReuniao && String(rawReuniao).trim() !== "" ? Number(rawReuniao) : undefined;
  const parsed = criarPautaSchema.safeParse({
    titulo: formData.get("titulo"),
    contexto: formData.get("contexto"),
    ata_id: formData.get("ata_id") ? Number(formData.get("ata_id")) : undefined,
    data_solicitada: formData.get("data_solicitada") ?? "",
    horario_solicitado: formData.get("horario_solicitado") ?? "",
    reuniao_selecionada_id: reuniaoIdNum,
  });

  if (!parsed.success) {
    return { ok: false, message: "Descreva o assunto da pauta." };
  }

  // criado_por is never set from client input — the column default derives
  // it from the session (same anti-spoofing discipline as createDemanda).
  const { error } = await supabase.from("pautas").insert({
    titulo: parsed.data.titulo,
    contexto: parsed.data.contexto || null,
    origem: "manual",
    status: "pendente",
    stand_by: isEspera,
    ata_id: parsed.data.ata_id ?? null,
    data_solicitada: parsed.data.data_solicitada || null,
    horario_solicitado: parsed.data.horario_solicitado || null,
    reuniao_selecionada_id: parsed.data.reuniao_selecionada_id ?? null,
  });

  if (error) {
    console.error("criarPauta: insert failed", error);
    return {
      ok: false,
      message: "Não foi possível pedir a pauta agora. Tente novamente.",
    };
  }

  revalidatePath("/reunioes");
  revalidatePath("/reunioes/pautas");
  revalidatePath("/reunioes/atas");
  if (isEspera) {
    return { ok: true, message: "Pauta enviada. Ela aparece em \"Em espera\" até o coordenador incluí-la." };
  }
  return { ok: true, message: "Pauta adicionada para a próxima reunião." };
}

export type PautaAcaoResult = { ok: boolean; message?: string };

export async function marcarPautaDiscutida(
  pautaId: number,
  ataId?: number,
  dataReuniao?: string
): Promise<PautaAcaoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const id = Number(pautaId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Pauta inválida." };
  }

  let aId = Number(ataId);

  // Se ataId não foi informado, mas dataReuniao foi, buscar ou criar a reuniao
  if ((!Number.isInteger(aId) || aId <= 0) && dataReuniao) {
    const { data: existente } = await supabase
      .from("reunioes")
      .select("id")
      .eq("data_reuniao", dataReuniao)
      .maybeSingle();

    if (existente) {
      aId = existente.id;
    } else {
      // Criar uma ata automática para esta data
      const { data: novaAta, error: erroAta } = await supabase
        .from("reunioes")
        .insert({
          titulo: `Reunião ${dataReuniao.split("-").reverse().join("/")}`,
          data_reuniao: dataReuniao,
        })
        .select("id")
        .single();

      if (erroAta || !novaAta) {
        console.error("marcarPautaDiscutida: auto-create ata failed", erroAta);
        return { ok: false, message: "Não foi possível criar a ata para esta data." };
      }
      aId = novaAta.id;
    }
  }

  // Auto-resolve: find the ata for the next Tuesday's meeting (BRT).
  if (!Number.isInteger(aId) || aId <= 0) {
    const proxima = proximaTerca();
    // Formata em BRT para evitar bug de UTC
    const dataStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(proxima);
    const { data: reuniao } = await supabase
      .from("reunioes")
      .select("id")
      .eq("data_reuniao", dataStr)
      .maybeSingle();
    if (!reuniao) {
      return {
        ok: false,
        message:
          "Nenhuma ata registrada para a próxima reunião. Registre a ata primeiro.",
      };
    }
    aId = reuniao.id;
  }

  // status = 'discutida' e o vínculo com a ata andam juntos (CHECK 0077).
  const { error } = await supabase
    .from("pautas")
    .update({ status: "discutida", ata_discutida_id: aId })
    .eq("id", id);

  if (error) {
    console.error("marcarPautaDiscutida: update failed", error);
    return { ok: false, message: "Não foi possível atualizar a pauta." };
  }

  revalidatePath("/reunioes");
  revalidatePath(`/reunioes/${aId}`);
  return { ok: true };
}

export async function reabrirPauta(pautaId: number): Promise<PautaAcaoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const id = Number(pautaId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Pauta inválida." };
  }

  const { error } = await supabase
    .from("pautas")
    .update({ status: "pendente", ata_discutida_id: null })
    .eq("id", id);

  if (error) {
    console.error("reabrirPauta: update failed", error);
    return { ok: false, message: "Não foi possível reabrir a pauta." };
  }

  revalidatePath("/reunioes");
  return { ok: true };
}

export async function emEspera(pautaId: number): Promise<PautaAcaoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const id = Number(pautaId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Pauta inválida." };
  }

  const { error } = await supabase
    .from("pautas")
    .update({ stand_by: true })
    .eq("id", id);

  if (error) {
    console.error("emEspera: update failed", error);
    return { ok: false, message: "Não foi possível colocar em espera." };
  }

  revalidatePath("/reunioes");
  return { ok: true };
}

export async function retomarPauta(pautaId: number): Promise<PautaAcaoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const id = Number(pautaId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Pauta inválida." };
  }

  const { error } = await supabase
    .from("pautas")
    .update({ stand_by: false })
    .eq("id", id);

  if (error) {
    console.error("retomarPauta: update failed", error);
    return { ok: false, message: "Não foi possível retomar a pauta." };
  }

  revalidatePath("/reunioes");
  return { ok: true };
}

/** Mover uma pauta para outra ata (reunião). */
export async function moverPauta(
  pautaId: number,
  ataId: number | null
): Promise<PautaAcaoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const id = Number(pautaId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Pauta inválida." };
  }

  const { error } = await supabase
    .from("pautas")
    .update({ ata_id: ataId || null })
    .eq("id", id);

  if (error) {
    console.error("moverPauta: update failed", error);
    return { ok: false, message: "Não foi possível mover a pauta." };
  }

  revalidatePath("/reunioes");
  return { ok: true };
}

export async function excluirPauta(pautaId: number): Promise<PautaAcaoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const id = Number(pautaId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Pauta inválida." };
  }

  const { error } = await supabase.from("pautas").delete().eq("id", id);
  if (error) {
    console.error("excluirPauta: delete failed", error);
    return { ok: false, message: "Não foi possível excluir a pauta." };
  }

  revalidatePath("/reunioes");
  return { ok: true };
}
