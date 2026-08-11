"use server";

// src/components/feedback/actions.ts
// Envio de feedback (bug ou sugestão) pelo botão flutuante. Insere na
// tabela feedback — RLS garante que cada usuário só grava no próprio nome.
import { createClient } from "@/lib/supabase/server";

export type FeedbackState = { ok: boolean; message: string };

const MENSAGEM_MIN = 5;
const MENSAGEM_MAX = 2000;

export async function enviarFeedback(
  _prev: FeedbackState,
  formData: FormData
): Promise<FeedbackState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada. Entre novamente e tente de novo." };
  }

  const tipo = formData.get("tipo");
  const mensagem = String(formData.get("mensagem") ?? "").trim();
  const pagina = String(formData.get("pagina") ?? "").trim().slice(0, 500);
  const navegador = String(formData.get("navegador") ?? "").trim().slice(0, 300);

  if (tipo !== "bug" && tipo !== "sugestao") {
    return { ok: false, message: "Escolha um tipo: bug ou sugestão." };
  }

  if (mensagem.length < MENSAGEM_MIN || mensagem.length > MENSAGEM_MAX) {
    return {
      ok: false,
      message: `Sua mensagem precisa ter entre ${MENSAGEM_MIN} e ${MENSAGEM_MAX} caracteres.`,
    };
  }

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    tipo,
    mensagem,
    pagina: pagina || null,
    navegador: navegador || null,
  });

  if (error) {
    return { ok: false, message: "Não foi possível enviar. Tente novamente em instantes." };
  }

  return { ok: true, message: "Recebemos seu feedback. Obrigado!" };
}
