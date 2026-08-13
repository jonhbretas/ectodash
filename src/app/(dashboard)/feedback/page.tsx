import { MessageSquareWarning } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import FeedbackView, { type RelatoRow } from "./feedback-view";

// src/app/(dashboard)/feedback/page.tsx
// Tela de relatos de bugs e melhorias enviados pelo botão flutuante.
// Todo usuário autenticado vê os próprios envios; o coordenador geral
// (único com RLS de leitura total na tabela feedback — migration 0056)
// vê todos e gerencia o status de acompanhamento. Anexos de imagem são
// URLs assinadas do bucket privado feedback-anexos (migration 0069).

const URL_ASSINADA_SEGUNDOS = 60 * 60 * 24; // 24h

export default async function FeedbackPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isCoordenador = profile?.role === "coordenador_geral";

  const { data: itens } = await supabase
    .from("feedback")
    .select(
      "id, tipo, mensagem, pagina, navegador, status, created_at, anexos, profiles(full_name, email)"
    )
    .order("created_at", { ascending: false });

  const relatos: RelatoRow[] = await Promise.all(
    (itens ?? []).map(async (item) => {
      const autor = item.profiles as unknown as {
        full_name: string | null;
        email: string | null;
      } | null;

      const caminhos = (item.anexos ?? []) as string[];
      const anexos: RelatoRow["anexos"] = [];
      for (const caminho of caminhos) {
        const { data } = await supabase.storage
          .from("feedback-anexos")
          .createSignedUrl(caminho, URL_ASSINADA_SEGUNDOS);
        if (data) {
          anexos.push({ nome: caminho.split("/").pop() ?? "imagem", url: data.signedUrl });
        }
      }

      return {
        id: String(item.id),
        tipo: item.tipo as "bug" | "sugestao",
        mensagem: String(item.mensagem),
        pagina: item.pagina ? String(item.pagina) : null,
        navegador: item.navegador ? String(item.navegador) : null,
        status: item.status as "novo" | "visto" | "resolvido",
        createdAt: String(item.created_at),
        autor: autor?.full_name?.trim() || autor?.email || "Usuário",
        anexos,
      };
    })
  );

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <MessageSquareWarning size={30} aria-hidden="true" />
            Relatos de bugs e melhorias
          </h1>
          <p className="max-w-2xl text-xl text-zinc-500">
            {isCoordenador
              ? "Todos os relatos enviados pelo botão flutuante — atualize o status de acompanhamento."
              : "Seus envios de bugs e sugestões feitos pelo botão flutuante."}
          </p>
        </div>
      </header>

      <FeedbackView relatos={relatos} isCoordenador={isCoordenador} />
    </PageContainer>
  );
}
