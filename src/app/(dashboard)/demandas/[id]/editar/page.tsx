import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";
import DemandaForm from "../../demanda-form";
import ConcludeButton from "../../conclude-button";
import DemandaChecklist from "../../demanda-checklist";
import DemandaComentarios from "../../demanda-comentarios";
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
        <p className="text-xl text-zinc-700">Demanda não encontrada.</p>
        <Link
          href="/"
          className="text-xl font-medium text-blue-700 underline"
        >
          Voltar para a lista
        </Link>
      </PageContainer>
    );
  }

  // demandas_com_status, not the bare table, stays the canonical read
  // source shared with the list view (plan 04-02's precedent).
  const { data: demanda } = await supabase
    .from("demandas_com_status")
    .select("id, titulo, prazo, status, area, projeto, evento_id, etiqueta_id")
    .eq("id", id)
    .single();

  if (!demanda) {
    return (
      <PageContainer>
        <p className="text-xl text-zinc-700">Demanda não encontrada.</p>
        <Link
          href="/"
          className="text-xl font-medium text-blue-700 underline"
        >
          Voltar para a lista
        </Link>
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
    supabase.from("profiles").select("id, email, full_name").eq("ativo", true).order("email"),
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
      <h1 className="text-2xl font-semibold text-zinc-900">Editar demanda</h1>
      <DemandaForm
        mode="edit"
        demandaId={id}
        defaultValues={defaultValues}
        profiles={profiles ?? []}
        eventos={eventos ?? []}
        etiquetas={etiquetas ?? []}
      />

      <DemandaChecklist
        demandaId={id}
        items={(checklistItems ?? []).map((item) => ({
          id: item.id,
          item: item.item,
          concluido: item.concluido,
        }))}
      />

      <DemandaComentarios
        demandaId={String(id)}
        comentarios={comentarios}
      />

      {/* Separated from Cancelar/Salvar by extra gap-6 (24px) spacing to
          signal a distinct action, not a third form button in the same row
          (04-UI-SPEC.md Screen Inventory -> 4. Edit form). Hidden — not
          disabled — when the demanda is already concluída. */}
      {demanda.status !== "concluida" && (
        <div className="flex w-full max-w-md flex-col gap-6">
          <ConcludeButton demandaId={id} />
        </div>
      )}
    </PageContainer>
  );
}
