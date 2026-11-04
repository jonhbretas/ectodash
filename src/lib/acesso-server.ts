// src/lib/acesso-server.ts
// Carrega o acesso (role + cargos com módulos) do usuário da sessão, para
// os componentes de servidor. Lê via meus_cargos() (SECURITY DEFINER com
// filtro por auth.uid() — mesmo padrão vincular_meu_cadastro) e profiles.
import { obterUsuarioAtual, obterPerfilAtual, obterCargosAtuais } from "@/lib/supabase/request-context";
import type { Acesso, Cargo } from "./acesso";

export async function obterAcesso(): Promise<Acesso | null> {
  const user = await obterUsuarioAtual();

  if (!user) return null;

  const [profile, cargos] = await Promise.all([
    obterPerfilAtual(),
    obterCargosAtuais(),
  ]);

  return {
    role: (profile?.role as Acesso["role"]) ?? null,
    cargos: (cargos ?? []) as Cargo[],
  };
}
