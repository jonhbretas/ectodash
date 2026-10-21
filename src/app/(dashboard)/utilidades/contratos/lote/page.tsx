// /utilidades/contratos/lote — contratos em massa: alunos colados de uma
// planilha/CSV ou digitados numa tabela, conferência, pré-visualização,
// envio de teste e envio em lote para a Assinafy respeitando a cota mensal.
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { saldoCota } from "@/lib/contratos/cota";
import PageContainer from "../../../page-container";
import LoteClient from "./lote-client";

export const metadata = { title: "Contratos em massa — EctoDash" };

export default async function ContratosLotePage() {
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

  const [modelosResult, eventosResult, saldo] = await Promise.all([
    supabase
      .from("contrato_modelos")
      .select("id, titulo, conteudo")
      .eq("ativo", true)
      .order("titulo", { ascending: true }),
    supabase
      .from("eventos")
      .select("id, titulo, data_evento")
      .order("data_evento", { ascending: false })
      .limit(200),
    saldoCota(supabase).catch(() => null),
  ]);

  const modelos = (modelosResult.data ?? []).map((m) => ({
    id: m.id as number,
    titulo: m.titulo as string,
    variaveis: Array.from(new Set(String(m.conteudo).match(/\{\{\s*[\w.]+\s*\}\}/g) ?? [])),
  }));

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
        <h1 className="text-3xl font-semibold text-zinc-900">Contratos em massa</h1>
        <p className="text-xl text-zinc-500">
          Cole a planilha de alunos ou preencha a tabela, confira os dados, faça um
          envio de teste e só então envie todos para assinatura.
        </p>
      </header>

      <LoteClient
        modelos={modelos}
        eventos={eventosResult.data ?? []}
        saldoInicial={saldo}
        emailUsuario={user.email ?? ""}
      />
    </PageContainer>
  );
}
