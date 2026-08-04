// /reunioes/[id] — full ata view: structured sections (participantes,
// pontos principais, deliberações, resumo), the DIP records extracted from
// this meeting, the source transcription in a collapsible block, and a PDF
// download of the ata.
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Download,
  FileText,
  MessageSquareText,
  NotebookPen,
  Paperclip,
  Sparkles,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../page-container";

type AtaDetailPageProps = {
  params: Promise<{ id: string }>;
};

function textBlocks(value: string | null): string[] {
  return (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default async function AtaDetailPage({ params }: AtaDetailPageProps) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  if (!Number.isFinite(id)) {
    return (
      <PageContainer>
        <p className="text-xl text-zinc-700">Ata não encontrada.</p>
      </PageContainer>
    );
  }

  const [ataResult, dipsResult] = await Promise.all([
    supabase
      .from("reunioes")
      .select(
        "titulo, data_reuniao, horario, resumo, participantes, pontos_principais, deliberacoes, texto, arquivo_nome"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("dips")
      .select("id, localidade, pais, data_dip, participantes, observacoes")
      .eq("ata_id", id)
      .order("data_dip", { ascending: true }),
  ]);

  if (ataResult.error || !ataResult.data) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <NotebookPen size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">
            Ata não encontrada
          </h1>
          <Link
            href="/reunioes"
            className="text-xl font-medium text-blue-700 underline"
          >
            Voltar para as atas
          </Link>
        </div>
      </PageContainer>
    );
  }

  const ata = ataResult.data;
  const dips = dipsResult.data ?? [];
  const participantes = textBlocks(ata.participantes);
  const pontos = textBlocks(ata.pontos_principais);
  const deliberacoes = textBlocks(ata.deliberacoes);
  const dataLabel = format(new Date(`${ata.data_reuniao}T00:00:00`), "dd/MM/yyyy", {
    locale: ptBR,
  });

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <NotebookPen size={30} aria-hidden="true" />
            {ata.titulo}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-lg text-zinc-600">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={18} aria-hidden="true" />
              {dataLabel}
            </span>
            {ata.horario && (
              <span className="flex items-center gap-1.5">
                <Clock size={18} aria-hidden="true" />
                {ata.horario}
              </span>
            )}
            {ata.arquivo_nome && (
              <span className="flex items-center gap-1.5 text-base">
                <Paperclip size={16} aria-hidden="true" />
                {ata.arquivo_nome}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`/api/atas/${id}/pdf`}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-xl font-medium text-white shadow-[0_1px_3px_rgba(29,78,216,0.25)] transition-all duration-200 hover:bg-blue-600 hover:shadow-[0_2px_6px_rgba(29,78,216,0.3)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <Download size={22} aria-hidden="true" />
            Baixar PDF
          </a>
          <Link
            href="/reunioes"
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-xl font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <ArrowLeft size={22} aria-hidden="true" />
            Voltar
          </Link>
        </div>
      </header>

      <div className="flex w-full flex-col gap-5">
        {participantes.length > 0 && (
          <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
              <Users size={22} aria-hidden="true" />
              Participantes
            </h2>
            <div className="flex flex-wrap gap-2">
              {participantes.map((nome, index) => (
                <span
                  key={`${nome}-${index}`}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-base text-zinc-800 ring-1 ring-zinc-200/60"
                >
                  {nome}
                </span>
              ))}
            </div>
          </section>
        )}

        {pontos.length > 0 && (
          <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
              <FileText size={22} aria-hidden="true" />
              Pontos principais
            </h2>
            <ul className="flex flex-col gap-2">
              {pontos.map((ponto, index) => (
                <li key={index} className="flex gap-2 text-lg leading-relaxed text-zinc-700">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                  {ponto}
                </li>
              ))}
            </ul>
          </section>
        )}

        {deliberacoes.length > 0 && (
          <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
              <MessageSquareText size={22} aria-hidden="true" />
              Deliberações
            </h2>
            <ul className="flex flex-col gap-2">
              {deliberacoes.map((deliberacao, index) => (
                <li key={index} className="flex gap-2 text-lg leading-relaxed text-zinc-700">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-600" aria-hidden="true" />
                  {deliberacao}
                </li>
              ))}
            </ul>
          </section>
        )}

        {ata.resumo && (
          <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
            <h2 className="text-2xl font-semibold text-zinc-900">Resumo</h2>
            <p className="whitespace-pre-wrap text-lg leading-relaxed text-zinc-700">
              {ata.resumo}
            </p>
          </section>
        )}

        {dips.length > 0 && (
          <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
                <Sparkles size={22} aria-hidden="true" />
                Dinâmica DIP
              </h2>
              <Link
                href="/dips"
                className="text-base font-medium text-blue-700 underline decoration-blue-700/40 underline-offset-4"
              >
                Ver tela completa
              </Link>
            </div>
            <div className="flex w-full flex-col gap-3">
              {dips.map((dip) => (
                <div
                  key={dip.id}
                  className="flex flex-col gap-1 rounded-xl border border-zinc-200 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-lg font-semibold text-zinc-900">
                      {dip.localidade} — {dip.pais}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-base text-zinc-500">
                      {dip.data_dip && (
                        <span>
                          {format(new Date(`${dip.data_dip}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                      {dip.participantes !== null && (
                        <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-base font-medium text-purple-800 ring-1 ring-purple-200/60">
                          {dip.participantes} {dip.participantes === 1 ? "participante" : "participantes"}
                        </span>
                      )}
                    </span>
                  </div>
                  {dip.observacoes && (
                    <p className="text-base leading-relaxed text-zinc-700">
                      {dip.observacoes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {ata.texto && (
          <details className="group w-full rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
            <summary className="flex min-h-14 w-full cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 [&::-webkit-details-marker]:hidden">
              <span className="text-xl font-semibold text-zinc-900">
                Transcrição fonte
              </span>
              <span className="text-base text-zinc-500">Expandir</span>
            </summary>
            <p className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap border-t border-zinc-100 px-5 py-4 text-lg leading-relaxed text-zinc-700">
              {ata.texto}
            </p>
          </details>
        )}
      </div>
    </PageContainer>
  );
}
