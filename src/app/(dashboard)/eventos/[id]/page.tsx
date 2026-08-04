import Link from "next/link";
import {
  CalendarDays,
  MapPin,
  PlusCircle,
  Sparkles,
  Tag,
  CalendarPlus,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";
import PageContainer from "../../page-container";
import KanbanBoard from "../../demandas/kanban-board";
import AdicionarTarefasButton from "./adicionar-tarefas-button";

type EventoPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EventoPage({ params }: EventoPageProps) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  if (!Number.isFinite(id)) {
    return (
      <PageContainer>
        <p className="text-xl text-zinc-700">Evento não encontrado.</p>
      </PageContainer>
    );
  }

  const [eventoResult, demandasResult] = await Promise.all([
    supabase
      .from("eventos")
      .select("id, titulo, descricao, data_evento, local, tipo_evento_id")
      .eq("id", id)
      .single(),
    supabase
      .from("demandas_com_status")
      .select("id, titulo, prazo, status, area, atrasada")
      .eq("evento_id", id)
      .order("prazo", { ascending: true }),
  ]);

  if (eventoResult.error || !eventoResult.data) {
    return (
      <PageContainer>
        <p className="text-xl text-zinc-700">Evento não encontrado.</p>
        <Link
          href="/eventos"
          className="text-xl font-medium text-blue-700 underline"
        >
          Voltar para os eventos
        </Link>
      </PageContainer>
    );
  }

  const evento = eventoResult.data;
  const rawDemandas = demandasResult.data ?? [];

  // Responsável display names for the kanban cards — one batched read over
  // the event's demandas.
  const demandaIds = rawDemandas.map((d) => d.id);
  const { data: links } = demandaIds.length
    ? await supabase
        .from("demanda_responsaveis")
        .select("demanda_id, profile_id, profiles(email, full_name)")
        .in("demanda_id", demandaIds)
    : { data: [] as never[] };

  const nomesPorDemanda = new Map<number, string[]>();
  for (const row of (links ?? []) as Array<{
    demanda_id: number;
    profiles: { email: string; full_name: string | null } | { email: string; full_name: string | null }[] | null;
  }>) {
    const profileRow = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (!profileRow) continue;
    const label = displayName(profileRow);
    const labels = nomesPorDemanda.get(row.demanda_id) ?? [];
    labels.push(label);
    nomesPorDemanda.set(row.demanda_id, labels);
  }

  const demandas = rawDemandas.map((d) => ({
    id: d.id,
    titulo: d.titulo,
    prazo: d.prazo,
    status: d.status,
    atrasada: d.atrasada,
    area: d.area,
    responsavelEmails: nomesPorDemanda.get(d.id) ?? [],
  }));

  const total = demandas.length;
  const concluidas = demandas.filter((d) => d.status === "concluida").length;
  const pendentes = demandas.filter((d) => d.status !== "concluida").length;

  return (
    <PageContainer>
      <div className="flex w-full max-w-5xl flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <CalendarDays size={28} aria-hidden="true" />
          {evento.titulo}
        </h1>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-zinc-700">
          <span>
            {format(new Date(`${evento.data_evento}T00:00:00`), "dd/MM/yyyy", {
              locale: ptBR,
            })}
          </span>
          {evento.local && (
            <span className="flex items-center gap-1">
              <MapPin size={16} aria-hidden="true" />
              {evento.local}
            </span>
          )}
          {evento.tipo_evento_id && (
            <TipoBadge tipoId={evento.tipo_evento_id} supabase={supabase} />
          )}
        </p>
        {evento.descricao && (
          <p className="text-base leading-relaxed text-zinc-700">
            {evento.descricao}
          </p>
        )}
      </div>

      <div className="flex w-full max-w-5xl flex-wrap items-center gap-3">
        <AdicionarTarefasButton eventoId={id} />
        <Link
          href="/demandas/nova"
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-400 bg-white px-4 py-3 text-xl font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <PlusCircle size={22} aria-hidden="true" />
          Nova demanda manual
        </Link>
        <Link
          href="/eventos"
          className="flex min-h-14 items-center justify-center rounded-xl border border-zinc-400 bg-white px-4 py-3 text-xl font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Voltar aos eventos
        </Link>
      </div>

      <div className="flex w-full max-w-5xl flex-wrap gap-2">
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-base text-zinc-700">
          {total} {total === 1 ? "tarefa" : "tarefas"}
        </span>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-base text-amber-900">
          {pendentes} pendentes
        </span>
        <span className="rounded-full bg-green-100 px-3 py-1 text-base text-green-900">
          {concluidas} concluídas
        </span>
      </div>

      {total === 0 ? (
        <div className="flex w-full max-w-5xl flex-col items-center gap-4 py-16 text-center">
          <CalendarPlus size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhuma tarefa neste evento ainda
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            Toque em &quot;Adicionar tarefas do modelo&quot; para criar todas
            as tarefas padrão deste tipo de evento de uma vez.
          </p>
        </div>
      ) : (
        <KanbanBoard key={`evento-${id}`} demandas={demandas} />
      )}
    </PageContainer>
  );
}

// Tipo name read — a single tiny lookup rendered inline; events without a
// tipo show nothing.
async function TipoBadge({
  tipoId,
  supabase,
}: {
  tipoId: number;
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  const { data } = await supabase
    .from("evento_tipos")
    .select("nome")
    .eq("id", tipoId)
    .single();

  if (!data) return null;
  return (
    <span className="flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-base font-medium text-purple-900">
      <Tag size={14} aria-hidden="true" />
      {data.nome}
    </span>
  );
}
