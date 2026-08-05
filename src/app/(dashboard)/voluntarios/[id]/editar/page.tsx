// /voluntarios/[id]/editar — coordinator-side volunteer edit. Reads the
// roster row (RLS 0017 decides visibility: coordenador_geral/voluntariado
// see any row, coordenador_area only their own áreas) and submits through
// the atualizar_voluntario SECURITY DEFINER function. The papel/áreas
// fields appear only for a coordenador_geral caller — the function enforces
// the same rule server-side.
import Link from "next/link";
import { Lock, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../../page-container";
import VoluntarioForm, { type VoluntarioFormValues } from "../../voluntario-form";

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

  const role = me?.role;
  const canManage =
    role === "coordenador_geral" ||
    role === "voluntariado" ||
    role === "coordenador_area";

  if (!canManage) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">
            Edição de voluntários é exclusiva da coordenação
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

  const [voluntarioResult, areasResult, areasRegistroResult, areasExtrasResult] = await Promise.all([
    supabase
      .from("voluntarios")
      .select(
        "id, nome, codigo_pf, unidade, org_depto, funcao, data_inicio, data_saida, obs, area_atuacao, role, ativo"
      )
      .eq("id", Number(id))
      .maybeSingle(),
    supabase.from("voluntarios").select("area_atuacao"),
    supabase.from("areas_institucionais").select("nome").order("nome"),
    supabase.from("voluntario_areas").select("area").eq("voluntario_id", Number(id)),
  ]);

  const voluntario = voluntarioResult.data;
  if (!voluntario) {
    return (
      <PageContainer>
        <p className="text-xl text-zinc-700">
          Voluntário não encontrado ou sem acesso a este cadastro.
        </p>
        <Link
          href="/voluntarios"
          className="text-xl font-medium text-blue-700 underline"
        >
          Voltar para a equipe
        </Link>
      </PageContainer>
    );
  }

  const areaOptions = [
    ...new Set(
      (areasResult.data ?? [])
        .map((row) => row.area_atuacao)
        .filter((area): area is string => Boolean(area && area.trim()))
    ),
  ].sort((a, b) => a.localeCompare(b));
  const areasInstitucionais = (areasRegistroResult.data ?? []).map(
    (a) => a.nome
  );
  const areasExtras = (areasExtrasResult.data ?? []).map((a) => a.area);

  const values: VoluntarioFormValues = {
    nome: voluntario.nome,
    codigo_pf: voluntario.codigo_pf,
    unidade: voluntario.unidade,
    org_depto: voluntario.org_depto,
    funcao: voluntario.funcao,
    data_inicio: voluntario.data_inicio,
    data_saida: voluntario.data_saida,
    obs: voluntario.obs,
    area_atuacao: voluntario.area_atuacao,
    papel: voluntario.role,
    areasLideradas: [],
    ativo: voluntario.ativo,
    areas: areasExtras,
  };

  return (
    <PageContainer>
      <div className="flex w-full max-w-3xl flex-col gap-2">
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
          <Pencil size={30} aria-hidden="true" />
          Editar voluntário
        </h1>
        <p className="text-xl text-zinc-500">{voluntario.nome}</p>
      </div>

      <VoluntarioForm
        mode="editar"
        voluntarioId={voluntario.id}
        values={values}
        areaOptions={areaOptions}
        areasOptions={areasInstitucionais}
        canAssignRole={role === "coordenador_geral"}
      />
    </PageContainer>
  );
}
