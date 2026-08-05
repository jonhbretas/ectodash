// /reunioes — meeting minutes list, full-width in the same visual language
// as /eventos: atas grouped by month with prominent month headers and
// date-box + card agenda rows. Each card summarizes the structured ata
// (resumo, participantes, deliberações, DIPs vinculadas) and links to the
// full view.
import Link from "next/link";
import {
  CalendarDays,
  FileText,
  MessageSquareText,
  NotebookPen,
  PlusCircle,
  Sparkles,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";

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

  // RLS (migration 0007): every authenticated volunteer reads every ata.
  const [atasResult, dipsResult] = await Promise.all([
    supabase
      .from("reunioes")
      .select("id, titulo, data_reuniao, horario, resumo, participantes, deliberacoes")
      .order("data_reuniao", { ascending: false }),
    supabase.from("dips").select("ata_id"),
  ]);

  const dipCountByAta = new Map<number, number>();
  for (const row of dipsResult.data ?? []) {
    dipCountByAta.set(row.ata_id, (dipCountByAta.get(row.ata_id) ?? 0) + 1);
  }

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

  const meses = groupByMonth(rows);

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <NotebookPen size={30} aria-hidden="true" />
            Atas de Reuniões
          </h1>
          <p className="text-xl text-zinc-500">
            Histórico das reuniões — resumos, deliberações e DIPs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/analisar"
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-xl font-medium text-white shadow-[0_1px_3px_rgba(29,78,216,0.25)] transition-all duration-200 hover:bg-blue-600 hover:shadow-[0_2px_6px_rgba(29,78,216,0.3)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <Sparkles size={22} aria-hidden="true" />
            Analisar por IA
          </Link>
          <Link
            href="/reunioes/nova"
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-xl font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <PlusCircle size={22} aria-hidden="true" />
            Registrar manual
          </Link>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <NotebookPen size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhuma ata registrada ainda
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            Envie a transcrição de uma reunião para a IA gerar a ata,
            demandas e DIPs automaticamente — ou registre manualmente.
          </p>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-10">
          {meses.map((group) => (
            <section
              key={group.key}
              className="flex w-full flex-col gap-3"
              aria-label={monthLabel(group.key)}
            >
              <div className="flex items-center gap-3">
                <span className="h-8 w-1.5 rounded-full bg-blue-600" aria-hidden="true" />
                <h2 className="text-2xl font-semibold text-zinc-900 sm:text-3xl">
                  {monthLabel(group.key)}
                </h2>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-base font-medium text-blue-800">
                  {group.rows.length} {group.rows.length === 1 ? "ata" : "atas"}
                </span>
              </div>
              <div className="flex w-full flex-col gap-3">
                {group.rows.map((ata) => (
                  <AtaAgendaRow key={ata.id} ata={ata} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
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
        className="flex min-w-0 flex-1 flex-col gap-2 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60 transition-all duration-200 hover:shadow-[0_2px_6px_rgba(0,0,0,0.06)] hover:ring-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="min-w-0 text-xl font-semibold text-zinc-900">
            {ata.titulo}
          </h3>
          <span className="flex shrink-0 flex-wrap items-center gap-1.5 text-base text-zinc-500">
            {participantesCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-base text-zinc-700">
                <Users size={14} aria-hidden="true" />
                {participantesCount}
              </span>
            )}
            {deliberacoesCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-base text-zinc-700">
                <MessageSquareText size={14} aria-hidden="true" />
                {deliberacoesCount} {deliberacoesCount === 1 ? "deliberação" : "deliberações"}
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
        <span className="mt-auto flex items-center gap-1.5 pt-1 text-base font-medium text-blue-700 underline decoration-blue-700/40 underline-offset-4">
          <FileText size={16} aria-hidden="true" />
          Ver ata completa
        </span>
      </Link>
    </article>
  );
}
