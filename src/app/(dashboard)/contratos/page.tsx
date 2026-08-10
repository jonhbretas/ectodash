// /contratos — painel do módulo de contratos: cards dos contratos gerados,
// agrupados por evento. Cada card referencia o PDF (baixar, enviar para
// assinatura, upload do assinado) e a pasta no Google Drive. Coordenador-only
// (dados pessoais de alunos); RLS restringe a leitura ao criador/coordenador.
import Link from "next/link";
import { FileSignature, Lock, Settings2, Plus, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import {
  categoriaLabel,
  formatarValor,
  type ContratoRow,
} from "@/lib/contratos/render";
import ContratoCard from "./contrato-card";

export const metadata = { title: "Contratos — EctoDash" };

type ContratoCardRow = ContratoRow & {
  modelo_titulo: string;
  modelo_categoria: string;
  evento_titulo: string | null;
  evento_data: string | null;
};

function grupoPorEvento(
  rows: ContratoCardRow[]
): Array<{ key: string; titulo: string; items: ContratoCardRow[] }> {
  const grupos = new Map<string, ContratoCardRow[]>();
  for (const row of rows) {
    const key = row.evento_id ? String(row.evento_id) : "avulsos";
    const bucket = grupos.get(key) ?? [];
    bucket.push(row);
    grupos.set(key, bucket);
  }
  return [...grupos.entries()].map(([key, items]) => ({
    key,
    titulo: items[0]?.evento_titulo ?? "Sem evento vinculado",
    items,
  }));
}

function nested<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  if (value && typeof value === "object") return value as T;
  return null;
}

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const eventoFiltro =
    typeof params.evento === "string" && params.evento !== "" ? params.evento : "";
  const statusFiltro =
    typeof params.status === "string" && params.status !== "" ? params.status : "";

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
          <p className="max-w-md text-xl text-zinc-600">
            Os contratos contêm dados pessoais de alunos e são gerenciados pelo
            coordenador.
          </p>
          <Link
            href="/"
            className="flex min-h-14 items-center justify-center rounded-xl bg-[#2195B9] px-6 text-xl font-medium text-white transition-colors hover:bg-[#28627B]"
          >
            Voltar para demandas
          </Link>
        </div>
      </PageContainer>
    );
  }

  const [contratosResult, eventosResult] = await Promise.all([
    supabase
      .from("contratos")
      .select(
        "*, modelo:contrato_modelos(titulo, categoria), evento:eventos(titulo, data_evento)"
      )
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("eventos").select("id, titulo").order("data_evento", { ascending: false }),
  ]);

  const rows: ContratoCardRow[] = (contratosResult.data ?? []).map((row) => {
    const modelo = nested<{ titulo?: string; categoria?: string }>(row.modelo);
    const evento = nested<{ titulo?: string; data_evento?: string }>(row.evento);
    return {
      id: row.id,
      modelo_id: row.modelo_id,
      evento_id: row.evento_id,
      aluno_nome: row.aluno_nome,
      aluno_email: row.aluno_email,
      aluno_documento: row.aluno_documento,
      aluno_telefone: row.aluno_telefone,
      valor: row.valor,
      status: row.status,
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
      evento_titulo: evento?.titulo ?? null,
      evento_data: evento?.data_evento ?? null,
    };
  });

  const filtrados = rows.filter((row) => {
    if (eventoFiltro && String(row.evento_id ?? "avulsos") !== eventoFiltro) return false;
    if (statusFiltro && row.status !== statusFiltro) return false;
    return true;
  });

  const grupos = grupoPorEvento(filtrados);

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <FileSignature size={30} aria-hidden="true" />
            Contratos
          </h1>
          <p className="text-xl text-zinc-500">
            Contratos por evento e curso, com assinatura eletrônica e arquivo
            automático no Drive.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/contratos/modelos"
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-xl font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            <Settings2 size={22} aria-hidden="true" />
            Modelos
          </Link>
          <Link
            href="/contratos/novo"
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-5 text-xl font-medium text-white transition-colors hover:bg-[#28627B]"
          >
            <Plus size={22} aria-hidden="true" />
            Novo contrato
          </Link>
        </div>
      </header>

      {/* Filtros */}
      <form className="flex flex-wrap gap-3" method="GET">
        <select
          name="evento"
          defaultValue={eventoFiltro}
          className="min-h-14 flex-1 rounded-xl border border-zinc-200 bg-white px-4 text-lg text-zinc-900 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30"
        >
          <option value="">Todos os eventos</option>
          <option value="avulsos">Sem evento vinculado</option>
          {(eventosResult.data ?? []).map((evento) => (
            <option key={evento.id} value={String(evento.id)}>
              {evento.titulo}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={statusFiltro}
          className="min-h-14 flex-1 rounded-xl border border-zinc-200 bg-white px-4 text-lg text-zinc-900 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30"
        >
          <option value="">Todos os status</option>
          <option value="gerado">Aguardando assinatura</option>
          <option value="assinando">Em assinatura</option>
          <option value="assinado">Assinado</option>
          <option value="recusado">Recusado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <button
          type="submit"
          className="min-h-14 rounded-xl bg-[#2195B9] px-6 text-lg font-medium text-white transition-colors hover:bg-[#28627B]"
        >
          Filtrar
        </button>
        {(eventoFiltro || statusFiltro) && (
          <Link
            href="/contratos"
            className="flex min-h-14 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-lg font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Limpar filtros
          </Link>
        )}
      </form>

      {filtrados.length === 0 ? (
        <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <FileSignature size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhum contrato encontrado
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            Crie o primeiro contrato escolhendo um modelo, um evento e o aluno.
            O PDF vai para a pasta do evento no Drive automaticamente.
          </p>
          <Link
            href="/contratos/novo"
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-6 text-xl font-medium text-white transition-colors hover:bg-[#28627B]"
          >
            <Plus size={22} aria-hidden="true" />
            Criar contrato
          </Link>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-10">
          {grupos.map((grupo) => (
            <section key={grupo.key} className="flex w-full flex-col gap-3">
              <div className="flex items-center gap-3">
                <FolderOpen size={22} className="text-[#2195B9]" aria-hidden="true" />
                <h2 className="text-2xl font-semibold text-zinc-900">{grupo.titulo}</h2>
                <span className="rounded-full bg-[#E6E6E6] px-3 py-1 text-base font-medium text-[#28627B]">
                  {grupo.items.length} {grupo.items.length === 1 ? "contrato" : "contratos"}
                </span>
              </div>
              <div className="grid w-full gap-4 lg:grid-cols-2">
                {grupo.items.map((contrato) => (
                  <ContratoCard
                    key={contrato.id}
                    contrato={contrato}
                    eventoData={
                      contrato.evento_data
                        ? format(new Date(`${contrato.evento_data.slice(0, 10)}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })
                        : null
                    }
                    categoriaLabel={categoriaLabel(contrato.modelo_categoria)}
                    valorLabel={formatarValor(contrato.valor)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
