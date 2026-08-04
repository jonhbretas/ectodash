import Link from "next/link";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "../../app-header";
import PageContainer from "../../page-container";
import ImportForm from "./import-form";

// Mirrors /painel/page.tsx's exact structure and precedent: a page-level
// Server Component role check that is UX-layer convenience only, never the
// real authorization boundary. The one real write this feature performs
// (createDemanda, called per-card from suggestion-review-list.tsx) is
// gated by its own existing RLS, unchanged by this plan
// (08-UI-SPEC.md Route & Access Contract, CLAUDE.md's client-side-only
// authorization prohibition).
export default async function ExtrairDemandasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts already guards unauthenticated visitors — same defensive
  // precedent as every other dashboard page.
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const canExtractDemandas =
    profile?.role === "coordenador_geral" || profile?.role === "lider_area";

  if (!canExtractDemandas) {
    return (
      <PageContainer>
        <AppHeader />
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">
            Este recurso é exclusivo de coordenadores e líderes de área
          </h1>
          <p className="max-w-md text-xl text-zinc-700">
            Você não tem acesso à extração de demandas por IA. Toque abaixo
            para voltar às suas demandas.
          </p>
          <Link
            href="/"
            className="flex min-h-14 items-center justify-center rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Ver minhas demandas
          </Link>
        </div>
      </PageContainer>
    );
  }

  // Same read nova/page.tsx already runs — no display-name column exists
  // on profiles (0001_profiles.sql), email is the display label for the
  // responsável select, reused by SuggestionReviewList (Task 2).
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email")
    .order("email");

  return (
    <PageContainer>
      <AppHeader canExtractDemandas />
      <ImportForm profiles={profiles ?? []} />
    </PageContainer>
  );
}
