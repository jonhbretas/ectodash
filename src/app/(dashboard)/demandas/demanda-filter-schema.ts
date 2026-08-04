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
// agrupar: a closed two-value enum — "Sem agrupamento" is the ABSENCE of
// this param, not a third enum value (05-UI-SPEC.md Copywriting Contract).
//
// view: which visualization renders below the filters — "lista" (default,
// the existing card/table layout) is the ABSENCE of this param, so
// ?view=kanban / ?view=calendario opt in explicitly and the URL never
// carries a redundant ?view=lista.
export const demandaFilterSchema = z.object({
  area: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1).optional()
  ),
  responsavel: z.string().uuid().optional(),
  agrupar: z.enum(["area", "responsavel"]).optional(),
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
    responsavel: typeof raw.responsavel === "string" ? raw.responsavel : undefined,
    agrupar: typeof raw.agrupar === "string" ? raw.agrupar : undefined,
    view: typeof raw.view === "string" ? raw.view : undefined,
  });
}
