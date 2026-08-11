import { BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import UtilidadesView from "./utilidades-view";
import UtilidadesClient from "./utilidades-client";

export default async function UtilidadesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isCoord = profile?.role === "coordenador_geral" || profile?.role === "coordenador_area";

  const { data: areasRaw } = await supabase
    .from("areas_institucionais")
    .select("id, nome")
    .order("nome");

  const areas: { id: number; nome: string }[] = (areasRaw ?? []).map((a) => ({
    id: Number(a.id),
    nome: String(a.nome),
  }));

  const { data: itens } = await supabase
    .from("utilidades_itens")
    .select("id, titulo, descricao, categoria, url, arquivo_nome, ordenacao, created_at, area_id, tags, areas_institucionais:area_id(id, nome)")
    .order("ordenacao")
    .order("titulo");

  const items = (itens ?? []).map((item) => {
    const area = (item.areas_institucionais as unknown as { id: number; nome: string } | null);
    return {
      id: Number(item.id),
      titulo: String(item.titulo),
      descricao: item.descricao ? String(item.descricao) : null,
      categoria: String(item.categoria),
      url: item.url ? String(item.url) : null,
      arquivo_nome: item.arquivo_nome ? String(item.arquivo_nome) : null,
      area_id: item.area_id ? Number(item.area_id) : null,
      area_nome: area?.nome ?? null,
      tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    };
  });

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <BookOpen size={30} aria-hidden="true" />
            Utilidades
          </h1>
          <p className="max-w-2xl text-xl text-zinc-500">
            Acervo de dados institucionais — documentos, logos, fichas, links úteis e recursos.
          </p>
        </div>
      </header>

      <UtilidadesView areas={areas ?? []} items={items} podeGerenciar={isCoord} />

      {isCoord && <UtilidadesClient areas={areas ?? []} />}
    </PageContainer>
  );
}
