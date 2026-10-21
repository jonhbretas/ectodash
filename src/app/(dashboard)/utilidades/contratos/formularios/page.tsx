// /utilidades/contratos/formularios — links públicos em que os próprios
// alunos preenchem os dados do contrato. Lista + criação de novo link.
import Link from "next/link";
import { ArrowLeft, Lock, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../../page-container";
import NovoFormularioClient from "./novo-formulario-client";

export const metadata = { title: "Formulários de contrato — EctoDash" };

type FormularioLista = {
  id: number;
  titulo: string;
  ativo: boolean;
  expira_em: string | null;
  limite_respostas: number;
  modelo: { titulo: string } | null;
  evento: { titulo: string; data_evento: string | null } | null;
};

export default async function FormulariosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "coordenador_geral") {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">Este módulo é exclusivo do coordenador</h1>
        </div>
      </PageContainer>
    );
  }

  const [formsResult, respostasResult, modelosResult, eventosResult] = await Promise.all([
    supabase
      .from("contrato_formularios")
      .select("id, titulo, ativo, expira_em, limite_respostas, modelo:contrato_modelos(titulo), evento:eventos(titulo, data_evento)")
      .order("created_at", { ascending: false }),
    supabase.from("contrato_formulario_respostas").select("formulario_id, status").neq("status", "cancelado"),
    supabase.from("contrato_modelos").select("id, titulo").eq("ativo", true).order("titulo"),
    supabase.from("eventos").select("id, titulo, data_evento").order("data_evento", { ascending: false }).limit(200),
  ]);

  const contagem = new Map<number, { total: number; pendentes: number }>();
  for (const r of respostasResult.data ?? []) {
    const c = contagem.get(r.formulario_id) ?? { total: 0, pendentes: 0 };
    c.total++;
    if (r.status === "aguardando_aprovacao" || r.status === "erro_envio") c.pendentes++;
    contagem.set(r.formulario_id, c);
  }
  const formularios = (formsResult.data ?? []) as unknown as FormularioLista[];

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
        <h1 className="text-3xl font-semibold text-zinc-900">Formulários de contrato</h1>
        <p className="text-xl text-zinc-500">
          Gere um link para o evento: cada aluno preenche os próprios dados, confere o contrato e recebe por
          e-mail para assinar.
        </p>
      </header>

      <NovoFormularioClient modelos={modelosResult.data ?? []} eventos={eventosResult.data ?? []} />

      <section className="flex w-full flex-col gap-3">
        <h2 className="text-2xl font-semibold text-zinc-900">Links criados</h2>
        {formularios.length === 0 ? (
          <p className="text-lg text-zinc-500">Nenhum formulário ainda.</p>
        ) : (
          formularios.map((f) => {
            const c = contagem.get(f.id) ?? { total: 0, pendentes: 0 };
            return (
              <Link
                key={f.id}
                href={`/utilidades/contratos/formularios/${f.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white p-5 ring-1 ring-zinc-200/60 transition-colors hover:bg-zinc-50"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-xl font-semibold text-zinc-900">{f.titulo}</p>
                  <p className="text-base text-zinc-600">
                    {f.modelo?.titulo ?? "—"}
                    {f.evento ? ` · ${f.evento.titulo}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-medium ring-1 ${
                        f.ativo ? "bg-green-50 text-green-800 ring-green-200" : "bg-zinc-100 text-zinc-600 ring-zinc-200"
                      }`}
                    >
                      {f.ativo ? "Aberto" : "Encerrado"}
                    </span>
                    <span className="rounded-full bg-[#e8f4f8] px-2.5 py-0.5 font-medium text-[#1a7a94] ring-1 ring-[#2195B9]/20">
                      {c.total} de {f.limite_respostas} respostas
                    </span>
                    {c.pendentes > 0 && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-medium text-amber-800 ring-1 ring-amber-200">
                        {c.pendentes} aguardando você
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={24} className="shrink-0 text-zinc-400" aria-hidden="true" />
              </Link>
            );
          })
        )}
      </section>
    </PageContainer>
  );
}
