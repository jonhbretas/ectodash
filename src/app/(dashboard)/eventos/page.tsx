// /eventos — agenda-style event list, full-width like the demandas screen.
// Events are grouped by month with prominent month headers; each event is
// a date-box + card row (classic agenda layout) that links to its
// management screen. "Próximos eventos" is the agenda proper; past events
// collapse into a details block, also grouped by month. A search bar
// (client-side, eventos-lista.tsx) filters everything by title/local/desc.
import Link from "next/link";
import { CalendarDays, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import EventosLista, { type EventoRow } from "./eventos-lista";
import ImportEventosToggle from "./import-toggle";
import MergeEventosSection, { type EventoMergeOpcao } from "./merge-eventos-section";
import BotaoMesclarEventos from "./botao-mesclar-eventos";

export default async function EventosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isCoordenador = profile?.role === "coordenador_geral";

  // RLS (migration 0008): every authenticated volunteer reads every event.
  const [proximosResult, anterioresResult, tiposResult, mergeResult] = await Promise.all([
    supabase
      .from("eventos")
      .select("id, titulo, descricao, data_evento, local, tipo_evento_id")
      .gte("data_evento", today)
      .order("data_evento", { ascending: true })
      .limit(200),
    supabase
      .from("eventos")
      .select("id, titulo, descricao, data_evento, local, tipo_evento_id")
      .lt("data_evento", today)
      .order("data_evento", { ascending: false })
      .limit(200),
    supabase.from("evento_tipos").select("id, nome"),
    // Merge options (coordinator only): enough history to find a duplicate.
    isCoordenador
      ? supabase
          .from("eventos")
          .select("id, titulo, data_evento, local")
          .order("data_evento", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: null, error: null }),
  ]);

  const tipoNomeById = new Map(
    (tiposResult.data ?? []).map((tipo) => [tipo.id, tipo.nome])
  );

  const toRow = (row: {
    id: number;
    titulo: string;
    descricao: string | null;
    data_evento: string;
    local: string | null;
    tipo_evento_id: number | null;
  }): EventoRow => ({
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    data_evento: row.data_evento,
    local: row.local,
    tipo_nome: row.tipo_evento_id
      ? (tipoNomeById.get(row.tipo_evento_id) ?? null)
      : null,
  });

  const proximos: EventoRow[] = (proximosResult.data ?? []).map(toRow);
  const anteriores: EventoRow[] = (anterioresResult.data ?? []).map(toRow);

  const eventosMerge: EventoMergeOpcao[] = (mergeResult.data ?? []).map((e) => ({
    id: e.id,
    titulo: e.titulo,
    data_evento: e.data_evento,
    local: e.local,
  }));

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <CalendarDays size={30} aria-hidden="true" />
            Eventos
          </h1>
          <p className="text-xl text-zinc-500">
            Agenda da instituição — próximos eventos por mês.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isCoordenador && (
            <BotaoMesclarEventos />
          )}
          {isCoordenador && (
            <Link
              href="/eventos/modelos"
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-xl font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            >
              <Settings2 size={22} aria-hidden="true" />
              Modelos
            </Link>
          )}
          <ImportEventosToggle />
        </div>
      </header>

      {proximos.length === 0 && anteriores.length === 0 ? (
        <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <CalendarDays size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhum evento cadastrado ainda
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            Cadastre os eventos pela planilha acima — e lembre que uma
            demanda pode ser vinculada a um evento na hora de criá-la.
          </p>
          <Link
            href="/demandas/nova"
            className="flex min-h-14 items-center justify-center rounded-lg bg-[#2195B9] px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            Criar demanda
          </Link>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-10">
          <EventosLista proximos={proximos} anteriores={anteriores} today={today} />

          {isCoordenador && <MergeEventosSection eventos={eventosMerge} />}
        </div>
      )}
    </PageContainer>
  );
}
