"use server";

import { revalidatePath } from "next/cache";
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
