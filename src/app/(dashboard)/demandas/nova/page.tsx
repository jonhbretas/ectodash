import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import DemandaForm from "../demanda-form";
import PageContainer from "../../page-container";

export default async function NovaDemandaPage() {
  const supabase = await createClient();

  // The ROSTER is the source of truth for who can be responsible for a
  // demanda (user decision 2026-08-04): every registered volunteer is
  // assignable, "mesmo que eles não estejam cadastrados" (sem conta ativada
  // ainda). temConta marca quem já ativou o acesso pelo vínculo.
  const [voluntariosResult, perfisResult, eventosResult, etiquetasResult, areasResult] =
    await Promise.all([
      supabase
        .from("voluntarios")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("profiles")
        .select("voluntario_id")
        .not("voluntario_id", "is", null),
      supabase
        .from("eventos")
        .select("id, titulo, data_evento, local")
        .gte("data_evento", new Date().toISOString().slice(0, 10))
        .order("data_evento", { ascending: true })
        .limit(100),
      supabase.from("etiquetas").select("id, area, nome").order("area").order("nome"),
      supabase.from("areas_institucionais").select("nome").order("nome"),
    ]);

  const comConta = new Set(
    (perfisResult.data ?? []).map((p) => p.voluntario_id)
  );

  const voluntarios = (voluntariosResult.data ?? []).map((v) => ({
    id: v.id,
    nome: v.nome,
    temConta: comConta.has(v.id),
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
          wide
        />
      </div>
    </PageContainer>
  );
}
