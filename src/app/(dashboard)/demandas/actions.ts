"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  resolverDestinosVoluntario,
  voluntarioIdDoDestino,
  voluntarioIdsDosDestinos,
} from "@/lib/destinos-voluntario";
import { demandaSchema, eventoIdSchema, etiquetaIdSchema, idsNumericos } from "./demanda-schema";
import { chatCompletion } from "@/lib/ai/ai-client";
import { matchResponsavelRoster, normalize } from "@/lib/ai/match-responsavel";

export type CreateDemandaState = {
  ok: boolean;
  message: string;
};

export async function createDemanda(
  prevState: CreateDemandaState,
  formData: FormData
): Promise<CreateDemandaState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada. Faça login novamente." };
  }

  // A native <select multiple> submits one same-named form field per
  // selected option — formData.getAll() reads all of them.
  // Object.fromEntries(formData) alone would collapse repeated keys down
  // to the last value, silently dropping every responsável but one.
  const rawArea = formData.get("area");
  const parsed = demandaSchema.safeParse({
    titulo: formData.get("titulo"),
    responsavelIds: formData.getAll("responsavelIds"),
    prazo: formData.get("prazo"),
    status: formData.get("status"),
    area: typeof rawArea === "string" && rawArea.length > 0 ? rawArea : undefined,
    projeto: formData.get("projeto") ?? undefined,
    membroIds: formData.getAll("membroIds"),
  });
  const eventoId = eventoIdSchema.safeParse(formData.get("eventoId") ?? undefined);
  const etiquetaId = etiquetaIdSchema.safeParse(
    formData.get("etiquetaId") ?? undefined
  );

  if (!parsed.success || !eventoId.success || !etiquetaId.success) {
    return { ok: false, message: "Verifique os campos destacados." };
  }

  // The authorship column is deliberately never set from client input here
  // — the column default and plan 04-01's INSERT policy WITH CHECK both
  // derive it from the authenticated session server-side, so it never
  // appears in this insert payload (RESEARCH.md Pitfall 4, anti-spoofing).
  const { data: demanda, error: demandaError } = await supabase
    .from("demandas")
    .insert({
      titulo: parsed.data.titulo,
      prazo: parsed.data.prazo,
      status: parsed.data.status,
      area: parsed.data.area,
      projeto: parsed.data.projeto,
      evento_id: eventoId.data ?? null,
      etiqueta_id: etiquetaId.data ?? null,
    })
    .select("id")
    .single();

  if (demandaError || !demanda) {
    console.error("createDemanda: insert failed", demandaError);
    return {
      ok: false,
      message:
        "Não foi possível salvar a demanda agora. Verifique sua internet e tente de novo.",
    };
  }

  // One batched insert for every selected responsável, not a loop of
  // individual inserts. Each roster id resolves to its effective
  // destination: profile_id when the volunteer has a linked account,
  // voluntario_id otherwise (migration 0020).
  const destinos = await resolverDestinosVoluntario(
    supabase,
    idsNumericos(parsed.data.responsavelIds)
  );

  const { error: responsaveisError } = await supabase
    .from("demanda_responsaveis")
    .insert(
      destinos.map((destino) => ({
        demanda_id: demanda.id,
        ...destino,
      }))
    );

  if (responsaveisError) {
    // Known tradeoff (documented in the plan and SUMMARY): Supabase JS has
    // no multi-table client transaction primitive without a custom RPC,
    // which is out of scope for this tracer. The demanda itself was
    // already created successfully, so we don't leave the user on a broken
    // screen for a partial failure — we log it and still report success.
    console.error(
      "createDemanda: demanda_responsaveis insert failed",
      responsaveisError
    );
  }

  // Membros (acompanhantes) — same batched insert, no transaction.
  if ((parsed.data.membroIds ?? []).length > 0) {
    const membrosDestinos = await resolverDestinosVoluntario(
      supabase,
      idsNumericos(parsed.data.membroIds)
    );

    const { error: membrosError } = await supabase
      .from("demanda_membros")
      .insert(
        membrosDestinos.map((destino) => ({
          demanda_id: demanda.id,
          ...destino,
        }))
      );

    if (membrosError) {
      console.error("createDemanda: demanda_membros insert failed", membrosError);
    }
  }

  revalidatePath("/");
  return { ok: true, message: "Demanda criada com sucesso." };
}

export type UpdateDemandaState = {
  ok: boolean;
  message: string;
};

// id is bound server-side via DemandaForm's `updateDemanda.bind(null, demandaId)`
// (mode="edit") — it is a function parameter, never read from `formData`,
// matching the same anti-spoofing discipline createDemanda already applies
// to the authorship column (RESEARCH.md Pitfall 4 / Code Examples comment).
export async function updateDemanda(
  id: number,
  prevState: UpdateDemandaState,
  formData: FormData
): Promise<UpdateDemandaState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada. Faça login novamente." };
  }

  const rawArea = formData.get("area");
  const parsed = demandaSchema.safeParse({
    titulo: formData.get("titulo"),
    responsavelIds: formData.getAll("responsavelIds"),
    prazo: formData.get("prazo"),
    status: formData.get("status"),
    area: typeof rawArea === "string" && rawArea.length > 0 ? rawArea : undefined,
    projeto: formData.get("projeto") ?? undefined,
    membroIds: formData.getAll("membroIds"),
  });
  const eventoId = eventoIdSchema.safeParse(formData.get("eventoId") ?? undefined);
  const etiquetaId = etiquetaIdSchema.safeParse(
    formData.get("etiquetaId") ?? undefined
  );

  if (!parsed.success || !eventoId.success || !etiquetaId.success) {
    return { ok: false, message: "Verifique os campos destacados." };
  }

  // The authorship column is deliberately absent from this update payload — it is set
  // once at creation time and never changed.
  const { error: demandaError } = await supabase
    .from("demandas")
    .update({
      titulo: parsed.data.titulo,
      prazo: parsed.data.prazo,
      status: parsed.data.status,
      area: parsed.data.area,
      projeto: parsed.data.projeto,
      evento_id: eventoId.data ?? null,
      etiqueta_id: etiquetaId.data ?? null,
    })
    .eq("id", id);

  if (demandaError) {
    console.error("updateDemanda: update failed", demandaError);
    return { ok: false, message: "Não foi possível salvar as alterações." };
  }

  // Responsável diffing: re-query the row's actual current set server-side
  // rather than trusting whatever the client last rendered as "current" —
  // the client's form state only expresses the *desired* end state
  // (T-04-12 mitigation). Both representations are normalized to roster
  // volunteer ids (profile_id rows resolve via profiles.voluntario_id), so
  // the diff is expressed in roster terms; only the real delta is written.
  const { data: currentRows, error: currentError } = await supabase
    .from("demanda_responsaveis")
    .select("profile_id, voluntario_id")
    .eq("demanda_id", id);

  if (currentError) {
    console.error(
      "updateDemanda: reading current responsaveis failed",
      currentError
    );
    return { ok: false, message: "Não foi possível salvar as alterações." };
  }

  const currentVoluntarioIds = await voluntarioIdsDosDestinos(
    supabase,
    currentRows ?? []
  );
  const currentIds = new Set(currentVoluntarioIds);
  const desiredIds = new Set(idsNumericos(parsed.data.responsavelIds));

  const idsToAdd = [...desiredIds].filter((id) => !currentIds.has(id));
  const idsToRemove = [...currentIds].filter((id) => !desiredIds.has(id));

  if (idsToAdd.length > 0) {
    const destinosParaAdicionar = await resolverDestinosVoluntario(
      supabase,
      idsToAdd
    );
    const { error: insertError } = await supabase
      .from("demanda_responsaveis")
      .insert(
        destinosParaAdicionar.map((destino) => ({
          demanda_id: id,
          ...destino,
        }))
      );

    if (insertError) {
      console.error(
        "updateDemanda: demanda_responsaveis insert failed",
        insertError
      );
      return { ok: false, message: "Não foi possível salvar as alterações." };
    }
  }

  if (idsToRemove.length > 0) {
    const { data: rowsParaRemover } = await supabase
      .from("demanda_responsaveis")
      .select("profile_id, voluntario_id")
      .eq("demanda_id", id);

    // Resolve which persisted rows belong to the removed roster ids.
    const removidos = new Set(idsToRemove);
    const perfisARemover = new Set<string>();
    const voluntariosARemover = new Set<number>();
    for (const row of rowsParaRemover ?? []) {
      const vid = await voluntarioIdDoDestino(supabase, row);
      if (vid === null || !removidos.has(vid)) continue;
      if (row.profile_id) perfisARemover.add(row.profile_id);
      if (row.voluntario_id) voluntariosARemover.add(row.voluntario_id);
    }

    if (perfisARemover.size > 0) {
      const { error: deleteError } = await supabase
        .from("demanda_responsaveis")
        .delete()
        .eq("demanda_id", id)
        .in("profile_id", [...perfisARemover]);

      if (deleteError) {
        console.error(
          "updateDemanda: demanda_responsaveis delete (profile) failed",
          deleteError
        );
        return { ok: false, message: "Não foi possível salvar as alterações." };
      }
    }

    if (voluntariosARemover.size > 0) {
      const { error: deleteError } = await supabase
        .from("demanda_responsaveis")
        .delete()
        .eq("demanda_id", id)
        .in("voluntario_id", [...voluntariosARemover]);

      if (deleteError) {
        console.error(
          "updateDemanda: demanda_responsaveis delete (voluntario) failed",
          deleteError
        );
        return { ok: false, message: "Não foi possível salvar as alterações." };
      }
    }
  }

  // Membros (acompanhantes) diffing — same shape as the responsável diff
  // above: re-read the current set server-side, apply only the delta.
  const desiredMembroIds = idsNumericos(parsed.data.membroIds);
  if (desiredMembroIds.length > 0 || true) {
    const { data: currentMembros } = await supabase
      .from("demanda_membros")
      .select("profile_id, voluntario_id")
      .eq("demanda_id", id);

    const currentMembroVoluntarioIds = await voluntarioIdsDosDestinos(
      supabase,
      currentMembros ?? []
    );
    const currentMembroIds = new Set(currentMembroVoluntarioIds);
    const desiredMembroSet = new Set(desiredMembroIds);
    const membrosToAdd = [...desiredMembroSet].filter(
      (vid) => !currentMembroIds.has(vid)
    );
    const membrosToRemove = [...currentMembroIds].filter(
      (vid) => !desiredMembroSet.has(vid)
    );

    if (membrosToAdd.length > 0) {
      const membrosDestinos = await resolverDestinosVoluntario(
        supabase,
        membrosToAdd
      );
      const { error: membrosInsertError } = await supabase
        .from("demanda_membros")
        .insert(
          membrosDestinos.map((destino) => ({
            demanda_id: id,
            ...destino,
          }))
        );
      if (membrosInsertError) {
        console.error(
          "updateDemanda: demanda_membros insert failed",
          membrosInsertError
        );
        return { ok: false, message: "Não foi possível salvar as alterações." };
      }
    }

    if (membrosToRemove.length > 0) {
      const { data: rowsMembrosARemover } = await supabase
        .from("demanda_membros")
        .select("profile_id, voluntario_id")
        .eq("demanda_id", id);

      const removidosMembros = new Set(membrosToRemove);
      const perfisMembrosARemover = new Set<string>();
      const voluntariosMembrosARemover = new Set<number>();
      for (const row of rowsMembrosARemover ?? []) {
        const vid = await voluntarioIdDoDestino(supabase, row);
        if (vid === null || !removidosMembros.has(vid)) continue;
        if (row.profile_id) perfisMembrosARemover.add(row.profile_id);
        if (row.voluntario_id) voluntariosMembrosARemover.add(row.voluntario_id);
      }

      if (perfisMembrosARemover.size > 0) {
        const { error: membrosDeleteError } = await supabase
          .from("demanda_membros")
          .delete()
          .eq("demanda_id", id)
          .in("profile_id", [...perfisMembrosARemover]);
        if (membrosDeleteError) {
          console.error(
            "updateDemanda: demanda_membros delete failed",
            membrosDeleteError
          );
          return { ok: false, message: "Não foi possível salvar as alterações." };
        }
      }

      if (voluntariosMembrosARemover.size > 0) {
        const { error: membrosDeleteError } = await supabase
          .from("demanda_membros")
          .delete()
          .eq("demanda_id", id)
          .in("voluntario_id", [...voluntariosMembrosARemover]);
        if (membrosDeleteError) {
          console.error(
            "updateDemanda: demanda_membros delete failed",
            membrosDeleteError
          );
          return { ok: false, message: "Não foi possível salvar as alterações." };
        }
      }
    }
  }

  revalidatePath("/");
  return { ok: true, message: "Demanda atualizada." };
}

export type ConcludeDemandaState = {
  ok: boolean;
  message: string;
};

// A narrower, separate action rather than a call into updateDemanda — a
// smaller, more auditable mutation surface for a single-field status change
// (RESEARCH.md Code Examples rationale), and the one-tap conclude UX (DEM-02)
// stays independent of whatever else is currently typed into the edit form.
export async function concludeDemanda(
  id: number
): Promise<ConcludeDemandaState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada." };
  }

  const { error } = await supabase
    .from("demandas")
    .update({ status: "concluida" })
    .eq("id", id);

  if (error) {
    console.error("concludeDemanda: update failed", error);
    return { ok: false, message: "Não foi possível concluir a demanda." };
  }

  revalidatePath("/");
  return { ok: true, message: "Demanda concluída." };
}

const statusSchema = z.enum(["pendente", "em_andamento", "concluida"]);

// Kanban view's per-card status change — same narrow single-field mutation
// shape as concludeDemanda, generalized to any target status. The target
// comes from a closed zod enum (never raw input) and the id is a function
// parameter bound server-side, never read from client-controlled fields.
export async function updateDemandaStatus(
  id: number,
  status: string
): Promise<ConcludeDemandaState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada." };
  }

  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) {
    return { ok: false, message: "Status inválido." };
  }

  const { error } = await supabase
    .from("demandas")
    .update({ status: parsed.data })
    .eq("id", id);

  if (error) {
    console.error("updateDemandaStatus: update failed", error);
    return { ok: false, message: "Não foi possível mover a demanda." };
  }

  revalidatePath("/");
  return { ok: true, message: "Demanda atualizada." };
}

export type CriarEtiquetaState = {
  ok: boolean;
  message: string;
  id: number | null;
};

const criarEtiquetaInitialState: CriarEtiquetaState = {
  ok: false,
  message: "",
  id: null,
};

const etiquetaSchema = z.object({
  area: z.string().trim().min(1, "Escolha a área da etiqueta.").max(200),
  nome: z.string().trim().min(1, "Dê um nome à etiqueta.").max(100),
});

// Inline label creation from the demanda form ("cadastrado diretamente
// pela seleção") — every label is bound to an área. Returns the new id so
// the client can select it immediately without a page reload.
export async function criarEtiqueta(
  prevState: CriarEtiquetaState,
  formData: FormData
): Promise<CriarEtiquetaState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...criarEtiquetaInitialState, message: "Sessão expirada." };
  }

  const parsed = etiquetaSchema.safeParse({
    area: formData.get("area"),
    nome: formData.get("nome"),
  });

  if (!parsed.success) {
    return {
      ...criarEtiquetaInitialState,
      message: "Escolha a área e dê um nome à etiqueta.",
    };
  }

  const { data, error } = await supabase
    .from("etiquetas")
    .insert({
      area: parsed.data.area,
      nome: parsed.data.nome,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("criarEtiqueta: insert failed", error);
    return {
      ...criarEtiquetaInitialState,
      message:
        error?.code === "23505"
          ? "Já existe uma etiqueta com esse nome nessa área."
          : "Não foi possível criar a etiqueta.",
    };
  }

  return { ok: true, message: "Etiqueta criada.", id: data.id as number };
}

// ── Inline-edit single-field actions (editar page v2) ──

export type InlineUpdateState = { ok: boolean; message: string };

const inlineUpdateError: InlineUpdateState = {
  ok: false,
  message: "Não foi possível salvar. Verifique os dados e tente de novo.",
};

export async function updateDemandaTitulo(
  id: number,
  titulo: string
): Promise<InlineUpdateState> {
  const parsed = z.string().trim().min(1, "Digite um título.").safeParse(titulo);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Título inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("demandas").update({ titulo: parsed.data }).eq("id", id);
  if (error) return inlineUpdateError;
  revalidatePath("/");
  return { ok: true, message: "" };
}

export async function updateDemandaPrazo(
  id: number,
  prazo: string
): Promise<InlineUpdateState> {
  const parsed = z.string().date("Data inválida.").safeParse(prazo);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Prazo inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("demandas").update({ prazo: parsed.data }).eq("id", id);
  if (error) return inlineUpdateError;
  revalidatePath("/");
  return { ok: true, message: "" };
}

export async function updateDemandaArea(
  id: number,
  area: string | null
): Promise<InlineUpdateState> {
  const parsed = z.string().trim().max(200).nullable().safeParse(area || null);
  if (!parsed.success) return { ok: false, message: "Área inválida." };
  const supabase = await createClient();
  const { error } = await supabase.from("demandas").update({ area: parsed.data }).eq("id", id);
  if (error) return inlineUpdateError;
  revalidatePath("/");
  return { ok: true, message: "" };
}

export async function updateDemandaProjeto(
  id: number,
  projeto: string | null
): Promise<InlineUpdateState> {
  const parsed = z.string().trim().max(200).nullable().safeParse(projeto || null);
  if (!parsed.success) return { ok: false, message: "Projeto inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("demandas").update({ projeto: parsed.data }).eq("id", id);
  if (error) return inlineUpdateError;
  revalidatePath("/");
  return { ok: true, message: "" };
}

export async function updateDemandaEvento(
  id: number,
  eventoId: number | null
): Promise<InlineUpdateState> {
  const parsed = eventoIdSchema.safeParse(eventoId);
  if (!parsed.success) return { ok: false, message: "Evento inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("demandas").update({ evento_id: parsed.data ?? null }).eq("id", id);
  if (error) return inlineUpdateError;
  revalidatePath("/");
  return { ok: true, message: "" };
}

export async function updateDemandaEtiqueta(
  id: number,
  etiquetaId: number | null
): Promise<InlineUpdateState> {
  const parsed = etiquetaIdSchema.safeParse(etiquetaId);
  if (!parsed.success) return { ok: false, message: "Etiqueta inválida." };
  const supabase = await createClient();
  const { error } = await supabase.from("demandas").update({ etiqueta_id: parsed.data ?? null }).eq("id", id);
  if (error) return inlineUpdateError;
  revalidatePath("/");
  return { ok: true, message: "" };
}

export async function addDemandaResponsavel(
  demandaId: number,
  voluntarioId: string
): Promise<InlineUpdateState> {
  const parsed = z.coerce.number().int().positive().safeParse(voluntarioId);
  if (!parsed.success) return { ok: false, message: "Voluntário inválido." };
  const supabase = await createClient();
  const [destino] = await resolverDestinosVoluntario(supabase, [parsed.data]);
  if (!destino) return { ok: false, message: "Voluntário não encontrado." };
  const { error } = await supabase.from("demanda_responsaveis").insert({
    demanda_id: demandaId,
    ...destino,
  });
  if (error) {
    if (error.code === "23505") return { ok: true, message: "" };
    return inlineUpdateError;
  }
  revalidatePath("/");
  return { ok: true, message: "" };
}

export async function removeDemandaResponsavel(
  demandaId: number,
  voluntarioId: string
): Promise<InlineUpdateState> {
  const parsed = z.coerce.number().int().positive().safeParse(voluntarioId);
  if (!parsed.success) return { ok: false, message: "Voluntário inválido." };
  const supabase = await createClient();
  const [destino] = await resolverDestinosVoluntario(supabase, [parsed.data]);
  if (!destino) return { ok: false, message: "Voluntário não encontrado." };
  let query = supabase
    .from("demanda_responsaveis")
    .delete()
    .eq("demanda_id", demandaId);
  query =
    "profile_id" in destino
      ? query.eq("profile_id", destino.profile_id)
      : query.eq("voluntario_id", destino.voluntario_id);
  const { error } = await query;
  if (error) return inlineUpdateError;
  revalidatePath("/");
  return { ok: true, message: "" };
}

export async function addDemandaMembro(
  demandaId: number,
  voluntarioId: string
): Promise<InlineUpdateState> {
  const parsed = z.coerce.number().int().positive().safeParse(voluntarioId);
  if (!parsed.success) return { ok: false, message: "Voluntário inválido." };
  const supabase = await createClient();
  const [destino] = await resolverDestinosVoluntario(supabase, [parsed.data]);
  if (!destino) return { ok: false, message: "Voluntário não encontrado." };
  const { error } = await supabase.from("demanda_membros").insert({
    demanda_id: demandaId,
    ...destino,
  });
  if (error) {
    if (error.code === "23505") return { ok: true, message: "" };
    return inlineUpdateError;
  }
  revalidatePath("/");
  return { ok: true, message: "" };
}

export async function removeDemandaMembro(
  demandaId: number,
  voluntarioId: string
): Promise<InlineUpdateState> {
  const parsed = z.coerce.number().int().positive().safeParse(voluntarioId);
  if (!parsed.success) return { ok: false, message: "Voluntário inválido." };
  const supabase = await createClient();
  const [destino] = await resolverDestinosVoluntario(supabase, [parsed.data]);
  if (!destino) return { ok: false, message: "Voluntário não encontrado." };
  let query = supabase
    .from("demanda_membros")
    .delete()
    .eq("demanda_id", demandaId);
  query =
    "profile_id" in destino
      ? query.eq("profile_id", destino.profile_id)
      : query.eq("voluntario_id", destino.voluntario_id);
  const { error } = await query;
  if (error) return inlineUpdateError;
  revalidatePath("/");
  return { ok: true, message: "" };
}

// ---------------------------------------------------------------------------
// Correcao de demanda existente com IA

export type CorrigirDemandaResult = {
  ok: boolean;
  message: string;
  sugestao: {
    area: string | null;
    projeto: string | null;
    responsavelId: string | null;
    eventoId: number | null;
  } | null;
};

// The AI only SUGGESTS — matching against the roster/eventos is done
// deterministically here (same rules as the ata analysis), and the actual
// writes go through the existing per-field update actions, which are gated
// by the same RLS as the rest of the app.
const corrigirIaRespostaSchema = z.object({
  area: z.string().trim().max(200),
  projeto: z.string().trim().max(200),
  responsavel_texto: z.string().trim().max(200),
  evento_texto: z.string().trim().max(200),
});

const CORRIGIR_IA_PROMPT =
  "Você é um assistente que preenche campos faltantes de uma demanda institucional. " +
  'Responda APENAS com JSON no formato {"area": string, "projeto": string, "responsavel_texto": string, "evento_texto": string}. ' +
  "Use \"\" (string vazia) para todo campo que não puder ser identificado com confiança a partir do contexto fornecido. " +
  "Regras: baseie-se no título da demanda, nos comentários e nas informações disponíveis. " +
  "responsavel_texto deve ser exatamente um dos nomes da lista de voluntários fornecida, ou \"\". " +
  "evento_texto deve ser exatamente um dos títulos da lista de eventos fornecida, ou \"\". " +
  "Nunca invente nomes, áreas, projetos ou eventos fora das listas fornecidas.";

export async function corrigirDemandaComIa(
  demandaId: number
): Promise<CorrigirDemandaResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada. Faça login novamente.", sugestao: null };
  }

  if (!Number.isFinite(demandaId)) {
    return { ok: false, message: "Demanda inválida.", sugestao: null };
  }

  const { data: demanda } = await supabase
    .from("demandas_com_status")
    .select("id, titulo, prazo, area, projeto, evento_id, etiqueta_id")
    .eq("id", demandaId)
    .single();

  if (!demanda) {
    return { ok: false, message: "Demanda não encontrada.", sugestao: null };
  }

  const [comentariosRows, responsaveisRows, perfisRows, voluntariosRows, eventosRows, areasRows, projetosRows] =
    await Promise.all([
      supabase
        .from("demanda_comentarios")
        .select("conteudo")
        .eq("demanda_id", demandaId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("demanda_responsaveis")
        .select("voluntario_id, profiles(voluntario_id)")
        .eq("demanda_id", demandaId),
      supabase.from("profiles").select("id, email, full_name, voluntario_id").not("voluntario_id", "is", null),
      supabase.from("voluntarios").select("id, nome").eq("ativo", true).order("nome"),
      supabase
        .from("eventos")
        .select("id, titulo, data_evento")
        .gte("data_evento", new Date().toISOString().slice(0, 10))
        .order("data_evento", { ascending: true })
        .limit(100),
      supabase.from("areas_institucionais").select("nome").order("nome"),
      supabase.from("projetos").select("nome").order("nome"),
    ]);

  const responsaveisAtuais = new Set<string>();
  for (const row of (responsaveisRows.data ?? []) as Array<{
    voluntario_id: number | null;
    profiles: { voluntario_id: number | null } | { voluntario_id: number | null }[] | null;
  }>) {
    const voluntarioId =
      row.voluntario_id ??
      (Array.isArray(row.profiles)
        ? row.profiles[0]?.voluntario_id ?? null
        : row.profiles?.voluntario_id ?? null);
    if (voluntarioId !== null && voluntarioId !== undefined) {
      responsaveisAtuais.add(String(voluntarioId));
    }
  }

  const jaTemResponsavel = responsaveisAtuais.size > 0;
  const jaTemArea = Boolean(demanda.area?.trim());
  const jaTemProjeto = Boolean(demanda.projeto?.trim());
  const jaTemEvento = demanda.evento_id !== null;

  if (jaTemResponsavel && jaTemArea && jaTemProjeto && jaTemEvento) {
    return { ok: true, message: "Todos os campos já estão preenchidos.", sugestao: null };
  }

  const voluntarios = (voluntariosRows.data ?? []).map((v) => v.nome);
  const eventos = (eventosRows.data ?? []).map((e) => `${e.titulo} (${e.data_evento})`);

  const contexto = [
    `Título da demanda: ${demanda.titulo}`,
    `Prazo: ${demanda.prazo}`,
    demanda.area?.trim() ? `Área atual: ${demanda.area}` : "",
    demanda.projeto?.trim() ? `Projeto atual: ${demanda.projeto}` : "",
    ...(comentariosRows.data ?? []).map((c) => `Comentário: ${c.conteudo}`),
  ]
    .filter(Boolean)
    .join("\n");

  const pedido =
    `${contexto}\n\n` +
    `Voluntários cadastrados: ${voluntarios.join(", ")}\n` +
    `Eventos cadastrados: ${eventos.join(", ")}\n` +
    `Áreas institucionais: ${(areasRows.data ?? []).map((a) => a.nome).join(", ")}\n` +
    `Projetos cadastrados: ${(projetosRows.data ?? []).map((p) => p.nome).join(", ")}\n\n` +
    `Preencha apenas os campos que a demanda ainda NÃO tem (área, projeto, responsável, evento). Os já preenchidos devem vir "".`;

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(
      await chatCompletion(CORRIGIR_IA_PROMPT, pedido, { jsonMode: true })
    );
  } catch (err) {
    console.error("corrigirDemandaComIa: AI call failed", err);
    return {
      ok: false,
      message: "Não foi possível consultar a IA agora. Tente novamente em instantes.",
      sugestao: null,
    };
  }

  const parsed = corrigirIaRespostaSchema.safeParse(rawJson);
  if (!parsed.success) {
    return {
      ok: false,
      message: "A IA respondeu em formato inesperado. Tente novamente.",
      sugestao: null,
    };
  }

  const profiles = (perfisRows.data ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
  }));
  const roster = (voluntariosRows.data ?? []).map((v) => ({
    id: v.id,
    nome: v.nome,
    profileId:
      (perfisRows.data ?? []).find((p) => p.voluntario_id === v.id)?.id ?? null,
  }));

  const matchResponsavel = matchResponsavelRoster(
    parsed.data.responsavel_texto,
    profiles,
    roster
  );
  const responsavelId =
    !jaTemResponsavel && matchResponsavel.rosterId !== null
      ? String(matchResponsavel.rosterId)
      : null;

  const eventoMatch = parsed.data.evento_texto
    ? (eventosRows.data ?? []).find((evento) => {
        const needle = normalize(parsed.data.evento_texto);
        const haystack = normalize(evento.titulo);
        return haystack.includes(needle) || needle.includes(haystack);
      }) ?? null
    : null;
  const eventoId = !jaTemEvento && eventoMatch ? eventoMatch.id : null;

  const area = !jaTemArea && parsed.data.area ? parsed.data.area : null;
  const projeto = !jaTemProjeto && parsed.data.projeto ? parsed.data.projeto : null;

  if (!area && !projeto && !responsavelId && !eventoId) {
    return {
      ok: true,
      message: "A IA não encontrou informações para preencher os campos faltantes.",
      sugestao: null,
    };
  }

  return {
    ok: true,
    message: "",
    sugestao: { area, projeto, responsavelId, eventoId },
  };
}

