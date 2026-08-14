import { z } from "zod";

// searchParams is untrusted URL input — same boundary-validation discipline
// already applied to formData in demanda-schema.ts (05-RESEARCH.md
// Pattern 5). area/responsavel/agrupar are all optional: an empty filter
// state (no query params at all) is valid and means "show everything the
// caller's RLS grant already scopes."
//
// area: a preprocessing step normalizes an empty string to undefined
// BEFORE it reaches z.string().trim().min(1) — an empty ?area= (e.g. from
// a cleared Select) must behave identically to the param being absent, not
// throw and not be treated as "filter by the empty string."
//
// responsavel: validated as a UUID, since it's always a profiles.id value,
// never an arbitrary string.
//
// agrupar: a closed three-value enum — "Sem agrupamento" is the ABSENCE of
// this param, not a fourth enum value (05-UI-SPEC.md Copywriting Contract).
//
// view: which visualization renders below the filters — "lista" (default,
// the existing card/table layout) is the ABSENCE of this param, so
// ?view=kanban / ?view=calendario opt in explicitly and the URL never
// carries a redundant ?view=lista.
//
// User decision (2026-08-04): the filter bar must offer Área, Projeto,
// Evento, Voluntário and Status — five independent dimensions, all
// optional, combinable with AND.
export const demandaFilterSchema = z.object({
  area: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1).optional()
  ),
  projeto: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1).optional()
  ),
  // evento: a numeric string id (eventos.id is bigint) — validated as a
  // positive integer string, never raw text.
  evento: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .regex(/^\d+$/, "evento deve ser um id numérico")
      .optional()
  ),
  // etiqueta: sub-área label (etiquetas.id), same numeric-string rule.
  etiqueta: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .regex(/^\d+$/, "etiqueta deve ser um id numérico")
      .optional()
  ),
  // responsavel: a numeric string id (voluntarios.id is bigint) — the roster
  // id is the UI's single vocabulary for responsáveis since DEM-06
  // (2026-08-04), so this follows the same numeric-string rule as evento.
  responsavel: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .regex(/^\d+$/, "responsavel deve ser um id numérico")
      .optional()
  ),
  // status: MULTIPLE statuses, comma-separated in canonical order
  // (pendente,em_andamento,concluida) — e.g. ?status=pendente,em_andamento
  // to hide concluded demandas. Validated against the closed enum, never
  // raw text.
  status: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .regex(
        /^(pendente|em_andamento|concluida)(,(pendente|em_andamento|concluida))*$/,
        "status inválido"
      )
      .optional()
  ),
  agrupar: z.enum(["area", "responsavel", "projeto"]).optional(),
  view: z.enum(["lista", "kanban", "calendario"]).optional(),
});

export type DemandaFilters = z.infer<typeof demandaFilterSchema>;

// The exact function page.tsx (Task 3) calls with `await searchParams`. A
// repeated query param (e.g. ?area=a&area=b) arrives as a string array —
// this guard extracts only the string case of each key, mirroring
// RESEARCH.md Pattern 5's `typeof raw.x === "string" ? raw.x : undefined`
// shape, before handing the result to demandaFilterSchema.parse().
export function parseDemandaFilters(raw: {
  [key: string]: string | string[] | undefined;
}): DemandaFilters {
  return demandaFilterSchema.parse({
    area: typeof raw.area === "string" ? raw.area : undefined,
    projeto: typeof raw.projeto === "string" ? raw.projeto : undefined,
    evento: typeof raw.evento === "string" ? raw.evento : undefined,
    etiqueta: typeof raw.etiqueta === "string" ? raw.etiqueta : undefined,
    responsavel: typeof raw.responsavel === "string" ? raw.responsavel : undefined,
    agrupar: typeof raw.agrupar === "string" ? raw.agrupar : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
    view: typeof raw.view === "string" ? raw.view : undefined,
  });
}
