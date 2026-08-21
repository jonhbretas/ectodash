// /voluntarios/escala/[id] — detalhes de uma escala semanal: tabela de
// alocação função × voluntário, marcar ausências, gerar alocação, publicar.
import Link from "next/link";
import { ArrowLeft, CalendarCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../../page-container";
import EscalaStatusBadge from "../escala-status-badge";
import EscalaTable from "../escala-table";
import GerarEscalaButton from "../gerar-escala-button";
import DisponibilidadePanel from "../disponibilidade-panel";

type EscalaDetalhe = {
  id: number;
  data_semana: string;
  localidade: string | null;
  status: string;
  created_at: string;
};

function formatarData(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function EscalaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  const canManage =
    role === "coordenador_geral" || role === "voluntariado";
  const isCoordenadorGeral = role === "coordenador_geral";

  // Buscar voluntario_id do perfil do usuário atual
  const { data: profileCompleto } = await supabase
    .from("profiles")
    .select("voluntario_id")
    .eq("id", user.id)
    .single();

  const voluntarioAtualId = profileCompleto?.voluntario_id;

  // Buscar escala
  const { data: escala } = await supabase
    .from("escala_semanal")
    .select("*")
    .eq("id", Number(id))
    .single();

  if (!escala) {
    notFound();
  }

  // Buscar alocações com nomes dos voluntários
  const { data: alocacoesRaw } = await supabase
    .from("escala_alocacao")
    .select("id, funcao, voluntario_id, voluntarios(id, nome, unidade)")
    .eq("escala_id", escala.id);

  const alocacoes = (alocacoesRaw ?? []).map((a) => {
    const vol = Array.isArray(a.voluntarios)
      ? a.voluntarios[0]
      : a.voluntarios;
    return {
      id: a.id,
      funcao: a.funcao,
      voluntario_id: a.voluntario_id,
      voluntario_nome: vol?.nome ?? "Voluntário removido",
      voluntario_unidade: vol?.unidade ?? null,
      is_ausente: false,
    };
  });

  // Buscar ausências com nomes
  const { data: ausenciasRaw } = await supabase
    .from("escala_ausencia")
    .select("voluntario_id, motivo, voluntarios(id, nome, unidade)")
    .eq("escala_id", escala.id);

  const ausencias = (ausenciasRaw ?? []).map((a) => {
    const vol = Array.isArray(a.voluntarios)
      ? a.voluntarios[0]
      : a.voluntarios;
    return {
      voluntario_id: a.voluntario_id,
      voluntario_nome: vol?.nome ?? "Voluntário removido",
      motivo: a.motivo,
    };
  });

  // Marcar ausentes na tabela
  const ausentesSet = new Set(ausencias.map((a) => a.voluntario_id));
  const alocacoesComAusencia = alocacoes.map((a) => ({
    ...a,
    is_ausente: ausentesSet.has(a.voluntario_id),
  }));

  // Buscar disponibilidade
  const { data: disponibilidadesRaw } = await supabase
    .from("escala_disponibilidade")
    .select("voluntario_id, disponivel, motivo, voluntarios(id, nome)")
    .eq("escala_id", escala.id);

  const disponibilidades = (disponibilidadesRaw ?? []).map((d) => {
    const vol = Array.isArray(d.voluntarios) ? d.voluntarios[0] : d.voluntarios;
    return {
      voluntario_id: d.voluntario_id,
      disponivel: d.disponivel,
      motivo: d.motivo,
      voluntario_nome: vol?.nome ?? "?",
    };
  });

  // Total de voluntários ativos
  const { count: totalVoluntarios } = await supabase
    .from("voluntarios")
    .select("id", { count: "exact", head: true })
    .eq("ativo", true)
    .is("data_saida", null);

  return (
    <PageContainer>
      <Link
        href="/voluntarios/escala"
        className="inline-flex w-fit items-center gap-1.5 text-base font-medium text-zinc-400 transition-colors hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar para as escalas
      </Link>

      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <CalendarCheck size={30} aria-hidden="true" />
            Escala — {formatarData(escala.data_semana)}
          </h1>
          <div className="flex items-center gap-3">
            <EscalaStatusBadge status={escala.status} />
            {escala.localidade && (
              <span className="text-xl text-zinc-500">{escala.localidade}</span>
            )}
          </div>
        </div>

        {canManage && escala.status === "rascunho" && (
          <GerarEscalaButton escalaId={escala.id} />
        )}
      </header>

      <EscalaTable
        escalaId={escala.id}
        alocacoes={alocacoesComAusencia}
        ausencias={ausencias}
        status={escala.status}
        canManage={canManage}
        isCoordenadorGeral={isCoordenadorGeral}
      />

      <DisponibilidadePanel
        escalaId={escala.id}
        disponibilidades={disponibilidades}
        totalVoluntarios={totalVoluntarios ?? 0}
        isCoordenador={canManage}
        status={escala.status}
        voluntarioAtualId={voluntarioAtualId}
      />
    </PageContainer>
  );
}
