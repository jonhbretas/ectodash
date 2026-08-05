import Link from "next/link";
import { UserRound, Lock, Mail, Shield, MapPin, Hash, Building2, Briefcase, Calendar, ArrowLeft, NotebookPen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";
import { roleLabel } from "@/lib/role-labels";
import PageContainer from "../page-container";
import MeuPerfilForm from "../voluntarios/meu-perfil-form";

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

  if (!profile.ativo) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-slate-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-slate-900">
            Conta desativada
          </h1>
          <p className="max-w-md text-lg text-slate-600">
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

  // Participação em reuniões gerais — count + last few atas, powered by
  // ata_participantes (migration 0023).
  const participacoes = profile.voluntario_id
    ? (
        await supabase
          .from("ata_participantes")
          .select("ata_id, reunioes(titulo, data_reuniao)")
          .eq("voluntario_id", profile.voluntario_id)
      ).data ?? []
    : [];
  const participacoesComAta = participacoes
    .map((row) => {
      const ata = Array.isArray(row.reunioes) ? row.reunioes[0] : row.reunioes;
      if (!ata) return null;
      return { ataId: row.ata_id, titulo: ata.titulo, data: ata.data_reuniao };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => b.data.localeCompare(a.data));

  return (
    <PageContainer>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-[0_4px_12px_rgba(37,99,235,0.3)]">
            <UserRound size={26} className="text-white" aria-hidden="true" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {displayName(profile)}
            </h1>
            <p className="text-sm text-slate-500">Seu perfil no EctoDash</p>
          </div>
        </div>

        <MeuPerfilForm nomeAtual={displayName(profile)} />

        <div className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60 overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Informações da conta
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            <div className="flex items-center gap-3 px-5 py-3.5">
              <Mail size={16} className="shrink-0 text-slate-400" aria-hidden="true" strokeWidth={1.5} />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <span className="text-sm text-slate-500">E-mail principal</span>
                <span className="truncate text-sm font-medium text-slate-900">{profile.email}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3.5">
              <Shield size={16} className="shrink-0 text-slate-400" aria-hidden="true" strokeWidth={1.5} />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <span className="text-sm text-slate-500">Papel</span>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200/60">
                  {roleLabel(profile.role)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3.5">
              <Lock size={16} className="shrink-0 text-slate-400" aria-hidden="true" strokeWidth={1.5} />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <span className="text-sm text-slate-500">Área de atuação</span>
                <span className="truncate text-sm font-medium text-slate-900">
                  {profile.area_atuacao?.trim() || "Não definida"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {cadastro && (
          <div className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60 overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Cadastro institucional
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              <div className="flex items-center gap-3 px-5 py-3.5">
                <Hash size={16} className="shrink-0 text-slate-400" aria-hidden="true" strokeWidth={1.5} />
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="text-sm text-slate-500">Código PF</span>
                  <span className="text-sm font-medium text-slate-900">{cadastro.codigo_pf || "—"}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <Building2 size={16} className="shrink-0 text-slate-400" aria-hidden="true" strokeWidth={1.5} />
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="text-sm text-slate-500">Unidade</span>
                  <span className="text-sm font-medium text-slate-900">{cadastro.unidade || "—"}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <Briefcase size={16} className="shrink-0 text-slate-400" aria-hidden="true" strokeWidth={1.5} />
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="text-sm text-slate-500">Função</span>
                  <span className="text-sm font-medium text-slate-900">{cadastro.funcao || "—"}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <MapPin size={16} className="shrink-0 text-slate-400" aria-hidden="true" strokeWidth={1.5} />
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="text-sm text-slate-500">Área de atuação</span>
                  <span className="text-sm font-medium text-slate-900">{cadastro.area_atuacao || "—"}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <Calendar size={16} className="shrink-0 text-slate-400" aria-hidden="true" strokeWidth={1.5} />
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="text-sm text-slate-500">Data de início</span>
                  <span className="text-sm font-medium text-slate-900">
                    {cadastro.data_inicio
                      ? new Date(`${cadastro.data_inicio}T00:00:00`).toLocaleDateString("pt-BR", { timeZone: "UTC" })
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {profile.voluntario_id && (
          <div className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <NotebookPen size={14} aria-hidden="true" />
                Participação em reuniões gerais
              </span>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-sm font-semibold text-blue-700 ring-1 ring-blue-200/60">
                {participacoesComAta.length}
              </span>
            </div>
            {participacoesComAta.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">
                Você ainda não foi vinculado como participante de nenhuma ata.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {participacoesComAta.map((p) => (
                  <Link
                    key={p.ataId}
                    href={`/reunioes/${p.ataId}`}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <span className="truncate text-sm font-medium text-slate-900">
                      {p.titulo}
                    </span>
                    <span className="shrink-0 text-sm text-slate-500">
                      {new Date(`${p.data}T00:00:00`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        <Link
          href="/"
          className="flex h-10 w-fit items-center gap-2 rounded-xl px-4 text-sm font-medium text-slate-500 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <ArrowLeft size={16} aria-hidden="true" strokeWidth={1.5} />
          Voltar para as demandas
        </Link>
      </div>
    </PageContainer>
  );
}
