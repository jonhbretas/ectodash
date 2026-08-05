// /dips/[slug] — página interna de uma localidade da Dinâmica DIP: cabeçalho
// com país e contagem, resumo, próximas DIPs planejadas e o histórico de
// registros (cada um ligado à ata de origem). O slug é derivado do nome
// (slugify); colisões de slug entre localidades diferentes são tratadas
// como "não encontrada" para nunca mostrar a agenda errada.
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Globe2,
  History,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../page-container";
import DipEntry, { type DipRow } from "../dip-entry";
import { slugify } from "@/lib/slug";

type DipLocalidadePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function DipLocalidadePage({
  params,
}: DipLocalidadePageProps) {
  const { slug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [dipsResult, atasResult, profileResult] = await Promise.all([
    supabase
      .from("dips")
      .select("id, localidade, pais, data_dip, participantes, observacoes, ata_id, criado_por")
      .order("data_dip", { ascending: false }),
    supabase.from("reunioes").select("id, titulo, data_reuniao"),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
  ]);

  const isCoordenadorGeral = profileResult.data?.role === "coordenador_geral";
  const ataById = new Map((atasResult.data ?? []).map((ata) => [ata.id, ata]));

  // Resolve o slug para a localidade real — exige match ÚNICO.
  const localidades = [
    ...new Set((dipsResult.data ?? []).map((dip) => dip.localidade)),
  ];
  const correspondentes = localidades.filter(
    (localidade) => slugify(localidade) === slug
  );
  if (correspondentes.length !== 1) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <MapPin size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">
            Localidade não encontrada
          </h1>
          <Link
            href="/dips"
            className="flex min-h-14 items-center justify-center rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Voltar para a Dinâmica DIP
          </Link>
        </div>
      </PageContainer>
    );
  }

  const localidade = correspondentes[0];

  const rows: DipRow[] = (dipsResult.data ?? [])
    .filter((dip) => dip.localidade === localidade)
    .map((dip) => {
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
        criadoPor: dip.criado_por,
      };
    });

  const paises = [...new Set(rows.map((r) => r.pais))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
  const totalParticipantes = rows.reduce(
    (sum, row) => sum + (row.participantes ?? 0),
    0
  );

  const today = new Date().toISOString().slice(0, 10);
  const futuros = rows.filter((r) => (r.data_dip ?? "") > today);
  const passados = rows.filter((r) => (r.data_dip ?? "") <= today);

  const canManage = (criadoPor: string) =>
    criadoPor === user.id || isCoordenadorGeral;

  return (
    <PageContainer>
      <Link
        href="/dips"
        className="inline-flex w-fit items-center gap-1.5 text-base font-medium text-zinc-400 transition-colors hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar para a Dinâmica DIP
      </Link>

      <header className="flex w-full flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <MapPin size={30} aria-hidden="true" className="text-amber-500" />
            {localidade}
          </h1>
          {paises.map((pais) => (
            <span
              key={pais}
              className="flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-base font-medium text-green-800 ring-1 ring-green-200/60"
            >
              <Globe2 size={14} aria-hidden="true" />
              {pais}
            </span>
          ))}
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-base font-medium text-zinc-600">
            {rows.length} {rows.length === 1 ? "registro" : "registros"}
          </span>
        </div>
        <p className="max-w-2xl text-xl text-zinc-500">
          Histórico e próximas dinâmicas DIP desta localidade.
        </p>
      </header>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        <StatPill
          icon={<Sparkles size={24} className="text-blue-500" aria-hidden="true" />}
          label="Registros"
          value={rows.length}
        />
        <StatPill
          icon={<Users size={24} className="text-purple-500" aria-hidden="true" />}
          label="Participantes"
          value={totalParticipantes}
        />
        <StatPill
          icon={<CalendarDays size={24} className="text-blue-500" aria-hidden="true" />}
          label="Próximas DIPs"
          value={futuros.length}
        />
      </div>

      <div className="flex w-full flex-col gap-8">
        {futuros.length > 0 && (
          <section className="flex w-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
              <CalendarDays size={22} aria-hidden="true" className="text-blue-600" />
              Próximas DIPs
            </h2>
            <div className="flex flex-col">
              {futuros.map((r, i) => (
                <DipEntry
                  key={r.id}
                  registro={r}
                  index={i}
                  isLast={i === futuros.length - 1}
                  highlight
                  canManage={canManage(r.criadoPor)}
                />
              ))}
            </div>
          </section>
        )}

        <section className="flex w-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
            <History size={22} aria-hidden="true" className="text-zinc-600" />
            Histórico ({passados.length})
          </h2>
          {passados.length === 0 ? (
            <p className="text-lg text-zinc-600">
              Nenhum registro passado desta localidade ainda.
            </p>
          ) : (
            <div className="flex flex-col">
              {passados.map((r, i) => (
                <DipEntry
                  key={r.id}
                  registro={r}
                  index={i}
                  isLast={i === passados.length - 1}
                  canManage={canManage(r.criadoPor)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
}

function StatPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
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
