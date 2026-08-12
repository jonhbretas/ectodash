// src/lib/role-gates.ts
// Gates de role compartilhados para server actions e route handlers.
// SERVER-ONLY: usa createClient (sessão), nunca clientes de navegador.
// O limite REAL é a RLS no banco; estes gates são a primeira barreira em
// servidor para rotas/actions que fazem efeitos colaterais (IA, Drive,
// webhooks, sync) e não podem confiar apenas na UX.
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type RoleGateContext = {
  supabase: SupabaseClient;
  user: User;
  role: string | null;
};

export async function requireUsuario(): Promise<RoleGateContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Sessão expirada. Entre novamente.");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return { supabase, user, role: profile?.role ?? null };
}

export async function requireRole(papeis: readonly string[]): Promise<RoleGateContext> {
  const ctx = await requireUsuario();
  if (!ctx.role || !papeis.includes(ctx.role)) {
    throw new Error("Sem permissão para esta ação.");
  }
  return ctx;
}

export async function requireCoordenadorGeral(): Promise<RoleGateContext> {
  return requireRole(["coordenador_geral"]);
}

/** Caller tem o módulo concedido por cargo? (RPC SECURITY DEFINER, 0043) */
export async function temCargoModulo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  modulo: string
): Promise<boolean> {
  const { data } = await supabase.rpc("tem_cargo_modulo", { modulo });
  return data === true;
}

/** Acesso ao módulo PROEP: coordenador_geral ou cargo com o módulo. */
export async function requireProep(): Promise<RoleGateContext> {
  const ctx = await requireUsuario();
  const ok =
    ctx.role === "coordenador_geral" ||
    ctx.role === "financeiro" ||
    (await temCargoModulo(ctx.supabase, "proep"));
  if (!ok) {
    throw new Error("Você não tem acesso ao módulo PROEP.");
  }
  return ctx;
}

/** Acesso à extração de demandas por IA (página exige coordenador/cargo). */
export async function requireExtrairDemandas(): Promise<RoleGateContext> {
  const ctx = await requireUsuario();
  const ok =
    ctx.role === "coordenador_geral" ||
    ctx.role === "coordenador_area" ||
    (await temCargoModulo(ctx.supabase, "demandas"));
  if (!ok) {
    throw new Error("Este recurso é exclusivo de coordenadores.");
  }
  return ctx;
}

/** Acesso à análise com IA (/analisar e /reunioes/analisar). */
export async function requireAnaliseComIA(): Promise<RoleGateContext> {
  const ctx = await requireUsuario();
  const ok =
    ctx.role === "coordenador_geral" ||
    ctx.role === "coordenador_area" ||
    (await temCargoModulo(ctx.supabase, "analisar"));
  if (!ok) {
    throw new Error("Este recurso é exclusivo de coordenadores.");
  }
  return ctx;
}

/** Acesso ao financeiro (rotas com efeitos colaterais). */
export async function requireFinanceiro(): Promise<RoleGateContext> {
  return requireRole(["coordenador_geral", "financeiro"]);
}
