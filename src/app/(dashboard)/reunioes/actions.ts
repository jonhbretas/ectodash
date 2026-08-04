"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type CriarAtaState = {
  ok: boolean;
  message: string;
};

// Ata fields validated like any other untrusted form input. data_reuniao
// is a plain yyyy-MM-dd string from the native date input; resumo is
// optional free text with a generous cap.
const ataSchema = z.object({
  titulo: z.string().trim().min(1, "Dê um título à ata.").max(200),
  data_reuniao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha uma data válida."),
  resumo: z.string().trim().max(20000).optional().or(z.literal("")),
});

export async function criarAta(
  prevState: CriarAtaState,
  formData: FormData
): Promise<CriarAtaState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada. Faça login novamente." };
  }

  const parsed = ataSchema.safeParse({
    titulo: formData.get("titulo"),
    data_reuniao: formData.get("data_reuniao"),
    resumo: formData.get("resumo"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Verifique os campos destacados." };
  }

  // criado_por is never set from client input — the column default
  // derives it from the session, same anti-spoofing discipline as
  // createDemanda (RESEARCH.md Pitfall 4).
  const { error } = await supabase.from("reunioes").insert({
    titulo: parsed.data.titulo,
    data_reuniao: parsed.data.data_reuniao,
    resumo: parsed.data.resumo || null,
  });

  if (error) {
    console.error("criarAta: insert failed", error);
    return {
      ok: false,
      message:
        "Não foi possível salvar a ata agora. Verifique sua internet e tente de novo.",
    };
  }

  revalidatePath("/reunioes");
  return { ok: true, message: "Ata registrada com sucesso." };
}
