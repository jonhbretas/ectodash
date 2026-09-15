// /painel/acessos — gestão de modelos de cargo (migration 0097) + prévia
// "ver como o usuário". Acesso exclusivo do coordenador_geral (gate de UX;
// a RLS das tabelas é o limite real).
import Link from "next/link";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../page-container";
import AcessosClient, { type AreaRow, type ModeloRow, type PessoaRow } from "./acessos-client";

export default async function AcessosPage() {
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
            Esta tela é exclusiva do coordenador geral
          </h1>
          <p className="max-w-md text-lg text-zinc-600">
            Somente o coordenador geral (ou o administrador do sistema) pode
            gerenciar cargos e acessos.
          </p>
          <Link
            href="/painel"
            className="flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-[#2195B9] to-[#FDBA2F] px-5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(33,149,185,0.25)] transition-all duration-200 hover:from-[#28627B] hover:to-[#2195B9]"
          >
            Voltar ao painel
          </Link>
        </div>
      </PageContainer>
    );
  }

  const { data: modelosRaw } = await supabase
    .from("cargo_modelos")
    .select("id, nome, descricao, nivel, area_id, modulos, areas_institucionais(nome)")
    .order("nome");

  type ModeloRaw = {
    id: number;
    nome: string;
    descricao: string;
    nivel: string;
    area_id: number | null;
    modulos: string[];
    areas_institucionais: { nome: string } | null;
  };

  const modelos: ModeloRow[] = ((modelosRaw ?? []) as unknown as ModeloRaw[]).map(
    (m) => ({
      id: m.id,
      nome: m.nome,
      descricao: m.descricao ?? "",
      nivel: m.nivel,
      area_id: m.area_id,
      area_nome: m.areas_institucionais?.nome ?? null,
      modulos: m.modulos ?? [],
    })
  );

  const { data: areasRaw } = await supabase
    .from("areas_institucionais")
    .select("id, nome")
    .order("nome");
  const areas: AreaRow[] = (areasRaw ?? []) as AreaRow[];

  // Pessoas com conta vinculada (para aplicar o modelo como cargo).
  const { data: pessoasRaw } = await supabase
    .from("profiles")
    .select("id, full_name, email, voluntarios(nome)")
    .order("full_name", { ascending: true })
    .limit(300);

  type PessoaRaw = {
    id: string;
    full_name: string | null;
    email: string;
    voluntarios: { nome: string } | null;
  };

  const pessoas: PessoaRow[] = ((pessoasRaw ?? []) as unknown as PessoaRaw[]).map(
    (p) => ({
      profile_id: p.id,
      nome: p.voluntarios?.nome ?? p.full_name?.trim() ?? p.email,
    })
  );

  return (
    <PageContainer>
      <Link
        href="/painel"
        className="inline-flex w-fit items-center gap-1.5 text-base font-medium text-zinc-400 transition-colors hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar ao painel
      </Link>

      <header className="flex w-full flex-col gap-1">
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
          <ShieldCheck size={30} aria-hidden="true" />
          Acessos e cargos
        </h1>
        <p className="max-w-2xl text-xl text-zinc-500">
          Modele os cargos da instituição ligando/desligando menus, veja como
          o menu aparece para cada cargo e aplique o modelo às pessoas.
        </p>
      </header>

      <AcessosClient modelos={modelos} areas={areas} pessoas={pessoas} />
    </PageContainer>
  );
}
