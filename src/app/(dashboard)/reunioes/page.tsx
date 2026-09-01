// /reunioes — Reuniões hub: upcoming meeting agenda (pauta) + meeting
// minutes history. The top section shows the next weekly meeting (toda
// terça-feira) with the accumulated pauta list — topics volunteers and
// coordenadores requested ("pedir pauta") or that the AI surfaced as
// deferred from a previous ata. Below, the ata list keeps the /eventos
// visual language: grouped by month, date-box + card agenda rows.
import Link from "next/link";
import {
  CalendarClock,
  CheckCheck,
  Clock,
  FileText,
  ListChecks,
  MessageSquareText,
  NotebookPen,
  PlusCircle,
  Sparkles,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";
import { proximaTerca, HORARIO_REUNIAO } from "@/lib/proxima-reuniao";
import PageContainer from "../page-container";
import PautaForm from "./pauta-form";
import PautaItemActions from "./pauta-item-actions";

type AtaRow = {
  id: number;
  titulo: string;
  data_reuniao: string;
  horario: string | null;
  resumo: string | null;
  participantes: string | null;
  deliberacoes: string | null;
  dipCount: number;
};

type PautaRow = {
  id: number;
  titulo: string;
  contexto: string | null;
  status: "pendente" | "discutida";
  origem: "manual" | "ata";
  standBy: boolean;
  ataId: number | null;
  ataTitulo: string | null;
  ataDiscutidaId: number | null;
  ataDiscutidaTitulo: string | null;
  ataDiscutidaData: string | null;
  dataSolicitada: string | null;
  horarioSolicitado: string | null;
  reuniaoSelecionadaId: number | null;
  reuniaoSelecionadaTitulo: string | null;
  criadoPor: string;
  autor: string;
  createdAt: string;
};

const WEEKDAY_ABBR = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTH_ABBR = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function monthKey(iso: string): string {
  return format(new Date(`${iso}T00:00:00`), "MM/yyyy", { locale: ptBR });
}

function monthLabel(key: string): string {
  const [month, year] = key.split("/");
  const label = format(
    new Date(Number(year), Number(month) - 1, 1),
    "MMMM 'de' yyyy",
    { locale: ptBR }
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function groupByMonth(rows: AtaRow[]): Array<{ key: string; rows: AtaRow[] }> {
  const groups = new Map<string, AtaRow[]>();
  for (const row of rows) {
    const key = monthKey(row.data_reuniao);
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }
  return [...groups.entries()].map(([key, items]) => ({ key, rows: items }));
}

function countLines(value: string | null): number {
  if (!value) return 0;
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

export default async function ReunioesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // RLS (migration 0007/0076): every authenticated volunteer reads every ata
  // and every pauta.
  const [atasResult, dipsResult, pautasResult, profileResult] = await Promise.all([
    supabase
      .from("reunioes")
      .select("id, titulo, data_reuniao, horario, resumo, participantes, deliberacoes")
      .order("data_reuniao", { ascending: false }),
    supabase.from("dips").select("ata_id"),
    supabase
      .from("pautas")
      .select(
        "id, titulo, contexto, status, origem, stand_by, ata_id, ata_discutida_id, data_solicitada, horario_solicitado, reuniao_selecionada_id, criado_por, created_at, updated_at, profiles(full_name, email)"
      )
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
  ]);

  const dipCountByAta = new Map<number, number>();
  for (const row of dipsResult.data ?? []) {
    dipCountByAta.set(row.ata_id, (dipCountByAta.get(row.ata_id) ?? 0) + 1);
  }

  // Single source for ata titles (origin and discussed) — resolved in JS to
  // avoid the ambiguous PostgREST embed now that pautas has two FKs to
  // reunioes (ata_id and ata_discutida_id).
  const ataById = new Map<number, { titulo: string; data_reuniao: string }>();
  for (const row of atasResult.data ?? []) {
    ataById.set(row.id, { titulo: row.titulo, data_reuniao: row.data_reuniao });
  }

  const ataTitulo = (id: number | null): string | null =>
    id === null ? null : (ataById.get(id)?.titulo ?? null);

  const rows: AtaRow[] = (atasResult.data ?? []).map((row) => ({
    id: row.id,
    titulo: row.titulo,
    data_reuniao: row.data_reuniao,
    horario: row.horario,
    resumo: row.resumo,
    participantes: row.participantes,
    deliberacoes: row.deliberacoes,
    dipCount: dipCountByAta.get(row.id) ?? 0,
  }));

  const canManagePauta = profileResult.data?.role === "coordenador_geral";

  const pautas: PautaRow[] = (pautasResult.data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const ataDiscutidaData = row.ata_discutida_id
      ? (ataById.get(row.ata_discutida_id)?.data_reuniao ?? null)
      : null;
    return {
      id: row.id,
      titulo: row.titulo,
      contexto: row.contexto,
      status: row.status,
      origem: row.origem,
      standBy: row.stand_by,
      ataId: row.ata_id,
      ataTitulo: ataTitulo(row.ata_id),
      ataDiscutidaId: row.ata_discutida_id,
      ataDiscutidaTitulo: ataTitulo(row.ata_discutida_id),
      ataDiscutidaData,
      dataSolicitada: row.data_solicitada,
      horarioSolicitado: row.horario_solicitado,
      reuniaoSelecionadaId: row.reuniao_selecionada_id,
      reuniaoSelecionadaTitulo: ataTitulo(row.reuniao_selecionada_id),
      criadoPor: row.criado_por,
      autor: displayName({
        full_name: profile?.full_name ?? null,
        email: profile?.email ?? null,
      }),
      createdAt: row.created_at,
    };
  });

  const pendentes = pautas.filter((p) => p.status === "pendente" && !p.standBy);
  const emEspera = pautas.filter((p) => p.status === "pendente" && p.standBy);
  const discutidas = pautas.filter((p) => p.status === "discutida");

  const proxima = proximaTerca();
  const proximaDataStr = format(proxima, "yyyy-MM-dd");
  const proximaLabel = `${format(proxima, "EEEE, dd 'de' MMMM", { locale: ptBR })} · ${HORARIO_REUNIAO}`;

  // Encontrar a ata da próxima reunião (se existir)
  const ataProxima = rows.find((r) => r.data_reuniao === proximaDataStr) ?? null;

  const meses = groupByMonth(rows);

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <NotebookPen size={30} aria-hidden="true" />
            Reuniões
          </h1>
          <p className="text-xl text-zinc-500">
            Pauta da próxima reunião e histórico das atas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/analisar"
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-5 text-xl font-medium text-white shadow-[0_1px_3px_rgba(33,149,185,0.25)] transition-all duration-200 hover:bg-[#28627B] hover:shadow-[0_2px_6px_rgba(33,149,185,0.3)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            <Sparkles size={22} aria-hidden="true" />
            Analisar por IA
          </Link>
          <Link
            href="/reunioes/nova"
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-xl font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            <PlusCircle size={22} aria-hidden="true" />
            Registrar ata
          </Link>
        </div>
      </header>

      {/* ── Próxima reunião & Pauta ── */}
      <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
          <div className="flex flex-col gap-1">
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
              <CalendarClock size={24} aria-hidden="true" className="text-[#2195B9]" />
              Próxima reunião
            </h2>
            <p className="text-base capitalize text-zinc-500">{proximaLabel}</p>
          </div>
          <span className="rounded-full bg-[#E6E6E6] px-3 py-1 text-base font-medium text-[#28627B]">
            {pendentes.length}{" "}
            {pendentes.length === 1 ? "pauta pendente" : "pautas pendentes"}
          </span>
        </div>

        {ataProxima ? (
          <Link
            href={`/reunioes/${ataProxima.id}`}
            className="flex items-center gap-3 rounded-xl border border-[#2195B9]/20 bg-[#2195B9]/5 px-4 py-3 text-base text-[#2195B9] transition-colors hover:bg-[#2195B9]/10"
          >
            <FileText size={18} aria-hidden="true" />
            <span className="font-medium">{ataProxima.titulo}</span>
            <span className="text-sm text-zinc-500">· Ver ata</span>
          </Link>
        ) : (
          <p className="text-sm text-zinc-500">
            Nenhuma ata registrada para esta reunião ainda.
          </p>
        )}

        <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
          {/* Pendentes */}
          <div className="flex w-full flex-col gap-3">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
              <ListChecks size={20} aria-hidden="true" />
              O que será discutido
            </h3>
            {pendentes.length === 0 ? (
              <p className="text-base text-zinc-500">
                Nenhuma pauta para a próxima reunião ainda. Seja a primeira
                pessoa a sugerir um assunto.
              </p>
            ) : (
              <ol className="flex w-full flex-col gap-2">
                {pendentes.map((pauta, index) => (
                  <li
                    key={pauta.id}
                    className="flex flex-col gap-1.5 rounded-xl border border-zinc-200 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E6E6E6] text-sm font-semibold text-[#28627B]"
                      >
                        {index + 1}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-lg font-semibold leading-snug text-zinc-900">
                          {pauta.titulo}
                        </span>
                        <span className="text-sm text-zinc-500">
                          por {pauta.autor}
                          {pauta.ataTitulo
                            ? ` · da reunião "${pauta.ataTitulo}"`
                            : ""}
                        </span>
                        {(pauta.dataSolicitada || pauta.reuniaoSelecionadaTitulo) && (
                          <span className="flex flex-wrap items-center gap-2 text-sm text-[#2195B9]">
                            {pauta.dataSolicitada && (
                              <span className="flex items-center gap-1">
                                <CalendarClock size={13} aria-hidden="true" />
                                {format(new Date(`${pauta.dataSolicitada}T00:00:00`), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                                {pauta.horarioSolicitado && ` às ${pauta.horarioSolicitado.slice(0, 5)}`}
                              </span>
                            )}
                            {pauta.reuniaoSelecionadaTitulo && (
                              <span className="rounded-full bg-[#2195B9]/10 px-2 py-0.5 text-xs font-medium text-[#28627B]">
                                {pauta.reuniaoSelecionadaTitulo}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    {pauta.contexto && (
                      <p className="whitespace-pre-wrap pl-10 text-base leading-relaxed text-zinc-700">
                        {pauta.contexto}
                      </p>
                    )}
                    {(canManagePauta || pauta.criadoPor === user.id) && (
                      <div className="pl-10">
                        <PautaItemActions
                          pautaId={pauta.id}
                          status={pauta.status}
                          standBy={pauta.standBy}
                          atasDisponiveis={rows.map((r) => ({
                            id: r.id,
                            titulo: r.titulo,
                            data_reuniao: r.data_reuniao,
                          }))}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Pedir pauta */}
          <div className="flex w-full flex-col gap-2">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
              <PlusCircle size={20} aria-hidden="true" />
              Pedir pauta
            </h3>
            <p className="text-base text-zinc-500">
              Sugira um assunto para ser discutido na próxima reunião — todos
              os voluntários e coordenadores podem pedir.
            </p>
            <PautaForm />
          </div>
        </div>

        {emEspera.length > 0 && (
          <details className="group w-full rounded-xl border border-zinc-200 bg-zinc-50/60">
            <summary className="flex min-h-12 w-full cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2 text-base font-medium text-zinc-700">
                <Clock size={18} aria-hidden="true" className="text-zinc-500" />
                Em espera ({emEspera.length})
              </span>
              <span className="text-sm text-zinc-500">Expandir</span>
            </summary>
            <ul className="flex flex-col gap-1.5 border-t border-zinc-200 px-4 py-3">
              {emEspera.map((pauta) => (
                <li
                  key={pauta.id}
                  className="flex items-start gap-2 text-base text-zinc-500"
                >
                  <Clock size={16} aria-hidden="true" className="mt-1 shrink-0 text-zinc-400" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-zinc-700">
                      {pauta.titulo}
                    </span>
                    <span className="text-sm text-zinc-400">
                      por {pauta.autor}
                    </span>
                  </div>
                  {(canManagePauta || pauta.criadoPor === user.id) && (
                    <PautaItemActions
                      pautaId={pauta.id}
                      status={pauta.status}
                      standBy={pauta.standBy}
                      atasDisponiveis={rows.map((r) => ({
                        id: r.id,
                        titulo: r.titulo,
                        data_reuniao: r.data_reuniao,
                      }))}
                    />
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}

        {discutidas.length > 0 && (
          <details className="group w-full rounded-xl border border-zinc-200 bg-zinc-50/60">
            <summary className="flex min-h-12 w-full cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2 text-base font-medium text-zinc-700">
                <CheckCheck size={18} aria-hidden="true" className="text-green-600" />
                Já discutidas ({discutidas.length})
              </span>
              <span className="text-sm text-zinc-500">Expandir</span>
            </summary>
            <ul className="flex flex-col gap-1.5 border-t border-zinc-200 px-4 py-3">
              {discutidas.map((pauta) => (
                <li
                  key={pauta.id}
                  className="flex items-start gap-2 text-base text-zinc-500"
                >
                  <CheckCheck size={16} aria-hidden="true" className="mt-1 shrink-0 text-green-600" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-zinc-700 line-through decoration-zinc-300">
                      {pauta.titulo}
                    </span>
                    <span className="text-sm text-zinc-400">
                      por {pauta.autor}
                      {pauta.ataDiscutidaTitulo
                        ? ` · discutida na reunião "${pauta.ataDiscutidaTitulo}"`
                        : ""}
                    </span>
                    <span className="flex flex-wrap gap-3 text-xs text-zinc-400">
                      <span>
                        Criada em {format(new Date(pauta.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      {pauta.ataDiscutidaData && (
                        <span>
                          Discutida em {format(new Date(`${pauta.ataDiscutidaData}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                    </span>
                  </div>
                  {(canManagePauta || pauta.criadoPor === user.id) && (
                    <PautaItemActions
                      pautaId={pauta.id}
                      status={pauta.status}
                      atasDisponiveis={rows.map((r) => ({
                        id: r.id,
                        titulo: r.titulo,
                        data_reuniao: r.data_reuniao,
                      }))}
                    />
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* ── Log de Pautas por Reunião ── */}
      {discutidas.length > 0 && (
        <section className="flex w-full flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="h-8 w-1.5 rounded-full bg-green-600" aria-hidden="true" />
            <h2 className="text-2xl font-semibold text-zinc-900 sm:text-3xl">
              Log de Pautas
            </h2>
            <span className="rounded-full bg-green-100 px-3 py-1 text-base font-medium text-green-700">
              {discutidas.length} {discutidas.length === 1 ? "pauta" : "pautas"} discutidas
            </span>
          </div>
          <p className="text-base text-zinc-500">
            Pautas que foram solicitadas e discutidas nas reuniões (separado das atas completas).
          </p>
          <div className="flex w-full flex-col gap-4">
            {rows
              .filter((ata) => discutidas.some((p) => p.ataDiscutidaId === ata.id))
              .map((ata) => {
                const pautasDaAta = discutidas.filter((p) => p.ataDiscutidaId === ata.id);
                return (
                  <div
                    key={ata.id}
                    className="flex w-full flex-col gap-2 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
                  >
                    <div className="flex items-center gap-3 border-b border-zinc-100 pb-3">
                      <Link
                        href={`/reunioes/${ata.id}`}
                        className="flex items-center gap-2 text-lg font-semibold text-zinc-900 hover:text-[#2195B9]"
                      >
                        <FileText size={18} aria-hidden="true" />
                        {ata.titulo}
                      </Link>
                      <span className="text-sm text-zinc-500">
                        {format(new Date(`${ata.data_reuniao}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        {pautasDaAta.length} {pautasDaAta.length === 1 ? "pauta" : "pautas"}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {pautasDaAta.map((pauta) => (
                        <li
                          key={pauta.id}
                          className="flex items-start gap-2 text-sm text-zinc-600"
                        >
                          <CheckCheck size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-green-600" />
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="font-medium text-zinc-800">
                              {pauta.titulo}
                            </span>
                            <span className="text-xs text-zinc-400">
                              por {pauta.autor} · criada em {format(new Date(pauta.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* ── Atas ── */}
      <section className="flex w-full flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="h-8 w-1.5 rounded-full bg-[#2195B9]" aria-hidden="true" />
          <h2 className="text-2xl font-semibold text-zinc-900 sm:text-3xl">
            Atas
          </h2>
          <span className="rounded-full bg-[#E6E6E6] px-3 py-1 text-base font-medium text-[#28627B]">
            {rows.length} {rows.length === 1 ? "ata" : "atas"}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
            <NotebookPen size={48} className="text-zinc-400" aria-hidden="true" />
            <h3 className="text-3xl font-semibold text-zinc-900">
              Nenhuma ata registrada ainda
            </h3>
            <p className="max-w-md text-xl text-zinc-700">
              Envie a transcrição de uma reunião para a IA gerar a ata,
              demandas e DIPs automaticamente — ou registre manualmente.
            </p>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-10">
            {meses.map((group) => (
              <div key={group.key} className="flex w-full flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="h-6 w-1 rounded-full bg-zinc-200" aria-hidden="true" />
                  <h3 className="text-xl font-semibold text-zinc-700 sm:text-2xl">
                    {monthLabel(group.key)}
                  </h3>
                </div>
                <div className="flex w-full flex-col gap-3">
                  {group.rows.map((ata) => (
                    <AtaAgendaRow key={ata.id} ata={ata} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  );
}

function AtaAgendaRow({ ata }: { ata: AtaRow }) {
  const date = new Date(`${ata.data_reuniao}T00:00:00`);
  const participantesCount = countLines(ata.participantes);
  const deliberacoesCount = countLines(ata.deliberacoes);

  return (
    <article className="flex items-stretch gap-3 sm:gap-4">
      <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 self-stretch rounded-2xl bg-white px-2 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60 sm:w-20">
        <span className="text-sm font-medium uppercase text-zinc-500">
          {WEEKDAY_ABBR[date.getDay()]}
        </span>
        <span className="text-2xl font-semibold text-zinc-900 sm:text-3xl">
          {date.getDate()}
        </span>
        <span className="text-base font-medium text-zinc-500">
          {MONTH_ABBR[date.getMonth()]}
        </span>
        {ata.horario && (
          <span className="mt-1 rounded-full bg-zinc-100 px-2 py-0.5 text-sm font-medium text-zinc-700">
            {ata.horario.slice(0, 5)}
          </span>
        )}
      </div>

      <Link
        href={`/reunioes/${ata.id}`}
        className="flex min-w-0 flex-1 flex-col gap-2 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60 transition-all duration-200 hover:shadow-[0_2px_6px_rgba(0,0,0,0.06)] hover:ring-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="min-w-0 text-xl font-semibold text-zinc-900">
            {ata.titulo}
          </h3>
          <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-base text-zinc-500">
            {participantesCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-base text-zinc-700">
                <Users size={14} aria-hidden="true" />
                {participantesCount}
              </span>
            )}
            {deliberacoesCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-base text-zinc-700">
                <MessageSquareText size={14} aria-hidden="true" />
                {deliberacoesCount} {deliberacoesCount === 1 ? "tarefa" : "tarefas"}
              </span>
            )}
            {ata.dipCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-base text-purple-800 ring-1 ring-purple-200/60">
                <Users size={14} aria-hidden="true" />
                {ata.dipCount} {ata.dipCount === 1 ? "DIP" : "DIPs"}
              </span>
            )}
          </span>
        </div>
        {ata.resumo ? (
          <p className="line-clamp-2 text-base leading-relaxed text-zinc-600">
            {ata.resumo}
          </p>
        ) : (
          <p className="text-base text-zinc-500">Sem resumo registrado.</p>
        )}
        <span className="mt-auto flex items-center gap-1.5 pt-1 text-base font-medium text-[#2195B9] underline decoration-[#2195B9]/40 underline-offset-4">
          <FileText size={16} aria-hidden="true" />
          Ver ata completa
        </span>
      </Link>
    </article>
  );
}
