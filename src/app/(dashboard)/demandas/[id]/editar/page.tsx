import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DemandaForm from "../../demanda-form";
import ConcludeButton from "../../conclude-button";
import type { DemandaFormValues } from "../../demanda-schema";
import AppHeader from "../../../app-header";
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
  // source shared with the list view (plan 04-02's precedent) — this page
  // doesn't need atrasada, but reading the same view keeps one source of
  // truth rather than forking a second query shape.
  const { data: demanda } = await supabase
    .from("demandas_com_status")
    .select("id, titulo, prazo, status, area")
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

  const [{ data: responsaveis }, { data: profiles }] = await Promise.all([
    supabase
      .from("demanda_responsaveis")
      .select("profile_id")
      .eq("demanda_id", id),
    supabase.from("profiles").select("id, email").order("email"),
  ]);

  const defaultValues: Partial<DemandaFormValues> = {
    titulo: demanda.titulo,
    responsavelIds: (responsaveis ?? []).map((row) => row.profile_id as string),
    prazo: demanda.prazo,
    status: demanda.status,
    area: demanda.area ?? undefined,
  };

  return (
    <PageContainer>
      <AppHeader />
      <h1 className="text-2xl font-semibold text-zinc-900">Editar demanda</h1>
      <DemandaForm
        mode="edit"
        demandaId={id}
        defaultValues={defaultValues}
        profiles={profiles ?? []}
      />

      {/* Separated from Cancelar/Salvar by extra gap-6 (24px) spacing to
          signal a distinct action, not a third form button in the same row
          (04-UI-SPEC.md Screen Inventory -> 4. Edit form). Hidden — not
          disabled — when the demanda is already concluída, since there is
          no reason to offer "mark as concluded" on an already-concluded
          demanda and a disabled button with no visible reason is worse for
          this audience than not showing it at all. */}
      {demanda.status !== "concluida" && (
        <div className="flex w-full max-w-md flex-col gap-6">
          <ConcludeButton demandaId={id} />
        </div>
      )}
    </PageContainer>
  );
}
