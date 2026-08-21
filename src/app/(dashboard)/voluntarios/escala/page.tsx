// /voluntarios/escala — lista de escalas semanais de voluntários para
// dinâmicas (toda sexta-feira). Mostra escalas por data/localidade, com
// status (rascunho/publicada/cancelada) e botões de ação.
import Link from "next/link";
import { CalendarCheck, Plus, Eye, Trash2, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../page-container";
import EscalaStatusBadge from "./escala-status-badge";
import GerarEscalaButton from "./gerar-escala-button";

type EscalaRow = {
  id: number;
  data_semana: string;
  localidade: string | null;
  status: string;
  created_at: string;
  alocacao_count: number;
  ausencia_count: number;
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

export default async function EscalaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  const canManage =
    role === "coordenador_geral" || role === "voluntariado";

  // Buscar escalas com contagem de alocações e ausências
  const { data: escalas } = await supabase
    .from("escala_semanal")
    .select(`
      id, data_semana, localidade, status, created_at,
      escala_alocacao(id),
      escala_ausencia(id)
    `)
    .order("data_semana", { ascending: false });

  const rows: EscalaRow[] = (escalas ?? []).map((e) => ({
    id: e.id,
    data_semana: e.data_semana,
    localidade: e.localidade,
    status: e.status,
    created_at: e.created_at,
    alocacao_count: Array.isArray(e.escala_alocacao) ? e.escala_alocacao.length : 0,
    ausencia_count: Array.isArray(e.escala_ausencia) ? e.escala_ausencia.length : 0,
  }));

  // Buscar localidades para o filtro/fórmula
  const { data: localidades } = await supabase
    .from("voluntario_localidades")
    .select("nome")
    .order("nome");

  const localidadeOptions = (localidades ?? []).map((l) => l.nome);

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <CalendarCheck size={30} aria-hidden="true" />
            Escala de Voluntários
          </h1>
          <p className="text-xl text-zinc-500">
            Escala semanal das dinâmicas de sexta-feira — alocação e substituições.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/voluntarios/escala/mensal"
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-xl font-medium text-zinc-700 transition-all duration-200 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            <CalendarDays size={22} aria-hidden="true" />
            Visão mensal
          </Link>
          {canManage && (
            <Link
              href="/voluntarios/escala/nova"
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-5 text-xl font-medium text-white shadow-[0_1px_3px_rgba(33,149,185,0.25)] transition-all duration-200 hover:bg-[#28627B] hover:shadow-[0_2px_6px_rgba(33,149,185,0.3)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            >
              <Plus size={22} aria-hidden="true" />
              Nova escala
            </Link>
          )}
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <CalendarCheck size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhuma escala criada ainda
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            Crie a primeira escala semanal para organizar os voluntários das dinâmicas.
          </p>
          {canManage && (
            <Link
              href="/voluntarios/escala/nova"
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2195B9] to-[#FDBA2F] px-5 text-xl font-medium text-white shadow-[0_2px_8px_rgba(33,149,185,0.25)] transition-all duration-200 hover:from-[#28627B] hover:to-[#2195B9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            >
              <Plus size={22} aria-hidden="true" />
              Criar primeira escala
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((escala) => (
            <div
              key={escala.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60 transition-all duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-semibold text-zinc-900">
                    {formatarData(escala.data_semana)}
                  </span>
                  <EscalaStatusBadge status={escala.status} />
                </div>
                <div className="flex items-center gap-4 text-base text-zinc-500">
                  {escala.localidade && (
                    <span>{escala.localidade}</span>
                  )}
                  <span>
                    {escala.alocacao_count} {escala.alocacao_count === 1 ? "alocação" : "alocações"}
                  </span>
                  {escala.ausencia_count > 0 && (
                    <span className="text-amber-600">
                      {escala.ausencia_count} {escala.ausencia_count === 1 ? "ausência" : "ausências"}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {escala.status === "rascunho" && canManage && (
                  <GerarEscalaButton escalaId={escala.id} />
                )}
                <Link
                  href={`/voluntarios/escala/${escala.id}`}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 text-lg font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
                >
                  <Eye size={18} aria-hidden="true" />
                  Ver
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
