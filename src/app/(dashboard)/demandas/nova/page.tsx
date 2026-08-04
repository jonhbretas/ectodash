import { createClient } from "@/lib/supabase/server";
import DemandaForm from "../demanda-form";
import PageContainer from "../../page-container";

export default async function NovaDemandaPage() {
  const supabase = await createClient();

  // No full_name column exists on profiles (0001_profiles.sql) — email is
  // the display label for the responsável select. Known limitation, not a
  // blocker, per this plan's own notes.
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
      <h1 className="text-2xl font-semibold text-zinc-900">Nova demanda</h1>
      <DemandaForm
        profiles={profilesResult.data ?? []}
        eventos={eventosResult.data ?? []}
        etiquetas={etiquetasResult.data ?? []}
      />
    </PageContainer>
  );
}
