import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import { FolderKanban, ClipboardList } from "lucide-react";
import Link from "next/link";
import ProjetosClient from "./projetos-client";
import AreasPage from "../areas-page";

export default async function ProjetosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [projetosResult, areasResult] = await Promise.all([
    supabase.from("projetos").select("id, nome, descricao, area, status, created_at").order("nome"),
    supabase.from("areas_institucionais").select("id, nome, area_mae_id").order("nome"),
  ]);

  const projetos = (projetosResult.data ?? []) as Array<{
    id: number; nome: string; descricao: string | null; area: string | null;
    status: string; created_at: string;
  }>;
  const areas = (areasResult.data ?? []) as Array<{
    id: number; nome: string; area_mae_id: number | null;
  }>;

  // Demandas counts by area (from areas-page.tsx pattern)
  const { data: demandaRows } = await supabase
    .from("demandas_com_status")
    .select("area, atrasada");

  const areaCountsMap = new Map<string, { count: number; overdueCount: number }>();
  for (const row of demandaRows ?? []) {
    const key = row.area?.trim() || "Sem área definida";
    const existing = areaCountsMap.get(key) ?? { count: 0, overdueCount: 0 };
    existing.count += 1;
    if (row.atrasada) existing.overdueCount += 1;
    areaCountsMap.set(key, existing);
  }

  const areaBreakdown = [...areaCountsMap.entries()]
    .map(([area, { count, overdueCount }]) => ({ area, count, overdueCount }))
    .sort((a, b) => {
      if (a.area === "Sem área definida") return 1;
      if (b.area === "Sem área definida") return -1;
      return a.area.localeCompare(b.area);
    });

  const areaOptions = areas.map((a) => a.nome);
  const parentAreas = areas.filter((a) => !a.area_mae_id).map((a) => a.nome);

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <FolderKanban size={30} aria-hidden="true" />
            Projetos
          </h1>
          <p className="text-xl text-zinc-500">
            Gerencie os projetos da instituição e veja as demandas por área.
          </p>
        </div>
      </header>

      <section className="flex w-full flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="h-8 w-1.5 rounded-full bg-blue-600" aria-hidden="true" />
          <h2 className="text-2xl font-semibold text-zinc-900">Projetos cadastrados</h2>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-base font-medium text-blue-800">
            {projetos.length} {projetos.length === 1 ? "projeto" : "projetos"}
          </span>
        </div>

        <ProjetosClient projetos={projetos} areaOptions={areaOptions} />
      </section>

      <section className="flex w-full flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="h-8 w-1.5 rounded-full bg-purple-600" aria-hidden="true" />
          <h2 className="text-2xl font-semibold text-zinc-900">Demandas por área</h2>
        </div>

        {areaBreakdown.length === 0 ? (
          <p className="text-xl text-zinc-500 rounded-2xl bg-white p-5 ring-1 ring-zinc-200/60">
            Nenhuma demanda cadastrada ainda.
          </p>
        ) : (
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {areaBreakdown.map((area) => (
              <Link
                key={area.area}
                href={`/?area=${encodeURIComponent(area.area)}`}
                className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:bg-zinc-50"
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
      </section>
    </PageContainer>
  );
}
