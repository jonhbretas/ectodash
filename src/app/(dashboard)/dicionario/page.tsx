import { BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUsuario } from "@/lib/role-gates";
import { listarTermosGlossario } from "@/lib/glossary-db";
import PageContainer from "../page-container";
import DicionarioView from "./dicionario-view";

export default async function DicionarioPage() {
  let gate;
  try {
    gate = await requireUsuario();
  } catch {
    return null;
  }
  const { supabase, role } = gate;

  const termos = await listarTermosGlossario(supabase, { ativos: false });
  const podeGerenciar = role === "coordenador_geral";

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <BookOpen size={30} aria-hidden="true" />
            Dicionário
          </h1>
          <p className="max-w-2xl text-xl text-zinc-500">
            Termos do jargão que a IA traduz automaticamente ao analisar
            transcrições de reuniões e gerar cards.
          </p>
        </div>
      </header>

      <DicionarioView termos={termos} podeGerenciar={podeGerenciar} />
    </PageContainer>
  );
}
