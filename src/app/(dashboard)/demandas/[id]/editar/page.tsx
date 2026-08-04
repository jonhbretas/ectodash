import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Calendar } from "lucide-react";
import { displayName } from "@/lib/display-name";
import DemandaForm from "../../demanda-form";
import ConcludeButton from "../../conclude-button";
import DemandaChecklist from "../../demanda-checklist";
import DemandaComentarios from "../../demanda-comentarios";
import StatusBadge from "../../status-badge";
import OverdueBadge from "../../overdue-badge";
import type { DemandaFormValues } from "../../demanda-schema";
import PageContainer from "../../../page-container";

type EditarDemandaPageProps = {
  // Next.js 16: params is a Promise, must be awaited before reading route
  // segment values (app/[id]/page.tsx convention).
  params: Promise<{ id: string }>;
};

export default async function EditarDemandaPage({
  params,
}: EditarDemandaPageProps) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  const supabase = await createClient();

  if (!Number.isFinite(id)) {
    return (
      <PageContainer>
        <div className="flex w-full max-w-md flex-col items-center gap-4 py-16 text-center">
          <p className="text-xl text-zinc-500">Demanda não encontrada.</p>
          <Link
            href="/"
            className="text-xl font-medium text-blue-700 transition-colors hover:text-blue-600"
          >
            Voltar para a lista
          </Link>
        </div>
      </PageContainer>
    );
  }

  // demandas_com_status, not the bare table, stays the canonical read
  // source shared with the list view (plan 04-02's precedent).
  const { data: demanda } = await supabase
    .from("demandas_com_status")
    .select("id, titulo, prazo, status, area, projeto, evento_id, etiqueta_id, atrasada")
    .eq("id", id)
    .single();

  if (!demanda) {
    return (
      <PageContainer>
        <div className="flex w-full max-w-md flex-col items-center gap-4 py-16 text-center">
          <p className="text-xl text-zinc-500">Demanda não encontrada.</p>
          <Link
            href="/"
            className="text-xl font-medium text-blue-700 transition-colors hover:text-blue-600"
          >
            Voltar para a lista
          </Link>
        </div>
      </PageContainer>
    );
  }

  const [
    { data: responsaveis },
    { data: membros },
    { data: profiles },
    { data: eventos },
    { data: etiquetas },
    { data: checklistItems },
    { data: comentariosRaw },
  ] = await Promise.all([
    supabase
      .from("demanda_responsaveis")
      .select("profile_id")
      .eq("demanda_id", id),
    supabase
      .from("demanda_membros")
      .select("profile_id")
      .eq("demanda_id", id),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("ativo", true)
      .not("email", "ilike", "%example.invalid%")
      .order("email"),
    supabase
      .from("eventos")
      .select("id, titulo")
      .gte("data_evento", new Date().toISOString().slice(0, 10))
      .order("data_evento", { ascending: true })
      .limit(100),
    supabase.from("etiquetas").select("id, area, nome").order("area").order("nome"),
    supabase
      .from("demanda_checklist")
      .select("id, item, concluido")
      .eq("demanda_id", id)
      .order("id", { ascending: true }),
    supabase
      .from("demanda_comentarios")
      .select("id, conteudo, created_at, autor_id, profiles(full_name, email)")
      .eq("demanda_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const defaultValues: Partial<DemandaFormValues> & {
    eventoId?: number;
    etiquetaId?: number;
    membroIds?: string[];
  } = {
    titulo: demanda.titulo,
    responsavelIds: (responsaveis ?? []).map((row) => row.profile_id as string),
    prazo: demanda.prazo,
    status: demanda.status,
    area: demanda.area ?? undefined,
    projeto: demanda.projeto ?? undefined,
    eventoId: demanda.evento_id ?? undefined,
    etiquetaId: demanda.etiqueta_id ?? undefined,
    membroIds: (membros ?? []).map((row) => row.profile_id as string),
  };

  const comentarios = (comentariosRaw ?? []).map((row) => {
    const profileRow = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      autorNome: profileRow ? displayName(profileRow) : "Voluntário",
      conteudo: row.conteudo,
      createdAt: row.created_at,
    };
  });

  return (
    <PageContainer>
      {/* Header — title + status badges + metadata + back link. */}
      <div className="flex w-full flex-col gap-4">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-base font-medium text-zinc-500 transition-colors hover:text-zinc-700"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar para a lista
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold text-zinc-900">
            {demanda.titulo}
          </h1>
          <StatusBadge status={demanda.status} />
          {demanda.atrasada && <OverdueBadge prazo={demanda.prazo} />}
        </div>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xl text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={18} aria-hidden="true" />
            Prazo:{" "}
            {format(new Date(`${demanda.prazo}T00:00:00`), "dd/MM/yyyy", {
              locale: ptBR,
            })}
          </span>
          {demanda.area && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-base text-zinc-600">
              {demanda.area}
            </span>
          )}
          {demanda.projeto && (
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-base font-medium text-blue-700 ring-1 ring-blue-200/60">
              {demanda.projeto}
            </span>
          )}
        </p>
      </div>

      {/* Desktop: two-column grid (form | checklist + comments + conclude);
          mobile: stacked, one column. */}
      <div className="grid w-full grid-cols-1 items-start gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
            <h2 className="text-xl font-semibold text-zinc-900">
              Dados da demanda
            </h2>
            <DemandaForm
              mode="edit"
              wide
              demandaId={id}
              defaultValues={defaultValues}
              profiles={profiles ?? []}
              eventos={eventos ?? []}
              etiquetas={etiquetas ?? []}
            />
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
            <DemandaChecklist
              demandaId={id}
              items={(checklistItems ?? []).map((item) => ({
                id: item.id,
                item: item.item,
                concluido: item.concluido,
              }))}
            />
          </div>

          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
            <DemandaComentarios
              demandaId={String(id)}
              comentarios={comentarios}
            />
          </div>

          {/* Separated from Cancelar/Salvar by extra gap-6 (24px) spacing to
              signal a distinct action, not a third form button in the same row
              (04-UI-SPEC.md Screen Inventory -> 4. Edit form). Hidden — not
              disabled — when the demanda is already concluída. */}
          {demanda.status !== "concluida" && (
            <div className="flex w-full flex-col gap-6">
              <ConcludeButton demandaId={id} />
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
