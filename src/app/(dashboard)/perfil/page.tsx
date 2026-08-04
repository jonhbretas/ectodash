import Link from "next/link";
import { UserRound, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";
import { roleLabel } from "@/lib/role-labels";
import PageContainer from "../page-container";
import MeuPerfilForm from "../voluntarios/meu-perfil-form";

// /perfil — the caller's own profile. Name is self-editable; role and área
// de atuação are coordinator-managed (migration 0014 enforces this at the
// database level). When the account is linked to the institutional roster
// (migration 0017), the linked data shows here too.
export default async function MeuPerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, area_atuacao, ativo, voluntario_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return null;
  }

  // Disabled accounts get a clear screen instead of the app (the layout's
  // own gate catches this before rendering, but a defensive branch here
  // keeps the page correct standalone).
  if (!profile.ativo) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">
            Conta desativada
          </h1>
          <p className="max-w-md text-xl text-zinc-700">
            Sua conta foi desativada pelo coordenador. Fale com ele para
            saber mais.
          </p>
        </div>
      </PageContainer>
    );
  }

  const { data: cadastro } = profile.voluntario_id
    ? await supabase
        .from("voluntarios")
        .select(
          "nome, codigo_pf, unidade, org_depto, funcao, data_inicio, data_saida, area_atuacao"
        )
        .eq("id", profile.voluntario_id)
        .maybeSingle()
    : { data: null };

  return (
    <PageContainer>
      <div className="flex w-full max-w-4xl flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <UserRound size={28} aria-hidden="true" />
          Meu perfil
        </h1>
        <p className="text-base text-zinc-700">
          Seus dados no EctoDash.
        </p>
      </div>

      <div className="flex w-full max-w-md flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <dl className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-base text-zinc-600">E-mail institucional</dt>
            <dd className="text-xl text-zinc-900">{profile.email}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-base text-zinc-600">Papel</dt>
            <dd className="text-xl text-zinc-900">
              {roleLabel(profile.role)}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-base text-zinc-600">
              <Lock size={14} aria-hidden="true" />
              Área de atuação
            </dt>
            <dd className="text-xl text-zinc-900">
              {profile.area_atuacao?.trim() || "Não definida"}
            </dd>
            <dd className="text-base text-zinc-600">
              Somente o coordenador pode alterar.
            </dd>
          </div>
          {cadastro && (
            <>
              <div className="flex flex-col gap-0.5 border-t border-zinc-100 pt-3">
                <dt className="text-base text-zinc-600">Código PF</dt>
                <dd className="text-xl text-zinc-900">
                  {cadastro.codigo_pf || "—"}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-base text-zinc-600">Unidade</dt>
                <dd className="text-xl text-zinc-900">
                  {cadastro.unidade || "—"}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-base text-zinc-600">Função</dt>
                <dd className="text-xl text-zinc-900">
                  {cadastro.funcao || "—"}
                </dd>
              </div>
            </>
          )}
        </dl>
      </div>

      <MeuPerfilForm nomeAtual={displayName(profile)} />

      <Link
        href="/"
        className="text-xl font-medium text-blue-700 underline"
      >
        Voltar para as demandas
      </Link>
    </PageContainer>
  );
}
