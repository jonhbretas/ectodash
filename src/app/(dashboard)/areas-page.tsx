// Shared área-breakdown page logic for Projetos and Pesquisas — both
// render the same card list of áreas with demanda counts, differing only in
// which áreas are included: projetos shows every área, pesquisas narrows to
// áreas whose name contains "pesquisa" (the institution's research areas).
// All counts are derived from ONE role-scoped read of demandas_com_status —
// the caller's RLS grant already decides what rows exist, so a voluntário
// sees only their own áreas' numbers.
import Link from "next/link";
import { FolderKanban, FlaskConical, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "./page-container";

type AreaCount = { area: string; count: number; overdueCount: number };

const SEM_AREA_DEFINIDA = "Sem área definida";

function buildAreaCounts(rows: { area: string | null; atrasada: boolean }[]): AreaCount[] {
  const counts = new Map<string, { count: number; overdueCount: number }>();
  for (const row of rows) {
    const key = row.area?.trim() || SEM_AREA_DEFINIDA;
    const existing = counts.get(key) ?? { count: 0, overdueCount: 0 };
    existing.count += 1;
    if (row.atrasada) existing.overdueCount += 1;
    counts.set(key, existing);
  }
  return [...counts.entries()]
    .map(([area, { count, overdueCount }]) => ({ area, count, overdueCount }))
    .sort((a, b) => {
      if (a.area === SEM_AREA_DEFINIDA) return 1;
      if (b.area === SEM_AREA_DEFINIDA) return -1;
      return a.area.localeCompare(b.area);
    });
}

export default async function AreasPage({
  kind,
}: {
  kind: "projetos" | "pesquisas";
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: rows } = await supabase
    .from("demandas_com_status")
    .select("area, atrasada");

  const all = buildAreaCounts(rows ?? []);
  const areas =
    kind === "pesquisas"
      ? all.filter((row) => row.area.toLowerCase().includes("pesquisa"))
      : all;

  const Icon = kind === "projetos" ? FolderKanban : FlaskConical;
  const title = kind === "projetos" ? "Projetos" : "Pesquisas";
  const description =
    kind === "projetos"
      ? "Áreas e projetos com demandas cadastradas."
      : "Áreas de pesquisa da instituição e suas demandas.";

  return (
    <PageContainer>
      <div className="flex w-full max-w-4xl flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <Icon size={28} aria-hidden="true" />
          {title}
        </h1>
        <p className="text-base text-zinc-700">{description}</p>
      </div>

      {areas.length === 0 ? (
        <div className="flex w-full max-w-4xl flex-col items-center gap-4 py-16 text-center">
          <Icon size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhuma {kind === "projetos" ? "área ou projeto" : "área de pesquisa"} cadastrada ainda
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            Quando uma demanda for criada com uma {kind === "projetos" ? "área" : "área de pesquisa"}, ela aparece aqui.
          </p>
          <Link
            href="/demandas/nova"
            className="flex min-h-14 items-center justify-center rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Nova demanda
          </Link>
        </div>
      ) : (
        <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
          {areas.map((area) => (
            <Link
              key={area.area}
              href={`/?area=${encodeURIComponent(area.area)}`}
              className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <span className="flex items-center gap-2 text-xl font-semibold text-zinc-900">
                <ClipboardList size={20} aria-hidden="true" />
                {area.area}
              </span>
              <span className="text-base text-zinc-700">
                {area.count} {area.count === 1 ? "demanda" : "demandas"}
                {area.overdueCount > 0 && (
                  <span className="ml-2 font-medium text-red-700">
                    {area.overdueCount} atrasada{area.overdueCount > 1 ? "s" : ""}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
