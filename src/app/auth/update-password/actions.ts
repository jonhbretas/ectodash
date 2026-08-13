"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type UpdatePasswordState = {
  message: string;
  ok: boolean;
};

const passwordSchema = z
  .object({
    password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem.",
    path: ["confirmPassword"],
  });

export async function updatePassword(
  prevState: UpdatePasswordState,
  formData: FormData
): Promise<UpdatePasswordState> {
  const rawPassword = formData.get("password");
  const rawConfirmPassword = formData.get("confirmPassword");

  const password = typeof rawPassword === "string" ? rawPassword : "";
  const confirmPassword = typeof rawConfirmPassword === "string" ? rawConfirmPassword : "";

  const parsed = passwordSchema.safeParse({ password, confirmPassword });
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "Dados inválidos.";
    return { ok: false, message: firstError };
  }

  const supabase = await createClient();

  // O link de recuperação (código PKCE) é de uso único: se a sessão não
  // existir aqui, o código já foi consumido/expirado ou foi aberto em outro
  // navegador — deixa claro o que aconteceu em vez de apenas falhar.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      message:
        "Sua sessão expirou ou o link já foi usado. Solicite um novo link de redefinição.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    console.error("updatePassword failed", error);
    return {
      ok: false,
      message:
        "Não foi possível redefinir a senha. O link pode ter expirado — solicite um novo link de redefinição.",
    };
  }

  return { ok: true, message: "" };
}
