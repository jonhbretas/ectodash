import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import { displayName } from "@/lib/display-name";
import DemandaInlineEditor from "../../demanda-inline-editor";
import ConcludeButton from "../../conclude-button";
import DemandaChecklist from "../../demanda-checklist";
import DemandaComentarios from "../../demanda-comentarios";
import PageContainer from "../../../page-container";

type EditarDemandaPageProps = {
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
        <div className="flex w-full flex-col items-center gap-4 py-16 text-center">
          <p className="text-xl text-zinc-500">Demanda não encontrada.</p>
          <Link href="/" className="text-xl font-medium text-blue-700 transition-colors hover:text-blue-600">
            Voltar para a lista
          </Link>
        </div>
      </PageContainer>
    );
  }

  const { data: demanda } = await supabase
    .from("demandas_com_status")
    .select("id, titulo, prazo, status, area, projeto, evento_id, etiqueta_id, atrasada")
    .eq("id", id)
    .single();

  if (!demanda) {
    return (
      <PageContainer>
        <div className="flex w-full flex-col items-center gap-4 py-16 text-center">
          <p className="text-xl text-zinc-500">Demanda não encontrada.</p>
          <Link href="/" className="text-xl font-medium text-blue-700 transition-colors hover:text-blue-600">
            Voltar para a lista
          </Link>
        </div>
      </PageContainer>
    );
  }

  const [
    { data: responsaveisRows },
    { data: membrosRows },
    { data: profiles },
    { data: eventos },
    { data: etiquetas },
    { data: checklistItems },
    { data: comentariosRaw },
  ] = await Promise.all([
    supabase.from("demanda_responsaveis").select("profile_id").eq("demanda_id", id),
    supabase.from("demanda_membros").select("profile_id").eq("demanda_id", id),
    supabase.from("profiles").select("id, email, full_name").eq("ativo", true)
      .not("email", "ilike", "%example.invalid%").order("email"),
    supabase.from("eventos").select("id, titulo")
      .gte("data_evento", new Date().toISOString().slice(0, 10))
      .order("data_evento", { ascending: true }).limit(100),
    supabase.from("etiquetas").select("id, area, nome").order("area").order("nome"),
    supabase.from("demanda_checklist").select("id, item, concluido").eq("demanda_id", id)
      .order("id", { ascending: true }),
    supabase.from("demanda_comentarios")
      .select("id, conteudo, created_at, autor_id, profiles(full_name, email)")
      .eq("demanda_id", id).order("created_at", { ascending: true }),
  ]);

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, { id: p.id, email: p.email, full_name: p.full_name }])
  );

  const responsaveis = (responsaveisRows ?? [])
    .map((r) => profileById.get(r.profile_id as string))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const membros = (membrosRows ?? [])
    .map((r) => profileById.get(r.profile_id as string))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const eventoNome = (eventos ?? []).find((e) => e.id === demanda.evento_id)?.titulo ?? null;
  const etiquetaRow = (etiquetas ?? []).find((e) => e.id === demanda.etiqueta_id);
  const etiquetaNome = etiquetaRow ? `${etiquetaRow.nome} (${etiquetaRow.area})` : null;

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
      <div className="flex w-full flex-col gap-8">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-base font-medium text-zinc-400 transition-colors hover:text-zinc-600"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar para a lista
        </Link>

        <DemandaInlineEditor
          demanda={{
            id: demanda.id,
            titulo: demanda.titulo,
            prazo: demanda.prazo,
            status: demanda.status,
            atrasada: demanda.atrasada,
            area: demanda.area,
            projeto: demanda.projeto,
            eventoId: demanda.evento_id ?? null,
            etiquetaId: demanda.etiqueta_id ?? null,
            eventoNome,
            etiquetaNome,
          }}
          responsaveis={responsaveis}
          membros={membros}
          allProfiles={(profiles ?? []).map((p) => ({
            id: p.id,
            email: p.email,
            full_name: p.full_name,
          }))}
          eventos={(eventos ?? []).map((e) => ({ id: e.id, titulo: e.titulo }))}
          etiquetas={(etiquetas ?? []).map((e) => ({
            id: e.id,
            area: e.area,
            nome: e.nome,
          }))}
        />

        <div className="grid w-full grid-cols-1 items-start gap-8 lg:grid-cols-2">
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

          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
              <DemandaComentarios
                demandaId={String(id)}
                comentarios={comentarios}
              />
            </div>

            {demanda.status !== "concluida" && (
              <ConcludeButton demandaId={id} />
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
