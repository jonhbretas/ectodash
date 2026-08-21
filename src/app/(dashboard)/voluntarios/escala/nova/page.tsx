// /voluntarios/escala/nova — criar uma nova escala semanal. O
// coordenador seleciona a data (sexta-feira) e a localidade, e o sistema
// cria o registro em rascunho. A alocação automática é feita depois pela
// tela de detalhes.
import Link from "next/link";
import { ArrowLeft, CalendarCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../../page-container";
import NovaEscalaForm from "./nova-escala-form";

export default async function NovaEscalaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  if (role !== "coordenador_geral" && role !== "voluntariado") {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <CalendarCheck size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">
            Sem permissão
          </h1>
          <p className="max-w-md text-xl text-zinc-700">
            Somente coordenadores podem criar escalas.
          </p>
          <Link
            href="/voluntarios/escala"
            className="text-xl font-medium text-[#2195B9] underline"
          >
            Voltar para as escalas
          </Link>
        </div>
      </PageContainer>
    );
  }

  // Buscar localidades
  const { data: localidades } = await supabase
    .from("voluntario_localidades")
    .select("nome")
    .order("nome");

  const localidadeOptions = (localidades ?? []).map((l) => l.nome);

  return (
    <PageContainer>
      <Link
        href="/voluntarios/escala"
        className="inline-flex w-fit items-center gap-1.5 text-base font-medium text-zinc-400 transition-colors hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar para as escalas
      </Link>

      <header className="flex w-full flex-col gap-1">
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
          <CalendarCheck size={30} aria-hidden="true" />
          Nova escala semanal
        </h1>
        <p className="max-w-2xl text-xl text-zinc-500">
          Selecione a data da sexta-feira e a localidade para criar uma nova escala em rascunho.
        </p>
      </header>

      <NovaEscalaForm localidadeOptions={localidadeOptions} />
    </PageContainer>
  );
}
