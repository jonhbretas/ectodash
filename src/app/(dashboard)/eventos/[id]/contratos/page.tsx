// /eventos/[id]/contratos — gestão de contratos POR EVENTO (decisão
// 2026-08-10): vínculo com produtos da loja (alunos inscritos), modelos
// habilitados por evento (com texto personalizado opcional), geração e envio
// em lote, e gestão dos contratos por status (incluindo vencidos).
// Coordenador-only; RLS protege os dados pessoais.
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../../page-container";
import {
  categoriaLabel,
  formatarValor,
  contratoVencido,
  type ContratoRow,
} from "@/lib/contratos/render";
import EventoContratosClient from "../evento-contratos-client";

export const metadata = { title: "Contratos do evento — EctoDash" };

type ContratoCardRow = ContratoRow & {
  modelo_titulo: string;
  modelo_categoria: string;
};

function nested<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  if (value && typeof value === "object") return value as T;
  return null;
}

export default async function EventoContratosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id: idParam } = await params;
  const eventoId = Number(idParam);
  const paramsQ = await searchParams;
  const statusFiltro =
    typeof paramsQ.status === "string" && paramsQ.status !== "" ? paramsQ.status : "";

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

  if (!Number.isFinite(eventoId)) {
    return (
      <PageContainer>
        <p className="text-xl text-zinc-700">Evento não encontrado.</p>
      </PageContainer>
    );
  }

  const [eventoResult, produtosResult, vinculadosResult, modelosVinculadosResult, modelosAtivosResult] =
    await Promise.all([
      supabase
        .from("eventos")
        .select("id, titulo, data_evento, local")
        .eq("id", eventoId)
        .single(),
      supabase
        .from("wp_products")
        .select("id, name, sku")
        .order("name", { ascending: true })
        .limit(500),
      supabase
        .from("contrato_evento_produtos")
        .select("wp_product_id, nome_produto")
        .eq("evento_id", eventoId)
        .order("nome_produto", { ascending: true }),
      supabase
        .from("contrato_evento_modelos")
        .select("modelo_id, conteudo_personalizado, modelo:contrato_modelos(titulo, categoria)")
        .eq("evento_id", eventoId),
      supabase
        .from("contrato_modelos")
        .select("id, titulo, categoria, descricao")
        .eq("ativo", true)
        .order("titulo", { ascending: true }),
    ]);

  if (eventoResult.error || !eventoResult.data) {
    return (
      <PageContainer>
        <p className="text-xl text-zinc-700">Evento não encontrado.</p>
        <Link href="/eventos" className="text-xl font-medium text-[#2195B9] underline">
          Voltar para os eventos
        </Link>
      </PageContainer>
    );
  }

  const nomesProdutos = (vinculadosResult.data ?? []).map((p) => p.nome_produto);
  const alunosResult = nomesProdutos.length
    ? await supabase
        .from("wp_customers")
        .select("wp_customer_id, first_name, last_name, email, courses")
        .overlaps("courses", nomesProdutos)
        .order("first_name", { ascending: true })
        .limit(300)
    : { data: [] as never[] };

  const [contratosResult, contratosAlunosResult] = await Promise.all([
    supabase
      .from("contratos")
      .select("*, modelo:contrato_modelos(titulo, categoria)")
      .eq("evento_id", eventoId)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("contratos")
      .select("aluno_email")
      .eq("evento_id", eventoId)
      .not("aluno_email", "is", null),
  ]);

  const hoje = new Date().toISOString().slice(0, 10);
  const contratos = (contratosResult.data ?? []).map((row) => {
    const modelo = nested<{ titulo?: string; categoria?: string }>(row.modelo);
    const base: ContratoCardRow = {
      id: row.id,
      modelo_id: row.modelo_id,
      evento_id: row.evento_id,
      aluno_nome: row.aluno_nome,
      aluno_email: row.aluno_email,
      aluno_documento: row.aluno_documento,
      aluno_telefone: row.aluno_telefone,
      valor: row.valor,
      status: row.status,
      expira_em: row.expira_em,
      conteudo_utilizado: row.conteudo_utilizado,
      drive_pasta_id: row.drive_pasta_id,
      drive_pasta_url: row.drive_pasta_url,
      drive_arquivo_id: row.drive_arquivo_id,
      drive_arquivo_url: row.drive_arquivo_url,
      drive_assinado_id: row.drive_assinado_id,
      drive_assinado_url: row.drive_assinado_url,
      assinafy_document_id: row.assinafy_document_id,
      assinafy_assignment_id: row.assinafy_assignment_id,
      criado_por: row.criado_por,
      created_at: row.created_at,
      modelo_titulo: modelo?.titulo ?? "Modelo",
      modelo_categoria: modelo?.categoria ?? "outro",
    };
    return {
      ...base,
      vencido: contratoVencido(base, hoje),
      categoriaLabel: categoriaLabel(base.modelo_categoria),
      valorLabel: formatarValor(base.valor),
    };
  });

  // Quantos contratos existentes por aluno (email), p/ o coordenador ver quem
  // ainda não tem contrato gerado.
  const contratosPorAluno = new Map<string, number>();
  for (const c of contratosAlunosResult.data ?? []) {
    const email = (c as { aluno_email: string }).aluno_email;
    if (email) contratosPorAluno.set(email, (contratosPorAluno.get(email) ?? 0) + 1);
  }

  const alunos = (alunosResult.data ?? []).map((c) => ({
    wp_customer_id: (c as { wp_customer_id: number }).wp_customer_id,
    first_name: (c as { first_name: string }).first_name ?? "",
    last_name: (c as { last_name: string }).last_name ?? "",
    email: (c as { email: string }).email ?? "",
    courses: (c as { courses: string[] | null }).courses ?? [],
    contratos: (c as { email: string }).email
      ? (contratosPorAluno.get((c as { email: string }).email) ?? 0)
      : 0,
  }));

  return (
    <PageContainer>
      <header className="flex w-full flex-col gap-1">
        <Link
          href={`/eventos/${eventoId}`}
          className="flex items-center gap-1 text-base text-zinc-500 transition-colors hover:text-[#2195B9]"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {eventoResult.data.titulo}
        </Link>
        <h1 className="text-3xl font-semibold text-zinc-900">
          Contratos do evento
        </h1>
        <p className="text-xl text-zinc-500">
          Vincule os produtos da loja, escolha os modelos e gere os contratos
          dos alunos inscritos — tudo em lote.
        </p>
      </header>

      <EventoContratosClient
        evento={{
          id: eventoId,
          titulo: eventoResult.data.titulo,
          data_evento: eventoResult.data.data_evento,
          local: eventoResult.data.local,
        }}
        produtos={(produtosResult.data ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
        }))}
        produtosVinculados={(vinculadosResult.data ?? []).map((p) => ({
          wp_product_id: p.wp_product_id,
          nome_produto: p.nome_produto,
        }))}
        modelosAtivos={(modelosAtivosResult.data ?? []).map((m) => ({
          id: m.id,
          titulo: m.titulo,
          categoria: m.categoria,
          descricao: m.descricao,
        }))}
        modelosVinculados={(modelosVinculadosResult.data ?? []).map((v) => {
          const modelo = nested<{ titulo?: string; categoria?: string }>(v.modelo);
          return {
            modelo_id: v.modelo_id,
            titulo: modelo?.titulo ?? "Modelo",
            categoria: modelo?.categoria ?? "outro",
            conteudo_personalizado: v.conteudo_personalizado,
          };
        })}
        alunos={alunos}
        contratos={contratos}
        statusFiltro={statusFiltro}
      />
    </PageContainer>
  );
}
