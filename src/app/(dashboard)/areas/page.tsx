// /areas — cadastro das áreas institucionais (areas_institucionais,
// migration 0022), acessível pela tela de voluntários. O CRUD é exclusivo
// do coordenador_geral (RLS é o limite real; este é o gate de UX, como o
// /painel).
import Link from "next/link";
import { ArrowLeft, Lock, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import AreasConfig from "../painel/areas-config";

export default async function AreasPage() {
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

  if (profile?.role !== "coordenador_geral") {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">
            Este cadastro é exclusivo do coordenador
          </h1>
          <p className="max-w-md text-lg text-zinc-600">
            Você não tem acesso ao cadastro de áreas institucionais.
          </p>
          <Link
            href="/voluntarios"
            className="flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-[#2195B9] to-[#FDBA2F] px-5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(33,149,185,0.25)] transition-all duration-200 hover:from-[#28627B] hover:to-[#2195B9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            Voltar para a equipe
          </Link>
        </div>
      </PageContainer>
    );
  }

  const { data: areas } = await supabase
    .from("areas_institucionais")
    .select("id, nome, area_mae_id")
    .order("nome");

  return (
    <PageContainer>
      <Link
        href="/voluntarios"
        className="inline-flex w-fit items-center gap-1.5 text-base font-medium text-zinc-400 transition-colors hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar para os voluntários
      </Link>

      <header className="flex w-full flex-col gap-1">
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
          <Layers size={30} aria-hidden="true" />
          Áreas institucionais
        </h1>
        <p className="max-w-2xl text-xl text-zinc-500">
          Cadastro das áreas da instituição — usadas para organizar a equipe,
          as demandas e os filtros.
        </p>
      </header>

      <AreasConfig
        areas={(areas ?? []) as { id: number; nome: string; area_mae_id: number | null }[]}
      />
    </PageContainer>
  );
}
