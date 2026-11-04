import { cache } from "react";
import { createClient } from "./server";

// React cache is scoped to a server render/request. Never persist these
// session-bound results in a module-level Map or a cross-request cache.
export const obterUsuarioAtual = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export const obterPerfilAtual = cache(async () => {
  const user = await obterUsuarioAtual();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("email, full_name, role, ativo, vincular_pendente, voluntario_id")
    .eq("id", user.id)
    .single();
  return data;
});

export const obterCargosAtuais = cache(async () => {
  if (!(await obterUsuarioAtual())) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("meus_cargos");
  return data ?? [];
});

export const obterModulosDesativados = cache(async (): Promise<string[]> => {
  if (!(await obterUsuarioAtual())) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("system_module_flags")
    .select("modulo")
    .eq("ativo", false);
  return (data ?? []).map((flag) => String(flag.modulo));
});
