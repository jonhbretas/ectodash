// /contratos/novo — formulário de geração de contrato: modelo padronizado +
// evento (opcional) + aluno (busca no WooCommerce ou digitação manual).
// O envio cria o contrato, as pastas no Drive e o PDF (server action).
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearch } from "@/lib/utils";
import PageContainer from "../../page-container";
import ContratoForm from "../contrato-form";

export const metadata = { title: "Novo contrato — EctoDash" };

export default async function NovoContratoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const busca = typeof params.busca === "string" ? params.busca.trim() : "";
  const eventoInicial =
    typeof params.evento === "string" && /^\d+$/.test(params.evento) ? params.evento : "";

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

  const [modelosResult, eventosResult, alunosResult] = await Promise.all([
    supabase
      .from("contrato_modelos")
      .select("id, titulo, categoria, descricao, conteudo")
      .eq("ativo", true)
      .order("titulo", { ascending: true }),
    supabase
      .from("eventos")
      .select("id, titulo, data_evento")
      .order("data_evento", { ascending: false })
      .limit(200),
    busca
      ? supabase
          .from("wp_customers")
          .select("wp_customer_id, first_name, last_name, email, courses")
          .or(
            `first_name.ilike.%${sanitizeSearch(busca)}%,last_name.ilike.%${sanitizeSearch(busca)}%,email.ilike.%${sanitizeSearch(busca)}%`
          )
          .order("total_spent", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const modelos = (modelosResult.data ?? []).map((m) => ({
    id: m.id,
    titulo: m.titulo,
    categoria: m.categoria,
    descricao: m.descricao,
  }));
  const eventos = (eventosResult.data ?? []).map((e) => ({
    id: e.id,
    titulo: e.titulo,
    data_evento: e.data_evento,
  }));
  const alunos = (alunosResult.data ?? []).map((c) => ({
    id: c.wp_customer_id,
    first_name: c.first_name,
    last_name: c.last_name,
    email: c.email,
    courses: c.courses,
  }));

  return (
    <PageContainer>
      <header className="flex w-full flex-col gap-1">
        <Link
          href="/contratos"
          className="flex items-center gap-1 text-base text-zinc-500 transition-colors hover:text-[#2195B9]"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar
        </Link>
        <h1 className="text-3xl font-semibold text-zinc-900">Novo contrato</h1>
        <p className="text-xl text-zinc-500">
          Escolha o modelo, o evento e o aluno — o PDF será gerado e salvo na
          pasta do evento no Drive.
        </p>
      </header>

      <ContratoForm
        modelos={modelos}
        eventos={eventos}
        alunosIniciais={alunos}
        busca={busca}
        eventoInicial={eventoInicial}
      />
    </PageContainer>
  );
}
