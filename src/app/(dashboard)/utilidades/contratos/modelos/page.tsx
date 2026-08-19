// /utilidades/contratos/modelos — gestão dos modelos padronizados (contrato de curso,
// cessão de imagem, consentimento...). Coordenador-only; RLS permite leitura
// a todos e escrita ao criador/coordenador.
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../../page-container";
import ModelosClient from "../modelos-client";

export const metadata = { title: "Modelos de contrato — EctoDash" };

export default async function ModelosPage() {
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
            Este módulo é exclusivo do coordenador
          </h1>
        </div>
      </PageContainer>
    );
  }

  const { data: modelos } = await supabase
    .from("contrato_modelos")
    .select("id, titulo, categoria, descricao, conteudo, ativo, created_at")
    .order("titulo", { ascending: true });

  return (
    <PageContainer>
      <header className="flex w-full flex-col gap-1">
        <Link
          href="/utilidades/contratos"
          className="flex items-center gap-1 text-base text-zinc-500 transition-colors hover:text-[#2195B9]"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar
        </Link>
        <h1 className="text-3xl font-semibold text-zinc-900">Modelos de contrato</h1>
        <p className="text-xl text-zinc-500">
          Textos padronizados com variáveis — o sistema troca cada{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-base">
            {"{{variavel}}"}
          </code>{" "}
          pelos dados do aluno e do evento na hora de gerar o contrato.
        </p>
      </header>

      <ModelosClient
        modelos={(modelos ?? []).map((m) => ({
          id: m.id,
          titulo: m.titulo,
          categoria: m.categoria,
          descricao: m.descricao,
          conteudo: m.conteudo,
          ativo: m.ativo,
          created_at: m.created_at,
        }))}
      />
    </PageContainer>
  );
}
