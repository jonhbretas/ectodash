import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import DemandaForm from "../demanda-form";
import PageContainer from "../../page-container";

export default async function NovaDemandaPage() {
  const supabase = await createClient();

  const [profilesResult, eventosResult, etiquetasResult] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name").eq("ativo", true).not("email", "ilike", "%example.invalid%").order("email"),
    supabase
      .from("eventos")
      .select("id, titulo")
      .gte("data_evento", new Date().toISOString().slice(0, 10))
      .order("data_evento", { ascending: true })
      .limit(100),
    supabase.from("etiquetas").select("id, area, nome").order("area").order("nome"),
  ]);

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
          profiles={profilesResult.data ?? []}
          eventos={eventosResult.data ?? []}
          etiquetas={etiquetasResult.data ?? []}
          wide
        />
      </div>
    </PageContainer>
  );
}
