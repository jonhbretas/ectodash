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
      <div className="flex w-full flex-col gap-2">
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-[0_2px_8px_rgba(37,99,235,0.25)]">
            <Icon size={20} className="text-white" aria-hidden="true" strokeWidth={1.75} />
          </div>
          {title}
        </h1>
        <p className="text-sm text-slate-500">{description}</p>
      </div>

      {areas.length === 0 ? (
        <div className="flex w-full flex-col items-center gap-4 py-16 text-center">
          <Icon size={48} className="text-slate-300" aria-hidden="true" />
          <h2 className="text-2xl font-semibold text-slate-900">
            Nenhuma {kind === "projetos" ? "área ou projeto" : "área de pesquisa"} cadastrada ainda
          </h2>
          <p className="max-w-md text-sm text-slate-600">
            Quando uma demanda for criada com uma {kind === "projetos" ? "área" : "área de pesquisa"}, ela aparece aqui.
          </p>
          <Link
            href="/demandas/nova"
            className="flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)] transition-all duration-200 hover:from-blue-700 hover:to-blue-600 hover:shadow-[0_4px_12px_rgba(37,99,235,0.35)] hover:-translate-y-0.5"
          >
            Nova demanda
          </Link>
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {areas.map((area) => (
            <Link
              key={area.area}
              href={`/?area=${encodeURIComponent(area.area)}`}
              className="group flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60 transition-all duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:ring-blue-200/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 group-hover:bg-blue-50 transition-colors duration-200">
                  <ClipboardList size={16} className="text-slate-500 group-hover:text-blue-600 transition-colors duration-200" aria-hidden="true" strokeWidth={1.75} />
                </div>
                <span className="truncate text-sm font-semibold text-slate-900">{area.area}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-600">
                  {area.count} {area.count === 1 ? "demanda" : "demandas"}
                </span>
                {area.overdueCount > 0 && (
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 ring-1 ring-red-200/60">
                    {area.overdueCount} atrasada{area.overdueCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
