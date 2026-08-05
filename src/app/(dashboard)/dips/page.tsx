// /dips — Dinâmica DIP tracker com agenda por localidade.
// Cada DIP (localidade) tem sua própria "agenda": registros passados
// (vindos de atas analisadas) + próximas DIPs planejadas.
// Filtro por localidade permite focar em uma DIP específica.
import Link from "next/link";
import { Globe2, MapPin, Sparkles, Users, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import DipEntry, { type DipRow } from "./dip-entry";
import LocalidadesConfig from "./localidades-config";
import { slugify } from "@/lib/slug";

export default async function DipsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = await searchParams;
  const filterLocalidade = typeof raw.localidade === "string" ? raw.localidade : undefined;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [dipsResult, atasResult, profileResult, localidadesResult] = await Promise.all([
    supabase
      .from("dips")
      .select("id, localidade, pais, data_dip, participantes, observacoes, ata_id, criado_por")
      .order("data_dip", { ascending: false }),
    supabase.from("reunioes").select("id, titulo, data_reuniao"),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("dip_localidades").select("id, localidade, pais").order("localidade"),
  ]);

  const isCoordenadorGeral = profileResult.data?.role === "coordenador_geral";
  const localidadesCadastradas = (localidadesResult.data ?? []).map((l) => ({
    localidade: l.localidade,
    pais: l.pais,
  }));

  const ataById = new Map((atasResult.data ?? []).map((ata) => [ata.id, ata]));

  const rows: DipRow[] = (dipsResult.data ?? []).map((dip) => {
    const ata = ataById.get(dip.ata_id);
    return {
      id: dip.id, localidade: dip.localidade, pais: dip.pais,
      data_dip: dip.data_dip, participantes: dip.participantes,
      observacoes: dip.observacoes, ataId: dip.ata_id,
      ataTitulo: ata?.titulo ?? "Ata removida",
      ataData: ata?.data_reuniao ?? "",
      criadoPor: dip.criado_por,
    };
  });

  const paises = [...new Set(rows.map((r) => r.pais))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const localidades = [...new Set(rows.map((r) => r.localidade))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const totalParticipantes = rows.reduce((sum, row) => sum + (row.participantes ?? 0), 0);

  const today = new Date().toISOString().slice(0, 10);

  // Group: país → localidade → agenda (past + future)
  const filteredLocalidades = filterLocalidade
    ? localidades.filter((l) => l === filterLocalidade)
    : localidades;

  const groups = paises
    .map((pais) => ({
      pais,
      localidades: filteredLocalidades
        .filter((localidade) => rows.some((row) => row.pais === pais && row.localidade === localidade))
        .map((localidade) => {
          const todos = rows
            .filter((row) => row.pais === pais && row.localidade === localidade)
            .sort((a, b) => (b.data_dip ?? "").localeCompare(a.data_dip ?? ""));
          const passados = todos.filter((r) => (r.data_dip ?? "") <= today);
          const futuros = todos.filter((r) => (r.data_dip ?? "") > today);
          return { localidade, todos, passados, futuros };
        }),
    }))
    .filter((group) => group.localidades.length > 0);

  return (
    <PageContainer>
      <header className="flex w-full flex-col gap-1">
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
          <Sparkles size={30} aria-hidden="true" />
          Dinâmica DIP
        </h1>
        <p className="max-w-2xl text-xl text-zinc-500">
          Agenda e histórico das dinâmicas DIP por localidade.
        </p>
      </header>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatPill icon={<Sparkles size={24} className="text-blue-500" />} label="Registros" value={rows.length} />
        <StatPill icon={<Globe2 size={24} className="text-green-600" />} label="Países" value={paises.length} />
        <StatPill icon={<MapPin size={24} className="text-amber-500" />} label="Localidades" value={localidades.length} />
        <StatPill icon={<Users size={24} className="text-purple-500" />} label="Participantes" value={totalParticipantes} />
      </div>

      {localidades.length > 1 && (
        <div className="flex w-full flex-wrap items-center gap-2">
          <span className="text-base font-medium text-zinc-600">Filtrar por localidade:</span>
          {filterLocalidade ? (
            <Link href="/dips" className="rounded-full bg-zinc-100 px-3 py-1 text-base font-medium text-zinc-700 ring-1 ring-zinc-200/60 transition-colors hover:bg-zinc-200">
              Limpar filtro
            </Link>
          ) : null}
          {localidades.map((loc) => (
            <Link
              key={loc}
              href={`/dips?localidade=${encodeURIComponent(loc)}`}
              className={`rounded-full px-3 py-1 text-base font-medium transition-colors ring-1 ${
                filterLocalidade === loc
                  ? "bg-blue-700 text-white ring-blue-700"
                  : "bg-white text-zinc-700 ring-zinc-200/60 hover:bg-zinc-50"
              }`}
            >
              {loc}
            </Link>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <Sparkles size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">Nenhuma DIP registrada ainda</h2>
          <p className="max-w-md text-xl text-zinc-700">
            Quando uma reunião analisada mencionar a Dinâmica DIP, os registros aparecem aqui.
          </p>
          <Link
            href="/analisar"
            className="flex min-h-14 items-center justify-center rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Analisar reunião por IA
          </Link>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-8">
          {groups.map((group) => (
            <section key={group.pais} className="flex w-full flex-col gap-5">
              <div className="flex items-center gap-3">
                <span className="h-8 w-1.5 rounded-full bg-green-600" aria-hidden="true" />
                <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900 sm:text-3xl">
                  <Globe2 size={26} aria-hidden="true" className="text-green-600" />
                  {group.pais}
                </h2>
              </div>

              <div className="grid w-full grid-cols-1 gap-5 xl:grid-cols-2">
                {group.localidades.map((local) => (
                  <section
                    key={local.localidade}
                    className="flex w-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
                    aria-label={`Agenda da DIP ${local.localidade}`}
                  >
                    <h3 className="flex items-center gap-2 text-xl font-semibold text-zinc-900">
                      <MapPin size={20} aria-hidden="true" className="text-amber-500" />
                      <Link
                        href={`/dips/${slugify(local.localidade)}`}
                        className="transition-colors hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                        title={`Ver página da DIP ${local.localidade}`}
                      >
                        {local.localidade}
                      </Link>
                      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-base font-medium text-zinc-600">
                        {local.todos.length} {local.todos.length === 1 ? "registro" : "registros"}
                      </span>
                    </h3>

                    {local.futuros.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <h4 className="flex items-center gap-1.5 text-base font-semibold text-blue-700">
                          <CalendarDays size={16} aria-hidden="true" />
                          Próximas DIPs
                        </h4>
                        <div className="flex flex-col">
                          {local.futuros.map((r, i) => (
                            <DipEntry
                              key={r.id}
                              registro={r}
                              index={i}
                              isLast={i === local.futuros.length - 1}
                              highlight
                              canManage={r.criadoPor === user.id || isCoordenadorGeral}
                              localidades={localidadesCadastradas}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {local.passados.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <h4 className="flex items-center gap-1.5 text-base font-semibold text-zinc-600">
                          <CalendarDays size={16} aria-hidden="true" />
                          Histórico
                        </h4>
                        <div className="flex flex-col">
                          {local.passados.map((r, i) => (
                            <DipEntry
                              key={r.id}
                              registro={r}
                              index={i}
                              isLast={i === local.passados.length - 1}
                              canManage={r.criadoPor === user.id || isCoordenadorGeral}
                              localidades={localidadesCadastradas}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {isCoordenadorGeral && (
        <LocalidadesConfig
          localidades={(localidadesResult.data ?? []).map((l) => ({
            id: l.id,
            localidade: l.localidade,
            pais: l.pais,
          }))}
        />
      )}
    </PageContainer>
  );
}

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
      {icon}
      <div className="flex flex-col">
        <span className="text-base font-medium text-zinc-500">{label}</span>
        <span className="text-2xl font-semibold text-zinc-900">{value}</span>
      </div>
    </div>
  );
}
