// src/lib/acesso-server.ts
// Carrega o acesso (role + cargos com módulos) do usuário da sessão, para
// os componentes de servidor. Lê via meus_cargos() (SECURITY DEFINER com
// filtro por auth.uid() — mesmo padrão vincular_meu_cadastro) e profiles.
import { createClient } from "@/lib/supabase/server";
import type { Acesso, Cargo } from "./acesso";

export async function obterAcesso(): Promise<Acesso | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const { data: cargos } = await supabase.rpc("meus_cargos");

  return {
    role: (profile?.role as Acesso["role"]) ?? null,
    cargos: (cargos ?? []) as Cargo[],
  };
}
