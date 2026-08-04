// src/app/vincular/page.tsx
// Self-link flow ("choose your name"): brand-new accounts (vincular_pendente
// = true, migration 0017) land here instead of the dashboard until they pick
// their name in the institutional roster — or, not finding themselves, type
// their own name to create a fresh roster entry. All reads/writes go through
// the SECURITY DEFINER functions from migration 0017 (buscar_voluntarios /
// vincular_meu_cadastro / criar_meu_cadastro) — the roster search only
// exists while the pending flag is set, and linking always applies the
// intended role with the coordenador_geral cap.
import { redirect } from "next/navigation";
import { UserRoundPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import VincularForm from "./vincular-form";

export default async function VincularPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("vincular_pendente, voluntario_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/");
  }

  // Account already linked (or an account that never needed linking — e.g.
  // the pre-existing coordinator account): the flow is over.
  if (!profile.vincular_pendente || profile.voluntario_id) {
    redirect("/");
  }

  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center gap-6 bg-zinc-50 px-6 pb-20 pt-8"
    >
      <div className="flex w-full max-w-2xl flex-col gap-2">
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
          <UserRoundPlus size={30} aria-hidden="true" />
          Vincule seu cadastro
        </h1>
        <p className="text-xl text-zinc-500">
          Seu nome já está na lista de voluntários da instituição. Escolha
          seu nome para vincular esta conta ao seu cadastro.
        </p>
      </div>

      <VincularForm />
    </main>
  );
}
