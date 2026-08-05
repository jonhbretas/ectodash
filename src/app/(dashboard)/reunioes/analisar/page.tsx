// /reunioes/analisar — AI analysis of a meeting transcript. Same UX-layer
// role gate as demandas/extrair (coordenador_geral | coordenador_area):
// every real write (reunioes insert, demandas, comentários, dips) is gated
// by each table's own RLS.
import Link from "next/link";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listarReunioes } from "@/lib/meetings";
import PageContainer from "../../page-container";
import AnaliseForm from "./analise-form";

// analisarTranscricao's AI call may run past the default 10s function
// budget on long transcripts — give the page's server actions room.
export const maxDuration = 60;

export default async function AnalisarReuniaoPage() {
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

  const canAnalyse =
    profile?.role === "coordenador_geral" ||
    profile?.role === "coordenador_area";

  if (!canAnalyse) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">
            Este recurso é exclusivo de coordenadores
          </h1>
          <p className="max-w-md text-xl text-zinc-700">
            Você não tem acesso à análise de reuniões por IA. Toque abaixo
            para voltar às atas.
          </p>
          <Link
            href="/reunioes"
            className="flex min-h-14 items-center justify-center rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Ver atas de reuniões
          </Link>
        </div>
      </PageContainer>
    );
  }

  // The ROSTER is the source of truth for who can be responsible for a
  // demanda (same rule as demandas/nova): every registered volunteer is
  // assignable, "mesmo que não estejam cadastrados" (sem conta ativada
  // ainda). temConta marca quem já ativou o acesso pelo vínculo.
  const [voluntariosResult, perfisResult, meetingsResult] = await Promise.all([
    supabase.from("voluntarios").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("profiles").select("voluntario_id").not("voluntario_id", "is", null),
    listarReunioes(),
  ]);

  const comConta = new Set(
    (perfisResult.data ?? [])
      .map((p) => p.voluntario_id)
      .filter((id): id is number => typeof id === "number")
  );

  const voluntarios = (voluntariosResult.data ?? []).map((v) => ({
    id: v.id,
    nome: v.nome,
    temConta: comConta.has(v.id),
  }));

  return (
    <PageContainer>
      <AnaliseForm
        voluntarios={voluntarios}
        meetings={meetingsResult.meetings}
        meetingsError={meetingsResult.error}
        meetingsConfigured={meetingsResult.configured}
      />
    </PageContainer>
  );
}
