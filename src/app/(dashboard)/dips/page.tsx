// /dips — Dinâmica DIP tracker, isolated from the atas (user decision
// 2026-08-04: DIPs span 8 localidades across 3 countries, so they deserve
// their own screen). Every record comes from a meeting analysis — one row
// per mention, keeping full update history — and links back to its ata.
// Data is grouped país → localidade, with a summary strip on top.
import Link from "next/link";
import { Globe2, MapPin, Sparkles, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";

type DipRow = {
  id: number;
  localidade: string;
  pais: string;
  data_dip: string | null;
  participantes: number | null;
  observacoes: string | null;
  ataId: number;
  ataTitulo: string;
  ataData: string;
};

export default async function DipsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // dips is SELECT-open to every authenticated volunteer; the ata join is
  // one batched read resolved in memory (no nested select needed).
  const [dipsResult, atasResult] = await Promise.all([
    supabase
      .from("dips")
      .select("id, localidade, pais, data_dip, participantes, observacoes, ata_id")
      .order("data_dip", { ascending: false }),
    supabase.from("reunioes").select("id, titulo, data_reuniao"),
  ]);

  const ataById = new Map(
    (atasResult.data ?? []).map((ata) => [ata.id, ata])
  );

  const rows: DipRow[] = (dipsResult.data ?? []).map((dip) => {
    const ata = ataById.get(dip.ata_id);
    return {
      id: dip.id,
      localidade: dip.localidade,
      pais: dip.pais,
      data_dip: dip.data_dip,
      participantes: dip.participantes,
      observacoes: dip.observacoes,
      ataId: dip.ata_id,
      ataTitulo: ata?.titulo ?? "Ata removida",
      ataData: ata?.data_reuniao ?? "",
    };
  });

  const paises = [...new Set(rows.map((r) => r.pais))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
  const localidades = [...new Set(rows.map((r) => r.localidade))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
  const totalParticipantes = rows.reduce(
    (sum, row) => sum + (row.participantes ?? 0),
    0
  );

  // País -> localidade -> registros (most recent first).
  const groups = paises
    .map((pais) => ({
      pais,
      localidades: localidades
        .filter((localidade) =>
          rows.some((row) => row.pais === pais && row.localidade === localidade)
        )
        .map((localidade) => ({
          localidade,
          registros: rows
            .filter(
              (row) => row.pais === pais && row.localidade === localidade
            )
            .sort((a, b) => (b.data_dip ?? "").localeCompare(a.data_dip ?? "")),
        })),
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
          Registro das dinâmicas DIP por localidade e país — cada entrada
          vem de uma reunião analisada e mantém o histórico completo.
        </p>
      </header>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div
          role="group"
          aria-label={`${rows.length} ${rows.length === 1 ? "registro" : "registros"} no total`}
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
        >
          <Sparkles size={24} className="text-blue-500" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-base font-medium text-zinc-500">Registros</span>
            <span className="text-2xl font-semibold text-zinc-900">{rows.length}</span>
          </div>
        </div>
        <div
          role="group"
          aria-label={`${paises.length} ${paises.length === 1 ? "país" : "países"}`}
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
        >
          <Globe2 size={24} className="text-green-600" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-base font-medium text-zinc-500">Países</span>
            <span className="text-2xl font-semibold text-zinc-900">{paises.length}</span>
          </div>
        </div>
        <div
          role="group"
          aria-label={`${localidades.length} ${localidades.length === 1 ? "localidade" : "localidades"}`}
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
        >
          <MapPin size={24} className="text-amber-500" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-base font-medium text-zinc-500">Localidades</span>
            <span className="text-2xl font-semibold text-zinc-900">{localidades.length}</span>
          </div>
        </div>
        <div
          role="group"
          aria-label={`${totalParticipantes} participantes somados`}
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
        >
          <Users size={24} className="text-purple-500" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-base font-medium text-zinc-500">Participantes</span>
            <span className="text-2xl font-semibold text-zinc-900">{totalParticipantes}</span>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <Sparkles size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhuma DIP registrada ainda
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            Quando uma reunião analisada mencionar a Dinâmica DIP, os
            registros aparecem aqui — com localidade, país, data e
            participantes.
          </p>
          <Link
            href="/reunioes/analisar"
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
                <span className="rounded-full bg-green-50 px-3 py-1 text-base font-medium text-green-800">
                  {group.localidades.length} {group.localidades.length === 1 ? "localidade" : "localidades"}
                </span>
              </div>

              <div className="grid w-full grid-cols-1 gap-5 xl:grid-cols-2">
                {group.localidades.map((local) => (
                  <section
                    key={local.localidade}
                    className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
                    aria-label={local.localidade}
                  >
                    <h3 className="flex items-center gap-2 text-xl font-semibold text-zinc-900">
                      <MapPin size={20} aria-hidden="true" className="text-amber-500" />
                      {local.localidade}
                      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-base font-medium text-zinc-600">
                        {local.registros.length} {local.registros.length === 1 ? "registro" : "registros"}
                      </span>
                    </h3>

                    <div className="flex w-full flex-col">
                      {local.registros.map((registro, index) => (
                        <div
                          key={registro.id}
                          className={`flex flex-col gap-1 border-b border-zinc-100 py-3 last:border-b-0 ${
                            index === 0 ? "pt-0" : ""
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-2 text-lg font-medium text-zinc-900">
                              {registro.data_dip
                                ? format(new Date(`${registro.data_dip}T00:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                                : "Data não informada"}
                            </span>
                            {registro.participantes !== null && (
                              <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-base font-medium text-purple-800 ring-1 ring-purple-200/60">
                                {registro.participantes}{" "}
                                {registro.participantes === 1 ? "participante" : "participantes"}
                              </span>
                            )}
                          </div>
                          {registro.observacoes && (
                            <p className="text-base leading-relaxed text-zinc-700">
                              {registro.observacoes}
                            </p>
                          )}
                          <Link
                            href={`/reunioes/${registro.ataId}`}
                            className="w-fit text-base font-medium text-blue-700 underline decoration-blue-700/40 underline-offset-4"
                          >
                            {registro.ataTitulo}
                            {registro.ataData
                              ? ` — ${format(new Date(`${registro.ataData}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}`
                              : ""}
                          </Link>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
