import Link from "next/link";
import { Lock, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";
import PageContainer from "../../../page-container";
import EditarVoluntarioForm, { AlternarAtivoButton } from "../../editar-voluntario-form";

type EditarVoluntarioPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarVoluntarioPage({
  params,
}: EditarVoluntarioPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (me?.role !== "coordenador_geral") {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">
            Edição de voluntários é exclusiva do coordenador
          </h1>
          <Link
            href="/voluntarios"
            className="flex min-h-14 items-center justify-center rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Voltar para a equipe
          </Link>
        </div>
      </PageContainer>
    );
  }

  const [profileResult, liderAreasResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, role, area_atuacao, ativo")
      .eq("id", id)
      .single(),
    supabase.from("lider_areas").select("area").eq("lider_id", id),
  ]);

  const profile = profileResult.data;
  if (!profile) {
    return (
      <PageContainer>
        <p className="text-xl text-zinc-700">Voluntário não encontrado.</p>
        <Link
          href="/voluntarios"
          className="text-xl font-medium text-blue-700 underline"
        >
          Voltar para a equipe
        </Link>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex w-full max-w-4xl flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <Pencil size={28} aria-hidden="true" />
          Editar voluntário
        </h1>
        <p className="text-base text-zinc-700">
          {displayName(profile)} — {profile.email}
        </p>
      </div>

      <EditarVoluntarioForm
        voluntarioId={id}
        values={{
          full_name: displayName(profile),
          role: profile.role,
          area_atuacao: profile.area_atuacao,
          areasLideradas: (liderAreasResult.data ?? []).map((row) => row.area),
          ativo: profile.ativo,
        }}
      />

      <div className="flex w-full max-w-md flex-col gap-1">
        <AlternarAtivoButton voluntarioId={id} ativo={profile.ativo} />
        <p className="text-base text-zinc-700">
          Desativar remove o voluntário das listas e bloqueia o acesso, mas
          mantém o histórico (demandas, comentários e atas).
        </p>
      </div>
    </PageContainer>
  );
}
