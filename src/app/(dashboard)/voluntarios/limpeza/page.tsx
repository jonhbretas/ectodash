// /voluntarios/limpeza — mutirão de limpeza do roster (a primeira mega
// tarefa): candidatos a sair (ociosos ou sem área) com desligamento em
// massa + reativação de quem já está desligado. Desligar = ativo=false
// (reversível, histórico preservado). Acesso: geral/voluntariado/cargo.
import Link from "next/link";
import { ArrowLeft, Lock, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../page-container";
import LimpezaList, { type Candidato } from "./limpeza-list";

export const metadata = { title: "Limpeza — Voluntários | EctoDash" };

export default async function LimpezaPage() {
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
  const { data: meusCargos } = await supabase.rpc("meus_cargos");
  const temCargo = ((meusCargos ?? []) as Array<{ modulos: string[] }>).some((c) =>
    c.modulos.includes("voluntarios")
  );
  const pode =
    profile?.role === "coordenador_geral" ||
    profile?.role === "voluntariado" ||
    temCargo;
  if (!pode) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">Só da coordenação</h1>
          <p className="max-w-md text-xl text-zinc-700">
            Esta tela é da coordenação de voluntariado.
          </p>
          <Link
            href="/"
            className="flex min-h-14 items-center justify-center rounded-lg bg-[#2195B9] px-4 py-3 text-xl font-medium text-white"
          >
            Voltar ao início
          </Link>
        </div>
      </PageContainer>
    );
  }

  const { data, error } = await supabase
    .from("voluntarios")
    .select("id, nome, area_atuacao, situacao, ativo")
    .order("nome", { ascending: true });
  if (error) console.error("limpeza: select failed", error);

  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    nome: String(r.nome),
    area: (r.area_atuacao as string | null) ?? null,
    situacao: String(r.situacao ?? "ativo"),
    ativo: Boolean(r.ativo),
  }));

  const candidatos: Candidato[] = rows
    .filter((r) => r.ativo && (r.situacao === "ocioso" || !r.area))
    .map((r) => ({
      id: r.id,
      nome: r.nome,
      area: r.area,
      motivo: r.situacao === "ocioso" && !r.area ? "Ocioso e sem área" : r.situacao === "ocioso" ? "Ocioso" : "Sem área",
    }));

  const desligados: Candidato[] = rows
    .filter((r) => !r.ativo)
    .map((r) => ({ id: r.id, nome: r.nome, area: r.area, motivo: "Desligado" }));

  return (
    <PageContainer>
      <header className="flex w-full flex-col gap-1">
        <Link
          href="/voluntarios"
          className="inline-flex items-center gap-1.5 text-lg font-medium text-[#2195B9]"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Voluntários
        </Link>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
          <Sparkles size={30} aria-hidden="true" className="text-[#2195B9]" />
          Limpeza
        </h1>
        <p className="max-w-2xl text-xl text-zinc-500">
          Primeiro a faxina: quem está parado sai, para seguirmos com quem ficou.
        </p>
      </header>

      <LimpezaList candidatos={candidatos} desligados={desligados} />
    </PageContainer>
  );
}
