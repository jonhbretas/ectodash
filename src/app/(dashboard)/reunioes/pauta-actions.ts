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
import {
  proximaTerca,
  proximaTercaISO,
  hojeBRTISO,
  formatarDataISO,
  HORARIO_REUNIAO,
} from "@/lib/proxima-reuniao";
import { pautasSimilares } from "@/lib/pautas/regras";
import { trashDriveFile } from "@/lib/google/drive";

export type CriarPautaState = {
  ok: boolean;
  message: string;
  /** Id da pauta criada (usado pelo wizard para anexar o arquivo em seguida). */
  pautaId?: number;
};

export type ReuniaoDisponivel = {
  id: number;
  titulo: string;
  data_reuniao: string;
  horario: string | null;
  status: string | null;
};

/**
 * Retorna as próximas reuniões (atas já criadas) disponíveis para vincular
 * uma pauta. Mostra apenas reuniões futuras (ou de hoje) com data >= hoje em BRT.
 */
export async function listarReunioesDisponiveis(): Promise<ReuniaoDisponivel[]> {
  const supabase = await createClient();

  // Hoje em BRT direto via Intl (sem Date intermediário — ver proxima-reuniao.ts).
  const hojeStr = hojeBRTISO();

  const { data, error } = await supabase
    .from("reunioes")
    .select("id, titulo, data_reuniao, horario, status")
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
  prioridade: z.enum(["baixa", "media", "alta"]).default("media"),
  tipo: z.enum(["informativa", "deliberativa"]).default("informativa"),
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
    prioridade: formData.get("prioridade") || undefined,
    tipo: formData.get("tipo") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: "Descreva o assunto da pauta." };
  }

  // Reunião-alvo: terça 19h. Pedidos até 19h de terça valem para hoje;
  // após 19h, proximaTerca() já rola para a terça seguinte. A REUNIÃO existe
  // antes da ata: quando o usuário deixou "Próxima reunião (padrão)",
  // garantimos a linha da reunião-alvo — vincula se já existir, senão cria
  // como "agendada" (sem ata; a ata é preenchida depois que ela acontece).
  // A pauta nunca fica sem vínculo por falta de ata.
  // IMPORTANTE: alvoStr via formatarDataISO (nunca via Intl no Date da
  // proximaTerca — no servidor UTC o Intl voltava um dia: 15/09 virava 14/09).
  const proxima = proximaTerca();
  const alvoStr = formatarDataISO(proxima);
  let reuniaoAlvoId: number | null = parsed.data.reuniao_selecionada_id ?? null;
  if (!isEspera && reuniaoAlvoId === null) {
    const { data: reuniaoAlvo } = await supabase
      .from("reunioes")
      .select("id")
      .eq("data_reuniao", alvoStr)
      .limit(1)
      .maybeSingle();
    if (reuniaoAlvo) {
      reuniaoAlvoId = reuniaoAlvo.id;
    } else {
      const { data: novaReuniao } = await supabase
        .from("reunioes")
        .insert({
          titulo: `Reunião ${alvoStr.split("-").reverse().join("/")}`,
          data_reuniao: alvoStr,
          horario: HORARIO_REUNIAO,
          status: "agendada",
        })
        .select("id")
        .single();
      if (novaReuniao) reuniaoAlvoId = novaReuniao.id;
      // Se a criação falhar (RLS/erro), segue com null = "próxima".
    }
  }

  // criado_por is never set from client input — the column default derives
  // it from the session (same anti-spoofing discipline as createDemanda).
  // votacao_status é definido pelo trigger pautas_guard_votacao (deliberativa
  // abre a votação sozinha) — nunca enviado pelo cliente.
  const { data: criada, error } = await supabase
    .from("pautas")
    .insert({
    titulo: parsed.data.titulo,
    contexto: parsed.data.contexto || null,
    origem: "manual",
    status: "pendente",
    stand_by: isEspera,
    ata_id: parsed.data.ata_id ?? null,
    data_solicitada: parsed.data.data_solicitada || null,
    horario_solicitado: parsed.data.horario_solicitado || null,
    reuniao_selecionada_id: reuniaoAlvoId,
    prioridade: parsed.data.prioridade,
    tipo: parsed.data.tipo,
  })
    .select("id")
    .single();

  if (error || !criada) {
    console.error("criarPauta: insert failed", error);
    return {
      ok: false,
      message: "Não foi possível pedir a pauta agora. Tente novamente.",
    };
  }

  revalidatePath("/reunioes");
  revalidatePath("/reunioes/pautas");
  revalidatePath("/reunioes/atas");
  const votacaoAviso = parsed.data.tipo === "deliberativa" ? " A votação prévia já está aberta." : "";
  if (isEspera) {
    return {
      ok: true,
      pautaId: criada.id,
      message: `Pauta enviada. Ela aparece em "Em espera" até o coordenador incluí-la.${votacaoAviso}`,
    };
  }
  const rotulo = formatarRotuloReuniao(proxima);
  return {
    ok: true,
    pautaId: criada.id,
    message: `Pauta adicionada para a reunião de ${rotulo}. Pedidos até terça 19h valem para hoje; após 19h vão para a próxima terça.${votacaoAviso}`,
  };
}

const DIAS_ABBR = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES_ABBR = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function formatarRotuloReuniao(date: Date): string {
  const wd = DIAS_ABBR[date.getDay()];
  const dia = String(date.getDate()).padStart(2, "0");
  const mon = MESES_ABBR[date.getMonth()];
  return `${wd}, ${dia} ${mon} · ${HORARIO_REUNIAO.replace(":", "h")}`;
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

  // Garante a linha da reunião para uma data (a REUNIÃO existe antes da
  // ata — mesmo padrão do criarPauta): vincula se já existir, senão cria
  // como "agendada". A pauta nunca falha por falta de ata.
  async function garantirReuniao(dataStr: string): Promise<number | null> {
    const { data: existente } = await supabase
      .from("reunioes")
      .select("id")
      .eq("data_reuniao", dataStr)
      .limit(1)
      .maybeSingle();
    if (existente) return existente.id;
    const { data: nova, error: erroCriacao } = await supabase
      .from("reunioes")
      .insert({
        titulo: `Reunião ${dataStr.split("-").reverse().join("/")}`,
        data_reuniao: dataStr,
        horario: HORARIO_REUNIAO,
        status: "agendada",
      })
      .select("id")
      .single();
    if (erroCriacao || !nova) {
      console.error("marcarPautaDiscutida: auto-create reuniao failed", erroCriacao);
      return null;
    }
    return nova.id;
  }

  // Se ataId não foi informado, mas dataReuniao foi, buscar ou criar a reuniao
  if ((!Number.isInteger(aId) || aId <= 0) && dataReuniao) {
    const garantida = await garantirReuniao(dataReuniao);
    if (garantida === null) {
      return { ok: false, message: "Não foi possível criar a ata para esta data." };
    }
    aId = garantida;
  }

  // Auto-resolve: ata da próxima terça (BRT). Usa formatarDataISO — nunca
  // Intl no Date da proximaTerca (bug 14/09). Se a reunião ainda não existe
  // (ex.: após o corte de terça 19h o alvo rola para a terça seguinte),
  // cria como "agendada" em vez de falhar — mesmo padrão do criarPauta.
  if (!Number.isInteger(aId) || aId <= 0) {
    const dataStr = proximaTercaISO();
    const garantida = await garantirReuniao(dataStr);
    if (garantida === null) {
      return {
        ok: false,
        message:
          "Nenhuma ata registrada para a próxima reunião. Registre a ata primeiro.",
      };
    }
    aId = garantida;
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

  const { data: atual } = await supabase
    .from("pautas")
    .select("anexo_drive_id")
    .eq("id", id)
    .maybeSingle();

  const { data: removidas, error } = await supabase
    .from("pautas")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) {
    console.error("excluirPauta: delete failed", error);
    return { ok: false, message: "Não foi possível excluir a pauta." };
  }

  // Anexo no Drive vai para a lixeira (best-effort: nunca falha a exclusão).
  const anexoId = atual?.anexo_drive_id as string | null | undefined;
  if (removidas && removidas.length > 0 && anexoId) {
    try {
      await trashDriveFile(anexoId);
    } catch (e) {
      console.error("excluirPauta: trash anexo failed", e);
    }
  }

  revalidatePath("/reunioes");
  return { ok: true };
}

export type PautaSimilar = { id: number; titulo: string; emEspera: boolean };

/**
 * Aviso leve de duplicidade (AGENTS.md): lista pautas pendentes parecidas com
 * o título digitado. Apenas informativo — nunca bloqueia o envio.
 */
export async function buscarPautasSimilares(titulo: string): Promise<PautaSimilar[]> {
  const texto = String(titulo ?? "").trim();
  if (texto.length < 4) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("pautas")
    .select("id, titulo, stand_by")
    .eq("status", "pendente")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) {
    if (error) console.error("buscarPautasSimilares: query failed", error);
    return [];
  }

  const mapa = new Map(data.map((p) => [p.id as number, Boolean(p.stand_by)]));
  return pautasSimilares(
    texto,
    data.map((p) => ({ id: p.id as number, titulo: String(p.titulo) }))
  ).map((p) => ({ id: p.id, titulo: p.titulo, emEspera: mapa.get(p.id) ?? false }));
}
