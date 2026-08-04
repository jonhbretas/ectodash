import Link from "next/link";
import { UserRound, ClipboardList, Lock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";
import PageContainer from "../../page-container";
import StatusBadge from "../../demandas/status-badge";
import OverdueBadge from "../../demandas/overdue-badge";

// Role labels — the four fixed institutional roles in pt-BR display names.
const ROLE_LABELS: Record<string, string> = {
  coordenador_geral: "Coordenador geral",
  lider_area: "Líder de área",
  voluntario_comum: "Voluntário comum",
  financeiro: "Financeiro",
};

type VoluntarioPageProps = {
  params: Promise<{ id: string }>;
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

  // RLS governs this read (0001/0002): a volunteer can only see their own
  // profile row; a coordenador sees any. Anyone else gets the friendly
  // access state below rather than a broken page.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .eq("id", id)
    .single();

  if (!profile) {
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

  // The volunteer's demandas, via the join table — RLS on both reads
  // scopes results to what the CALLER may see (a coordenador sees
  // everything of this volunteer; the volunteer themselves sees their own).
  const { data: links } = await supabase
    .from("demanda_responsaveis")
    .select("demanda_id")
    .eq("profile_id", id);

  const demandaIds = (links ?? []).map((row) => row.demanda_id);
  const demandas = demandaIds.length
    ? (
        await supabase
          .from("demandas_com_status")
          .select("id, titulo, prazo, status, area, atrasada")
          .in("id", demandaIds)
          .order("prazo", { ascending: true })
      ).data ?? []
    : [];

  const ativas = demandas.filter((d) => d.status !== "concluida");
  const historico = demandas.filter((d) => d.status === "concluida");

  return (
    <PageContainer>
      <div className="flex w-full max-w-4xl flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <UserRound size={28} aria-hidden="true" />
          {displayName(profile)}
        </h1>
        <p className="text-base text-zinc-700">{profile.email}</p>
        <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-base font-medium text-blue-800">
          {ROLE_LABELS[profile.role] ?? profile.role}
        </span>
        {profile.created_at && (
          <p className="text-base text-zinc-700">
            Voluntário desde{" "}
            {format(new Date(profile.created_at), "dd/MM/yyyy", {
              locale: ptBR,
            })}
          </p>
        )}
      </div>

      <div className="flex w-full max-w-4xl flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
            <ClipboardList size={24} aria-hidden="true" />
            Demandas atuais ({ativas.length})
          </h2>
          {ativas.length === 0 ? (
            <p className="text-xl text-zinc-700">
              Nenhuma demanda ativa no momento.
            </p>
          ) : (
            <div className="flex flex-col rounded-xl border border-zinc-200 bg-white shadow-sm">
              {ativas.map((demanda) => (
                <Link
                  key={demanda.id}
                  href={`/demandas/${demanda.id}/editar`}
                  className="flex flex-col gap-1 border-b border-zinc-200 px-5 py-4 last:border-b-0 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:flex-row sm:items-center sm:justify-between"
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

        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold text-zinc-900">
            Histórico de concluídas ({historico.length})
          </h2>
          {historico.length === 0 ? (
            <p className="text-xl text-zinc-700">
              Nenhuma demanda concluída ainda.
            </p>
          ) : (
            <div className="flex flex-col rounded-xl border border-zinc-200 bg-white shadow-sm">
              {historico.map((demanda) => (
                <Link
                  key={demanda.id}
                  href={`/demandas/${demanda.id}/editar`}
                  className="flex flex-col gap-1 border-b border-zinc-200 px-5 py-4 last:border-b-0 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:flex-row sm:items-center sm:justify-between"
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
          )}
        </section>
      </div>
    </PageContainer>
  );
}
