"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const quickSchema = z.object({
  titulo: z.string().trim().min(1, "Digite o nome da tarefa.").max(500),
  status: z.enum(["pendente", "em_andamento", "concluida"]).default("pendente"),
  prazo: z.string().date().optional(),
  area: z.string().trim().optional(),
  projeto: z.string().trim().optional(),
  mesclarId: z.number().int().positive().optional(),
});

export type QuickCreateInput = z.infer<typeof quickSchema>;
export type QuickCreateResult = {
  ok: boolean;
  message: string;
  id?: number;
  duplicates?: { id: number; titulo: string }[];
};

export async function criarTarefaCoordenacao(input: QuickCreateInput): Promise<QuickCreateResult> {
  const parsed = quickSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Informe um nome e dados válidos para a tarefa." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada. Faça login novamente." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "coordenador_geral") return { ok: false, message: "Acesso restrito à Coordenação Geral." };

  const { titulo, status, prazo, area, projeto, mesclarId } = parsed.data;
  // Search all private tasks, regardless of the current view's filters.
  // Escape ILIKE metacharacters so the title is compared literally.
  const literal = titulo.replace(/[\\%_]/g, "\\$&");
  const { data: duplicates, error: searchError } = await supabase.from("demandas")
    .select("id, titulo, prazo, area, projeto").eq("restrita_coordenacao_geral", true)
    .ilike("titulo", literal).order("id");
  if (searchError) return { ok: false, message: "Não foi possível verificar tarefas existentes. Tente novamente." };

  if (mesclarId !== undefined) {
    const existing = duplicates?.find((d) => d.id === mesclarId);
    if (!existing) return { ok: false, message: "A tarefa mudou. Verifique o nome e tente novamente." };
    // Keep existing assignments and status; only fill missing context.
    const { data, error } = await supabase.from("demandas").update({
      prazo: existing.prazo ?? prazo ?? null,
      area: existing.area || area || null,
      projeto: existing.projeto || projeto || null,
    }).eq("id", existing.id).eq("restrita_coordenacao_geral", true).select("id").single();
    if (error || !data) return { ok: false, message: "Não foi possível mesclar a tarefa." };
    revalidatePath("/demandas");
    return { ok: true, message: "Dados mesclados na tarefa existente.", id: data.id };
  }
  if (duplicates?.length) return {
    ok: false, message: "Já existe uma tarefa com esse nome. Mescle os dados ou altere o nome.",
    duplicates: duplicates.map(({ id, titulo }) => ({ id, titulo })),
  };
  const { data, error } = await supabase.from("demandas").insert({
    titulo, status, prazo: prazo ?? null, area: area || null, projeto: projeto || null,
    restrita_coordenacao_geral: true,
  }).select("id").single();
  if (error || !data) return { ok: false, message: "Não foi possível criar a tarefa. Tente novamente." };
  revalidatePath("/demandas");
  return { ok: true, message: "Tarefa criada. Você pode definir os detalhes quando quiser.", id: data.id };
}
