"use server";

// src/components/feedback/actions.ts
// Envio de feedback (bug ou sugestão) pelo botão flutuante. Insere na
// tabela feedback — RLS garante que cada usuário só grava no próprio nome.
// Os anexos de imagem são enviados direto do navegador ao bucket privado
// feedback-anexos (migration 0069); aqui só validamos e guardamos os
// caminhos que o cliente já subiu (feedback/{user_id}/...).
import { createClient } from "@/lib/supabase/server";

export type FeedbackState = { ok: boolean; message: string };

const MENSAGEM_MIN = 5;
const MENSAGEM_MAX = 2000;
const MAX_ANEXOS = 3;

// Caminho no formato {uuid do usuário}/{uuid}.{ext} — mesma forma gerada
// pelo cliente no upload. Impede que um usuário grave caminho arbitrário.
const CAMINHO_ANEXO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$/;

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

  const anexos: string[] = [];
  const anexosRaw = formData.get("anexos");
  if (anexosRaw) {
    try {
      const parsed: unknown = JSON.parse(String(anexosRaw));
      if (!Array.isArray(parsed)) throw new Error("não é array");
      anexos.push(...parsed.filter((v): v is string => typeof v === "string"));
    } catch {
      return { ok: false, message: "Os anexos vieram inválidos. Tente novamente." };
    }
  }

  if (anexos.length > MAX_ANEXOS) {
    return {
      ok: false,
      message: `Você pode anexar no máximo ${MAX_ANEXOS} imagens por envio.`,
    };
  }

  for (const caminho of anexos) {
    if (!CAMINHO_ANEXO.test(caminho) || !caminho.startsWith(`${user.id}/`)) {
      return { ok: false, message: "Anexo inválido. Envie as imagens novamente." };
    }
  }

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    tipo,
    mensagem,
    pagina: pagina || null,
    navegador: navegador || null,
    anexos: anexos.length > 0 ? anexos : null,
  });

  if (error) {
    return { ok: false, message: "Não foi possível enviar. Tente novamente em instantes." };
  }

  return { ok: true, message: "Recebemos seu feedback. Obrigado!" };
}
