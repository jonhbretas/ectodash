import Link from "next/link";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../page-container";
import AtaForm from "../ata-form";

export default async function NovaAtaPage() {
  const supabase = await createClient();

  const [voluntariosResult, perfisResult] = await Promise.all([
    supabase
      .from("voluntarios")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("profiles")
      .select("voluntario_id")
      .not("voluntario_id", "is", null),
  ]);

  const comConta = new Set(
    (perfisResult.data ?? []).map((p) => p.voluntario_id)
  );

  const voluntarios = (voluntariosResult.data ?? []).map((v) => ({
    id: v.id,
    nome: v.nome,
    temConta: comConta.has(v.id),
  }));

  return (
    <PageContainer>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-900">Registrar ata</h1>
        <Link href="/analisar" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-5 text-base font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]">
          <Sparkles size={18} aria-hidden="true" />
          Adicionar com IA
        </Link>
      </header>
      <AtaForm voluntarios={voluntarios} />
    </PageContainer>
  );
}
