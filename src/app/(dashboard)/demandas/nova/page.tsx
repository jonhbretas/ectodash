import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import DemandaForm from "../demanda-form";
import PageContainer from "../../page-container";

export default async function NovaDemandaPage() {
  const supabase = await createClient();

  // O roster usa a função SECURITY DEFINER roster_basico() (id, nome,
  // tem_conta) em vez de SELECT direto em voluntarios+profiles: o RLS do
  // roster (0017+0043) mostra para voluntario_comum só a própria linha, e o
  // picker de responsáveis ficava com um nome só. A função expõe só colunas
  // não sensíveis dos ATIVOS para todo autenticado (decisão 2026-08-04:
  // todo voluntário ativo é atribuível).
  const [rosterResult, eventosResult, etiquetasResult, areasResult, projetosResult] =
    await Promise.all([
      supabase.rpc("roster_basico"),
      supabase
        .from("eventos")
        .select("id, titulo, data_evento, local")
        .gte("data_evento", new Date().toISOString().slice(0, 10))
        .order("data_evento", { ascending: true })
        .limit(100),
      supabase.from("etiquetas").select("id, area, nome").order("area").order("nome"),
      supabase.from("areas_institucionais").select("nome").order("nome"),
      supabase.from("projetos").select("nome").order("nome"),
    ]);

  const voluntarios = ((rosterResult.data ?? []) as { id: number; nome: string; tem_conta: boolean; profile_id?: string | null }[]).map((v) => ({
    id: v.id,
    nome: v.nome,
    temConta: v.tem_conta,
  }));

  return (
    <PageContainer>
      <div className="flex w-full flex-col gap-8">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-base font-medium text-zinc-400 transition-colors hover:text-zinc-600"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar para a lista
        </Link>

        <h1 className="text-3xl font-semibold text-zinc-900">Nova demanda</h1>

        <DemandaForm
          voluntarios={voluntarios}
          eventos={eventosResult.data ?? []}
          etiquetas={etiquetasResult.data ?? []}
          areas={(areasResult.data ?? []).map((a) => a.nome)}
          projetos={(projetosResult.data ?? []).map((p) => p.nome)}
          wide
        />
      </div>
    </PageContainer>
  );
}
