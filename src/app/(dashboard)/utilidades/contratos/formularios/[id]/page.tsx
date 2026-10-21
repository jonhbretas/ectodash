// /utilidades/contratos/formularios/<id> — link público, configurações, quem
// preencheu (com status do contrato) e inscritos do evento que ainda não
// preencheram (compradores da loja vinculados ao evento, comparados por e-mail).
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { linkFormulario } from "@/lib/contratos/formulario";
import { saldoCota } from "@/lib/contratos/cota";
import { formatarCpf } from "@/lib/contratos/aluno";
import PageContainer from "../../../../page-container";
import FormularioDetalheClient, { type RespostaLinha } from "./formulario-detalhe-client";

export const metadata = { title: "Formulário de contrato — EctoDash" };

export default async function FormularioDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  if (!/^\d+$/.test(idParam)) notFound();
  const id = Number(idParam);

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

  const { data: formulario } = await supabase
    .from("contrato_formularios")
    .select("*, modelo:contrato_modelos(titulo), evento:eventos(id, titulo, data_evento)")
    .eq("id", id)
    .maybeSingle();
  if (!formulario) notFound();

  const [respostasResult, saldo] = await Promise.all([
    supabase
      .from("contrato_formulario_respostas")
      .select(
        "id, status, erro, aluno_nome, aluno_email, aluno_cpf, aluno_documento, aluno_telefone, created_at, reenviado_em, contrato:contratos(id, status)"
      )
      .eq("formulario_id", id)
      .order("created_at", { ascending: false }),
    saldoCota(supabase).catch(() => null),
  ]);

  const respostas: RespostaLinha[] = (respostasResult.data ?? []).map((r) => {
    const contrato = (Array.isArray(r.contrato) ? r.contrato[0] : r.contrato) as { id: number; status: string } | null;
    return {
      id: r.id,
      status: r.status,
      erro: r.erro,
      nome: r.aluno_nome,
      email: r.aluno_email,
      cpf: r.aluno_cpf,
      documento: r.aluno_documento ?? formatarCpf(r.aluno_cpf),
      telefone: r.aluno_telefone,
      criadoEm: r.created_at,
      contratoId: contrato?.id ?? null,
      contratoStatus: contrato?.status ?? null,
    };
  });

  // Inscritos do evento (compradores dos produtos vinculados) sem resposta.
  const evento = formulario.evento as { id: number; titulo: string; data_evento: string | null } | null;
  let inscritosSemResposta: Array<{ nome: string; email: string }> | null = null;
  if (evento) {
    const { data: produtos } = await supabase
      .from("contrato_evento_produtos")
      .select("nome_produto")
      .eq("evento_id", evento.id);
    const nomes = (produtos ?? []).map((p) => p.nome_produto);
    if (nomes.length > 0) {
      const { data: inscritos } = await supabase
        .from("wp_customers")
        .select("first_name, last_name, email")
        .overlaps("courses", nomes)
        .order("first_name")
        .limit(500);
      const responderam = new Set(
        respostas.filter((r) => r.status !== "cancelado").map((r) => r.email.trim().toLowerCase())
      );
      inscritosSemResposta = (inscritos ?? [])
        .filter((c) => c.email && !responderam.has(String(c.email).trim().toLowerCase()))
        .map((c) => ({ nome: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(), email: c.email as string }));
    }
  }

  return (
    <PageContainer>
      <header className="flex w-full flex-col gap-1">
        <Link
          href="/utilidades/contratos/formularios"
          className="flex items-center gap-1 text-base text-zinc-500 transition-colors hover:text-[#2195B9]"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Formulários
        </Link>
        <h1 className="text-3xl font-semibold text-zinc-900">{formulario.titulo}</h1>
        <p className="text-xl text-zinc-500">
          {(formulario.modelo as { titulo: string } | null)?.titulo}
          {evento ? ` · ${evento.titulo}` : ""}
        </p>
      </header>

      <FormularioDetalheClient
        formulario={{
          id: formulario.id,
          link: linkFormulario(formulario.token),
          ativo: formulario.ativo,
          titulo: formulario.titulo,
          instrucoes: formulario.instrucoes,
          expira_em: formulario.expira_em,
          limite_respostas: formulario.limite_respostas,
          prazo_assinatura_dias: formulario.prazo_assinatura_dias,
          envio_automatico: formulario.envio_automatico,
        }}
        eventoId={evento?.id ?? null}
        respostas={respostas}
        inscritosSemResposta={inscritosSemResposta}
        saldo={saldo}
      />
    </PageContainer>
  );
}
