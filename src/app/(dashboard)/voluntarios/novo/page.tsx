// /voluntarios/novo — register a new volunteer in the institutional roster
// (public.voluntarios). The volunteer does NOT need an account: the roster
// row is the "base" that a future sign-in links to via /vincular.
// Gate (RLS 0017 + the criar_voluntario function are the real boundary):
// coordenador_geral / voluntariado create anywhere; coordenador_area
// creates in their own área (the function pins it and forces
// voluntario_comum).
import Link from "next/link";
import { Lock, UserRoundPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../page-container";
import VoluntarioForm, { type VoluntarioFormValues } from "../voluntario-form";

const emptyValues: VoluntarioFormValues = {
  nome: "",
  codigo_pf: null,
  unidade: null,
  org_depto: null,
  funcao: null,
  data_inicio: null,
  data_saida: null,
  obs: null,
  area_atuacao: null,
  papel: null,
  areasLideradas: [],
  ativo: true,
};

export default async function NovoVoluntarioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  const canCreate =
    role === "coordenador_geral" ||
    role === "voluntariado" ||
    role === "coordenador_area";

  if (!canCreate) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">
            Cadastro de voluntários é exclusivo da coordenação
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

  // Known areas for the datalist — derived from the roster the caller can
  // already see (RLS-scoped for a coordenador_area).
  const { data: rows } = await supabase.from("voluntarios").select("area_atuacao");
  const areaOptions = [
    ...new Set(
      (rows ?? [])
        .map((row) => row.area_atuacao)
        .filter((area): area is string => Boolean(area && area.trim()))
    ),
  ].sort((a, b) => a.localeCompare(b));

  return (
    <PageContainer>
      <div className="flex w-full max-w-3xl flex-col gap-2">
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
          <UserRoundPlus size={30} aria-hidden="true" />
          Novo voluntário
        </h1>
        <p className="text-xl text-zinc-500">
          O voluntário entra no cadastro da instituição e vincula a conta
          quando criar o acesso.
        </p>
      </div>

      <VoluntarioForm
        mode="criar"
        values={emptyValues}
        areaOptions={areaOptions}
        canAssignRole={role === "coordenador_geral"}
      />
    </PageContainer>
  );
}
