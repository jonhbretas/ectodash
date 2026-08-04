"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { demandaSchema } from "./demanda-schema";

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
  });

  if (!parsed.success) {
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
  // individual inserts.
  const { error: responsaveisError } = await supabase
    .from("demanda_responsaveis")
    .insert(
      parsed.data.responsavelIds.map((profileId) => ({
        demanda_id: demanda.id,
        profile_id: profileId,
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
  });

  if (!parsed.success) {
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
    })
    .eq("id", id);

  if (demandaError) {
    console.error("updateDemanda: update failed", demandaError);
    return { ok: false, message: "Não foi possível salvar as alterações." };
  }

  // Responsável diffing: re-query the row's actual current set server-side
  // rather than trusting whatever the client last rendered as "current" —
  // the client's form state only expresses the *desired* end state
  // (T-04-12 mitigation). Only the real delta is written: additions are
  // inserted, removals are deleted, and either call is skipped entirely
  // when its list is empty rather than issuing a no-op insert/delete.
  const { data: currentRows, error: currentError } = await supabase
    .from("demanda_responsaveis")
    .select("profile_id")
    .eq("demanda_id", id);

  if (currentError) {
    console.error(
      "updateDemanda: reading current responsaveis failed",
      currentError
    );
    return { ok: false, message: "Não foi possível salvar as alterações." };
  }

  const currentIds = new Set(
    (currentRows ?? []).map((row) => row.profile_id as string)
  );
  const desiredIds = new Set(parsed.data.responsavelIds);

  const idsToAdd = [...desiredIds].filter((id) => !currentIds.has(id));
  const idsToRemove = [...currentIds].filter((id) => !desiredIds.has(id));

  if (idsToAdd.length > 0) {
    const { error: insertError } = await supabase
      .from("demanda_responsaveis")
      .insert(
        idsToAdd.map((profileId) => ({
          demanda_id: id,
          profile_id: profileId,
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
    const { error: deleteError } = await supabase
      .from("demanda_responsaveis")
      .delete()
      .eq("demanda_id", id)
      .in("profile_id", idsToRemove);

    if (deleteError) {
      console.error(
        "updateDemanda: demanda_responsaveis delete failed",
        deleteError
      );
      return { ok: false, message: "Não foi possível salvar as alterações." };
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
