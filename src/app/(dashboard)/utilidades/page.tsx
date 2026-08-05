import Link from "next/link";
import { BookOpen, FileText, Image, GraduationCap, Link2, Wrench, PlusCircle, ExternalLink, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import UtilidadesClient from "./utilidades-client";
import { excluirUtilidadeItemSimples } from "./utilidades-actions";

const CATEGORIAS: Record<string, { label: string; icon: typeof BookOpen; desc: string }> = {
  ata_fundacao: { label: "Ata de Fundação", icon: FileText, desc: "Documento oficial de fundação da instituição." },
  estatuto: { label: "Estatuto", icon: BookOpen, desc: "Estatuto social vigente e revisões." },
  logo: { label: "Logos e Identidade Visual", icon: Image, desc: "Logo em alta qualidade e variações." },
  ficha_proposicao: { label: "Ficha de Proposição de Curso", icon: FileText, desc: "Modelos e fichas para proposição de cursos." },
  grade_curricular: { label: "Grade Curricular — IC", icon: GraduationCap, desc: "Grade curricular da Iniciação Científica." },
  links_uteis: { label: "Links Úteis", icon: Link2, desc: "Links e referências importantes." },
  outro: { label: "Outros Documentos", icon: Wrench, desc: "Outros documentos e recursos relevantes." },
};

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

  const { data: itens } = await supabase
    .from("utilidades_itens")
    .select("id, titulo, descricao, categoria, url, arquivo_nome, ordenacao, created_at")
    .order("ordenacao")
    .order("titulo");

  const itemsByCategory = new Map<string, Array<{
    id: number; titulo: string; descricao: string | null; categoria: string;
    url: string | null; arquivo_nome: string | null;
  }>>();

  for (const item of itens ?? []) {
    const bucket = itemsByCategory.get(item.categoria) ?? [];
    bucket.push(item);
    itemsByCategory.set(item.categoria, bucket);
  }

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

      <div className="flex w-full flex-col gap-8">
        {Object.entries(CATEGORIAS).map(([key, { label, icon: Icon, desc }]) => {
          const catItens = itemsByCategory.get(key) ?? [];
          return (
            <section key={key} className="flex w-full flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="h-8 w-1.5 rounded-full bg-[#d4883a]" aria-hidden="true" />
                <Icon size={24} className="text-[#d4883a]" aria-hidden="true" />
                <h2 className="text-2xl font-semibold text-zinc-900">{label}</h2>
                {catItens.length > 0 && (
                  <span className="rounded-full bg-[#f5f0eb] px-3 py-1 text-base font-medium text-[#8b5e2a]">
                    {catItens.length} {catItens.length === 1 ? "item" : "itens"}
                  </span>
                )}
              </div>
              <p className="text-lg text-zinc-600">{desc}</p>

              {catItens.length === 0 ? (
                <p className="rounded-2xl bg-white px-5 py-4 text-xl text-zinc-500 ring-1 ring-zinc-200/60">
                  Nenhum item cadastrado nesta seção.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {catItens.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-2 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
                    >
                      <h3 className="text-xl font-semibold text-zinc-900">{item.titulo}</h3>
                      {item.descricao && (
                        <p className="text-base leading-relaxed text-zinc-600">{item.descricao}</p>
                      )}
                      <div className="mt-auto flex items-center gap-2 pt-2">
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-lg bg-[#d4883a] px-4 py-2 text-base font-medium text-white transition-colors hover:bg-[#c07828]"
                          >
                            <ExternalLink size={16} />
                            Acessar
                          </a>
                        )}
                        {item.arquivo_nome && (
                          <span className="text-base text-zinc-500">{item.arquivo_nome}</span>
                        )}
                        {isCoord && (
                          <ExcluirItemButton itemId={item.id} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {isCoord && <UtilidadesClient />}
    </PageContainer>
  );
}

function ExcluirItemButton({ itemId }: { itemId: number }) {
  return (
    <form action={excluirUtilidadeItemSimples} className="ml-auto">
      <input type="hidden" name="id" value={itemId} />
      <button
        type="submit"
        aria-label="Excluir item"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 size={18} />
      </button>
    </form>
  );
}
