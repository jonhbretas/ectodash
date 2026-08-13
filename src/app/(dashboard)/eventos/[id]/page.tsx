// /eventos/[id] — event management screen, modernized in the demandas
// visual language: full-width header with meta pills, action toolbar,
// stat pills for task counts, and the kanban board spanning the whole
// width.
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  MapPin,
  PlusCircle,
  Tag,
  CalendarPlus,
  FileSignature,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";
import PageContainer from "../../page-container";
import KanbanArea from "../../demandas/kanban-area";
import AdicionarTarefasButton from "./adicionar-tarefas-button";
import EditarEventoPanel from "../editar-evento-panel";

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

  const [eventoResult, demandasResult, profileResult] = await Promise.all([
    supabase
      .from("eventos")
      .select("id, titulo, descricao, data_evento, local, tipo_evento_id, criado_por")
      .eq("id", id)
      .single(),
    supabase
      .from("demandas_com_status")
      .select("id, titulo, prazo, status, area, atrasada")
      .eq("evento_id", id)
      .order("prazo", { ascending: true }),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
  ]);

  if (eventoResult.error || !eventoResult.data) {
    return (
      <PageContainer>
        <p className="text-xl text-zinc-700">Evento não encontrado.</p>
        <Link
          href="/eventos"
          className="text-xl font-medium text-[#2195B9] underline"
        >
          Voltar para os eventos
        </Link>
      </PageContainer>
    );
  }

  const evento = eventoResult.data;
  const rawDemandas = demandasResult.data ?? [];

  // UX gate mirroring RLS 0008: only the creator or a coordenador_geral
  // sees the edit panel (RLS is the real boundary).
  const canEdit =
    evento.criado_por === user.id ||
    profileResult.data?.role === "coordenador_geral";

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

  const dataLabel = format(
    new Date(`${evento.data_evento}T00:00:00`),
    "EEEE, dd 'de' MMMM 'de' yyyy",
    { locale: ptBR }
  );

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <CalendarDays size={30} aria-hidden="true" />
            {evento.titulo}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-lg text-zinc-600">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={18} aria-hidden="true" />
              {dataLabel}
            </span>
            {evento.local && (
              <span className="flex items-center gap-1.5">
                <MapPin size={18} aria-hidden="true" />
                {evento.local}
              </span>
            )}
            {evento.tipo_evento_id && (
              <TipoBadge tipoId={evento.tipo_evento_id} supabase={supabase} />
            )}
          </div>
          {evento.descricao && (
            <p className="max-w-3xl text-xl leading-relaxed text-zinc-600">
              {evento.descricao}
            </p>
          )}
        </div>
        <Link
          href="/eventos"
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-xl font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          <ArrowLeft size={22} aria-hidden="true" />
          Voltar aos eventos
        </Link>
      </header>

      <div className="flex w-full flex-wrap items-start gap-3">
        <AdicionarTarefasButton eventoId={id} />
        {profileResult.data?.role === "coordenador_geral" && (
          <Link
            href={`/eventos/${id}/contratos`}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-5 text-xl font-medium text-white transition-colors hover:bg-[#28627B]"
          >
            <FileSignature size={22} aria-hidden="true" />
            Contratos do evento
          </Link>
        )}
        <Link
          href="/demandas/nova"
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-xl font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          <PlusCircle size={22} aria-hidden="true" />
          Criar demanda
        </Link>
        {canEdit && (
          <EditarEventoPanel
            evento={{
              id: evento.id,
              titulo: evento.titulo,
              data_evento: evento.data_evento,
              local: evento.local,
              descricao: evento.descricao,
            }}
          />
        )}
      </div>

      {/* Stats — modern pills with semantic grouping, like the demandas
          screen. */}
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        <div
          role="group"
          aria-label={`${total} ${total === 1 ? "tarefa" : "tarefas"} no total`}
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
        >
          <ClipboardList size={24} className="text-zinc-500" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-base font-medium text-zinc-500">Tarefas</span>
            <span className="text-2xl font-semibold text-zinc-900">{total}</span>
          </div>
        </div>
        <div
          role="group"
          aria-label={`${pendentes} ${pendentes === 1 ? "tarefa pendente" : "tarefas pendentes"}`}
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
        >
          <Clock size={24} className="text-amber-500" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-base font-medium text-zinc-500">Pendentes</span>
            <span className="text-2xl font-semibold text-zinc-900">{pendentes}</span>
          </div>
        </div>
        <div
          role="group"
          aria-label={`${concluidas} ${concluidas === 1 ? "tarefa concluída" : "tarefas concluídas"}`}
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
        >
          <CheckCircle2 size={24} className="text-green-500" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-base font-medium text-zinc-500">Concluídas</span>
            <span className="text-2xl font-semibold text-zinc-900">{concluidas}</span>
          </div>
        </div>
      </div>

      {total === 0 ? (
        <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
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
        <KanbanArea
          key={`evento-${id}`}
          demandas={demandas}
          canGerir={
            profileResult.data?.role === "coordenador_geral" ||
            profileResult.data?.role === "coordenador_area"
          }
        />
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
    <span className="flex items-center gap-1 rounded-full bg-purple-50 px-3 py-1 text-base font-medium text-purple-800 ring-1 ring-purple-200/60">
      <Tag size={14} aria-hidden="true" />
      {data.nome}
    </span>
  );
}
