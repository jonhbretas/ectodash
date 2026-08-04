import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./sign-out-button";
import DemandaList from "./demandas/demanda-list";
import DemandaFilters from "./demandas/demanda-filters";
import PageContainer from "./page-container";
import { parseDemandaFilters } from "./demandas/demanda-filter-schema";

export default async function DashboardPage({
  searchParams,
}: {
  // Next.js 16's documented shape (node_modules/next/dist/docs/01-app/
  // 01-getting-started/03-layouts-and-pages.md, "Rendering with search
  // params") — a Promise, read exclusively via this Server Component prop.
  // The client-side search-params hook is reserved for filtering a list
  // already loaded via props, not for loading data, and must never be
  // imported in this file (05-RESEARCH.md Pattern 5, Anti-Patterns).
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // searchParams is untrusted URL input — zod-validated before any value
  // reaches a Supabase query, the same boundary-validation discipline
  // already applied to formData (05-RESEARCH.md Pattern 5).
  const filters = parseDemandaFilters(await searchParams);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards this route, but a defensive null-check keeps
  // this Server Component correct if it's ever rendered without middleware
  // (e.g. a future test harness).
  if (!user) {
    return null;
  }

  // Exercises the RLS policy from plan 01-02 as a genuine authenticated
  // read — not just a session check. role is read alongside email (no
  // duplicate auth.getUser() call) so the role-scoped-view notice can be
  // computed server-side, from the same read that already knows who's
  // signed in (05-UI-SPEC.md Screen Inventory 3, CLAUDE.md's
  // client-side-authorization prohibition applied here as a UX-only
  // concern, not a security boundary).
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("id", user.id)
    .single();

  const email = profile?.email ?? user.email;
  const role = profile?.role;

  // Only read when the caller is a lider_area — a coordenador/voluntario/
  // financeiro account has no lider_areas rows and no use for this read.
  const { data: liderAreasRows } =
    role === "lider_area"
      ? await supabase.from("lider_areas").select("area").eq("lider_id", user.id)
      : { data: [] as { area: string }[] };

  const liderAreas = (liderAreasRows ?? []).map((row) => row.area);

  // Role-scoped-view notice, computed once server-side. Never a client-side
  // role check — the string itself is UX polish; RLS from plan 05-01 is the
  // real authorization boundary regardless of what's rendered here.
  let scopedViewNotice: string | null = null;
  if (role === "voluntario_comum") {
    scopedViewNotice = "Mostrando apenas as demandas atribuídas a você.";
  } else if (role === "lider_area") {
    if (liderAreas.length === 0) {
      // Edge case: assigned as líder but no área set yet by a coordenador
      // (docs/areas.md's runbook is the only assignment mechanism) — this
      // account's effective visibility today is identical to a voluntário
      // comum's (plan 05-01's RLS), so it gets the same notice rather than
      // a broken "Mostrando as demandas da área ." with an empty
      // interpolation.
      scopedViewNotice = "Mostrando apenas as demandas atribuídas a você.";
    } else if (liderAreas.length === 1) {
      scopedViewNotice = `Mostrando as demandas da área ${liderAreas[0]}.`;
    } else {
      // 2+ áreas: join with ", " and a final " e " before the last item —
      // no UI-SPEC copy exists for this exact case (only the single-área
      // example is locked), so this is best-effort natural PT-BR phrasing,
      // recorded as a decision in 05-02-SUMMARY.md.
      const allButLast = liderAreas.slice(0, -1).join(", ");
      const last = liderAreas[liderAreas.length - 1];
      scopedViewNotice = `Mostrando as demandas das áreas ${allButLast} e ${last}.`;
    }
  } else if (role === "coordenador_geral") {
    // No notice — coordenador sees everything, per the "don't add UI for
    // the unrestricted case" rule. Explicit branch (not merely the
    // fallthrough absence of a match) so a future edit can't accidentally
    // assume "no notice" implies "must be coordenador."
    scopedViewNotice = null;
  } else {
    // financeiro or any other/unknown role — 05-UI-SPEC.md explicitly does
    // not speculate a string for this role; render nothing rather than
    // guessing.
    scopedViewNotice = null;
  }

  // Base role-scoped query (RLS already narrows this to whatever the
  // caller is allowed to see) — read once, area/responsavel filters
  // applied as additional query modifiers before the data ever reaches
  // the client. demandas_com_status, not the bare demandas table, is the
  // read source — atrasada is read directly from this view's
  // server-computed column, never recomputed client-side (plan 04-01).
  let query = supabase
    .from("demandas_com_status")
    .select("id, titulo, prazo, status, area, atrasada")
    .order("prazo", { ascending: true });

  // Exact case-insensitive match only — no wildcard/substring construction
  // (Pitfall 5). The área filter dropdown's options come from an exact,
  // known DISTINCT area value, so selecting "Pesquisa" must never also
  // match "Pesquisa de Campo".
  if (filters.area) {
    query = query.ilike("area", filters.area);
  }

  // A second query grouped client-side — demandas_com_status is a view over
  // demandas alone and doesn't expose the responsáveis join directly. This
  // is an accepted N+1-adjacent tradeoff for the tracer's small expected
  // data volume (documented as a known follow-up for Plan 04-04). The base
  // (role-scoped, not yet área/responsável-filtered) read below is used
  // both to derive filter dropdown options AND, combined with the área
  // filter above, the actual filtered rows — never a second, separately-
  // scoped query for "all áreas"/"all responsáveis" (05-RESEARCH.md Open
  // Question 3, this plan's Task 3 action).
  const { data: baseDemandas } = await supabase
    .from("demandas_com_status")
    .select("id, area")
    .order("prazo", { ascending: true });

  const areaOptions = [
    ...new Set(
      (baseDemandas ?? [])
        .map((demanda) => demanda.area)
        .filter((area): area is string => Boolean(area && area.trim()))
    ),
  ].sort((a, b) => a.localeCompare(b));

  const { data: demandas } = await query;

  const demandaIds = (demandas ?? []).map((demanda) => demanda.id);
  const baseDemandaIds = (baseDemandas ?? []).map((demanda) => demanda.id);

  // demanda_responsaveis is queried once against the BASE (role-scoped,
  // unfiltered-by-área) id set so responsavelOptions is derived from the
  // full role-scoped dataset, not narrowed further by whatever área filter
  // happens to be active — a filter dropdown must never leak the existence
  // of a responsável/área the viewer's RLS grant wouldn't otherwise show,
  // but it also shouldn't disappear an option just because a DIFFERENT
  // filter is currently narrowing the visible rows.
  const { data: responsaveis } =
    baseDemandaIds.length > 0
      ? await supabase
          .from("demanda_responsaveis")
          .select("demanda_id, profile_id, profiles(email)")
          .in("demanda_id", baseDemandaIds)
      : {
          data: [] as {
            demanda_id: number;
            profile_id: string;
            profiles: { email: string } | null;
          }[],
        };

  const responsaveisPorDemanda = new Map<number, string[]>();
  const responsavelOptionById = new Map<string, string>();
  for (const row of responsaveis ?? []) {
    // Without generated Supabase types, the nested profiles select is typed
    // as a possible array even though the FK is one-to-one from this row's
    // perspective — normalize both shapes defensively.
    const profileRow = Array.isArray(row.profiles)
      ? row.profiles[0]
      : row.profiles;
    if (profileRow?.email) {
      responsavelOptionById.set(row.profile_id, profileRow.email);
    }
    if (demandaIds.includes(row.demanda_id)) {
      const emails = responsaveisPorDemanda.get(row.demanda_id) ?? [];
      if (profileRow?.email) {
        emails.push(profileRow.email);
      }
      responsaveisPorDemanda.set(row.demanda_id, emails);
    }
  }

  const responsavelOptions = [...responsavelOptionById.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Responsável filter: resolved via demanda_responsaveis (mirrors the
  // existing N+1-adjacent pattern already in this file), then applied as
  // an .in("id", ...) modifier on the already-área-filtered result — both
  // filters, when set together, combine with AND.
  let demandaList = (demandas ?? []).map((demanda) => ({
    id: demanda.id,
    titulo: demanda.titulo,
    prazo: demanda.prazo,
    status: demanda.status,
    area: demanda.area,
    atrasada: demanda.atrasada,
    responsavelEmails: responsaveisPorDemanda.get(demanda.id) ?? [],
  }));

  if (filters.responsavel) {
    const matchingDemandaIds = new Set(
      (responsaveis ?? [])
        .filter((row) => row.profile_id === filters.responsavel)
        .map((row) => row.demanda_id)
    );
    demandaList = demandaList.filter((demanda) =>
      matchingDemandaIds.has(demanda.id)
    );
  }

  const filtersActive = Boolean(filters.area || filters.responsavel);

  return (
    <PageContainer>
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <h2 className="text-3xl font-semibold text-zinc-900">Olá, {email}</h2>
        <SignOutButton />
      </div>

      <div className="flex w-full max-w-4xl flex-col gap-4">
        {scopedViewNotice && (
          <p className="text-base text-zinc-700">{scopedViewNotice}</p>
        )}

        <DemandaFilters
          areaOptions={areaOptions}
          responsavelOptions={responsavelOptions}
          currentFilters={filters}
        />

        <DemandaList
          demandas={demandaList}
          groupBy={filters.agrupar}
          filtersActive={filtersActive}
        />
      </div>
    </PageContainer>
  );
}
