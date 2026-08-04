import { createClient } from "@/lib/supabase/server";
import DemandaForm from "../demanda-form";
import AppHeader from "../../app-header";
import PageContainer from "../../page-container";

export default async function NovaDemandaPage() {
  const supabase = await createClient();

  // No full_name column exists on profiles (0001_profiles.sql) — email is
  // the display label for the responsável select. Known limitation, not a
  // blocker, per this plan's own notes.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email")
    .order("email");

  return (
    <PageContainer>
      <AppHeader />
      <h1 className="text-2xl font-semibold text-zinc-900">Nova demanda</h1>
      <DemandaForm profiles={profiles ?? []} />
    </PageContainer>
  );
}
