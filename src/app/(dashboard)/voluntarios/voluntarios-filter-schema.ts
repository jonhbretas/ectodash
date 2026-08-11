// src/app/(dashboard)/voluntarios/voluntarios-filter-schema.ts
// searchParams contract for /voluntarios — untrusted URL input, zod-validated
// before anything reaches a Supabase query (same pattern as
// demanda-filter-schema.ts / financeiro-filter-schema.ts).
import { z } from "zod";

export const voluntariosFilterSchema = z.object({
  busca: z.string().trim().max(120).optional(),
  area: z.string().trim().max(120).optional(),
  localidade: z.string().trim().max(120).optional(),
  situacao: z.enum(["ativo", "ocioso"]).optional(),
  vinculacao: z.enum(["vinculado", "nao_vinculado"]).optional(),
});

export type VoluntariosFilters = z.infer<typeof voluntariosFilterSchema>;

export function parseVoluntariosFilters(
  searchParams: Record<string, string | string[] | undefined>
): VoluntariosFilters {
  const parsed = voluntariosFilterSchema.safeParse(searchParams);
  return parsed.success ? parsed.data : {};
}
