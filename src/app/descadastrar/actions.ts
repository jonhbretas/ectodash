"use server";

// Confirmação de descadastro (página pública /descadastrar).
// Usa o cliente comum + função SECURITY DEFINER — sem sessão, sem
// service-role: só quem tem o token UUID do próprio e-mail consegue.
// O GET nunca altera nada (protege contra pré-leitura de scanners);
// só o POST do botão confirma.
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export interface UnsubscribeState {
  ok: boolean;
  message: string;
  done: boolean;
}

const tokenSchema = z.string().trim().uuid("Link inválido.");

export async function confirmUnsubscribe(
  _prev: UnsubscribeState,
  formData: FormData
): Promise<UnsubscribeState> {
  const parsed = tokenSchema.safeParse(formData.get("token"));
  if (!parsed.success) {
    return { ok: false, message: "Este link não vale. Confira o e-mail original.", done: true };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("marketing_unsubscribe", {
    p_token: parsed.data,
  });

  if (error) {
    console.error("confirmUnsubscribe: rpc failed", error);
    return { ok: false, message: "Não foi possível concluir agora. Tente de novo.", done: false };
  }
  if (!data) {
    return { ok: false, message: "Este link não corresponde a nenhum cadastro.", done: true };
  }
  return {
    ok: true,
    message: "Pronto! Você não recebe mais e-mails de marketing da Ectolab.",
    done: true,
  };
}
