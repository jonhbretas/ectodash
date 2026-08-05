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
      <h1 className="text-2xl font-semibold text-zinc-900">Registrar ata</h1>
      <AtaForm voluntarios={voluntarios} />
    </PageContainer>
  );
}
