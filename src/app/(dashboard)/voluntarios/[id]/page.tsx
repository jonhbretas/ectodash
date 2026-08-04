// /voluntarios/[id] — volunteer detail: the full roster record (migration
// 0017) plus, when the volunteer's account is linked, their demandas.
// Visibility follows RLS (0017): a volunteer sees their own record; a
// coordenador_geral/voluntariado sees any; a coordenador_area sees their
// own áreas.
import Link from "next/link";
import {
  UserRound,
  ClipboardList,
  Lock,
  Pencil,
  UserRoundCheck,
  CalendarClock,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { roleLabel } from "@/lib/role-labels";
import PageContainer from "../../page-container";
import StatusBadge from "../../demandas/status-badge";
import OverdueBadge from "../../demandas/overdue-badge";

type VoluntarioPageProps = {
  params: Promise<{ id: string }>;
};

function formatData(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return format(new Date(`${iso}T00:00:00`), "dd/MM/yyyy", { locale: ptBR });
}

type DemandaRow = {
  id: number;
  titulo: string;
  prazo: string;
  status: "pendente" | "em_andamento" | "concluida";
  atrasada: boolean;
};

export default async function VoluntarioPage({ params }: VoluntarioPageProps) {
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

  const { data: voluntario } = await supabase
    .from("voluntarios")
    .select(
      "id, nome, codigo_pf, unidade, org_depto, funcao, data_inicio, data_saida, obs, area_atuacao, role, ativo, profiles(id, email, role)"
    )
    .eq("id", Number(id))
    .maybeSingle();

  if (!voluntario) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">
            Voluntário não encontrado ou sem acesso
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

  const linked = Array.isArray(voluntario.profiles)
    ? voluntario.profiles[0]
    : voluntario.profiles;
  const effectiveRole = linked?.role ?? voluntario.role ?? "voluntario_comum";
  const afastado = Boolean(voluntario.data_saida);

  // Demandas of the linked account — same join-table read as before, scoped
  // to the linked profile; empty for volunteers without an account yet.
  let ativas: DemandaRow[] = [];
  let historico: DemandaRow[] = [];
  if (linked?.id) {
    const { data: links } = await supabase
      .from("demanda_responsaveis")
      .select("demanda_id")
      .eq("profile_id", linked.id);

    const demandaIds = (links ?? []).map((row) => row.demanda_id);
    const demandas = demandaIds.length
      ? (
          await supabase
            .from("demandas_com_status")
            .select("id, titulo, prazo, status, atrasada")
            .in("id", demandaIds)
            .order("prazo", { ascending: true })
        ).data ?? []
      : [];

    ativas = demandas.filter((d) => d.status !== "concluida") as DemandaRow[];
    historico = demandas.filter(
      (d) => d.status === "concluida"
    ) as DemandaRow[];
  }

  return (
    <PageContainer>
      <div className="flex w-full max-w-4xl flex-col gap-5">
        <div className="flex w-full flex-col gap-5 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
                  <UserRound size={30} aria-hidden="true" />
                  {voluntario.nome}
                </h1>
                {linked && (
                  <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-base font-medium text-blue-800 ring-1 ring-blue-200/60">
                    <UserRoundCheck size={14} aria-hidden="true" />
                    Vinculado
                  </span>
                )}
                {afastado && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-base font-medium text-amber-800 ring-1 ring-amber-200/60">
                    <CalendarClock size={14} aria-hidden="true" />
                    Saída: {formatData(voluntario.data_saida)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-base font-medium text-zinc-800 ring-1 ring-zinc-200/60">
                  {roleLabel(effectiveRole)}
                </span>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-base font-medium ring-1 ${
                    voluntario.ativo
                      ? "bg-green-50 text-green-800 ring-green-200/60"
                      : "bg-red-50 text-red-800 ring-red-200/60"
                  }`}
                >
                  {voluntario.ativo ? "Ativo" : "Desativado"}
                </span>
              </div>
              {linked?.email && (
                <p className="text-base text-zinc-600">{linked.email}</p>
              )}
            </div>
            {canManage && (
              <Link
                href={`/voluntarios/${voluntario.id}/editar`}
                className="flex min-h-12 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-lg font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <Pencil size={18} aria-hidden="true" />
                Editar cadastro
              </Link>
            )}
          </div>

          <dl className="grid grid-cols-1 gap-4 border-t border-zinc-100 pt-5 sm:grid-cols-2">
            {[
              ["Código PF", voluntario.codigo_pf],
              ["Unidade", voluntario.unidade],
              ["Org Depto", voluntario.org_depto],
              ["Função", voluntario.funcao],
              ["Área de atuação", voluntario.area_atuacao],
              ["Data de início", formatData(voluntario.data_inicio)],
              ["Data de saída", formatData(voluntario.data_saida)],
            ].map(([label, value]) => (
              <div key={label as string} className="flex flex-col gap-0.5">
                <dt className="text-base text-zinc-500">{label}</dt>
                <dd className="text-xl text-zinc-900">{value ?? "—"}</dd>
              </div>
            ))}
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <dt className="text-base text-zinc-500">Observações</dt>
              <dd className="text-xl text-zinc-900">
                {voluntario.obs || "—"}
              </dd>
            </div>
          </dl>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
            <ClipboardList size={24} aria-hidden="true" />
            Demandas atuais ({ativas.length})
          </h2>
          {!linked ? (
            <p className="rounded-2xl bg-white px-5 py-4 text-xl text-zinc-700 ring-1 ring-zinc-200/60">
              Este voluntário ainda não vinculou a conta de acesso — as
              demandas aparecem aqui depois do vínculo.
            </p>
          ) : ativas.length === 0 ? (
            <p className="rounded-2xl bg-white px-5 py-4 text-xl text-zinc-700 ring-1 ring-zinc-200/60">
              Nenhuma demanda ativa no momento.
            </p>
          ) : (
            <div className="flex flex-col rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
              {ativas.map((demanda) => (
                <Link
                  key={demanda.id}
                  href={`/demandas/${demanda.id}/editar`}
                  className="flex flex-col gap-1 border-b border-zinc-100 px-5 py-4 last:border-b-0 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-xl text-zinc-900">{demanda.titulo}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={demanda.status} />
                    <span
                      className={`text-base ${
                        demanda.atrasada ? "text-red-700" : "text-zinc-700"
                      }`}
                    >
                      {format(
                        new Date(`${demanda.prazo}T00:00:00`),
                        "dd/MM/yyyy",
                        { locale: ptBR }
                      )}
                    </span>
                    {demanda.atrasada && <OverdueBadge prazo={demanda.prazo} />}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {linked && historico.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold text-zinc-900">
              Histórico de concluídas ({historico.length})
            </h2>
            <div className="flex flex-col rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
              {historico.map((demanda) => (
                <Link
                  key={demanda.id}
                  href={`/demandas/${demanda.id}/editar`}
                  className="flex flex-col gap-1 border-b border-zinc-100 px-5 py-4 last:border-b-0 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-xl text-zinc-900">{demanda.titulo}</span>
                  <span className="text-base text-zinc-700">
                    Concluída — prazo{" "}
                    {format(
                      new Date(`${demanda.prazo}T00:00:00`),
                      "dd/MM/yyyy",
                      { locale: ptBR }
                    )}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </PageContainer>
  );
}
