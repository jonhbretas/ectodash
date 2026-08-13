"use server";

// src/components/notificacoes/actions.ts
// Marca notificações do usuário como lidas após exibição no dashboard.
// A RLS (migration 0070) garante que cada usuário só altera as próprias.
import { createClient } from "@/lib/supabase/server";

export async function marcarNotificacoesLidas(ids: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || ids.length === 0) return;

  await supabase.from("notificacoes").update({ lida: true }).in("id", ids);
}
