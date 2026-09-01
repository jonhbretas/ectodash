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
  ListChecks,
  MessageSquareText,
  NotebookPen,
  Paperclip,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";
import PageContainer from "../../page-container";
import ExcluirAtaButton from "../excluir-ata-button";
import DipActions from "../../dips/dip-actions";
import { ParticipantesPanel } from "../participantes-panel";
import { AtaEditForm } from "../ata-edit-form";
import PautaDiscutirButton from "../pauta-discutir-button";

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

  const [
    ataResult,
    dipsResult,
    profileResult,
    participantesResult,
    voluntariosResult,
    localidadesResult,
    pautasDiscutidasResult,
    pautasPendentesResult,
    todasAtasResult,
    pautasSolicitadasResult,
  ] = await Promise.all([
      supabase
        .from("reunioes")
        .select(
          "titulo, data_reuniao, horario, resumo, participantes, pontos_principais, deliberacoes, texto, arquivo_nome, criado_por"
        )
        .eq("id", id)
        .single(),
      supabase
        .from("dips")
        .select("id, localidade, pais, data_dip, participantes, observacoes, criado_por")
        .eq("ata_id", id)
        .order("data_dip", { ascending: true }),
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase
        .from("ata_participantes")
        .select("voluntario_id, voluntarios(nome)")
        .eq("ata_id", id),
      supabase.from("voluntarios").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("dip_localidades").select("localidade, pais").order("localidade"),
      supabase
        .from("pautas")
        .select("id, titulo, contexto, criado_por, profiles(full_name, email)")
        .eq("ata_discutida_id", id)
        .order("updated_at", { ascending: true }),
      supabase
        .from("pautas")
        .select("id, titulo, contexto, criado_por, profiles(full_name, email)")
        .eq("status", "pendente")
        .order("created_at", { ascending: true }),
      supabase
        .from("reunioes")
        .select("id, titulo, data_reuniao")
        .order("data_reuniao", { ascending: false }),
      supabase
        .from("pautas")
        .select("id, titulo, contexto, origem, status, criado_por, created_at, profiles(full_name, email)")
        .eq("ata_id", id)
        .order("created_at", { ascending: true }),
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
            className="text-xl font-medium text-[#2195B9] underline"
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

  // Roster-linked participants (migration 0023) — normalized to the same
  // shape as the picker's options.
  const vinculados = (participantesResult.data ?? []).flatMap((row) => {
    const nomeRow = Array.isArray(row.voluntarios)
      ? row.voluntarios[0]
      : row.voluntarios;
    if (!nomeRow?.nome) return [];
    return [{ id: String(row.voluntario_id), nome: nomeRow.nome }];
  });

  const voluntarios = (voluntariosResult.data ?? []).map((v) => ({
    id: String(v.id),
    nome: v.nome,
  }));

  const localidadesCadastradas = (localidadesResult.data ?? []).map((l) => ({
    localidade: l.localidade,
    pais: l.pais,
  }));

  // UX gate mirroring RLS 0007: only the creator or a coordenador_geral
  // sees the delete button (RLS is the real boundary).
  const canDelete =
    ata.criado_por === user.id ||
    profileResult.data?.role === "coordenador_geral";

  const isCoordenadorGeral = profileResult.data?.role === "coordenador_geral";

  const pautaAutor = (row: {
    profiles: unknown;
    criado_por: string;
  }): { autor: string } => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      autor: displayName({
        full_name: (profile as { full_name?: string | null } | null)?.full_name ?? null,
        email: (profile as { email?: string | null } | null)?.email ?? null,
      }),
    };
  };

  const pautasDiscutidas = (pautasDiscutidasResult.data ?? []).map((row) => ({
    id: row.id,
    titulo: row.titulo,
    contexto: row.contexto,
    criadoPor: row.criado_por,
    ...pautaAutor(row),
  }));

  const pautasPendentes = (pautasPendentesResult.data ?? []).map((row) => ({
    id: row.id,
    titulo: row.titulo,
    contexto: row.contexto,
    criadoPor: row.criado_por,
    ...pautaAutor(row),
  }));

  const atasDisponiveis = (todasAtasResult.data ?? []).map((ata) => ({
    id: ata.id,
    titulo: ata.titulo,
    data_reuniao: ata.data_reuniao,
  }));

  const pautasSolicitadas = (pautasSolicitadasResult.data ?? []).map((row) => ({
    id: row.id,
    titulo: row.titulo,
    contexto: row.contexto,
    origem: row.origem,
    status: row.status,
    criadoPor: row.criado_por,
    createdAt: row.created_at,
    ...pautaAutor(row),
  }));

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
                {ata.horario.slice(0, 5)}
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
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-5 text-xl font-medium text-white shadow-[0_1px_3px_rgba(33,149,185,0.25)] transition-all duration-200 hover:bg-[#28627B] hover:shadow-[0_2px_6px_rgba(33,149,185,0.3)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            <Download size={22} aria-hidden="true" />
            Baixar PDF
          </a>
          {canDelete && (
            <ExcluirAtaButton ataId={id} ataTitulo={ata.titulo} />
          )}
          <Link
            href="/reunioes"
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-xl font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            <ArrowLeft size={22} aria-hidden="true" />
            Voltar
          </Link>
        </div>
      </header>

      <div className="flex w-full flex-col gap-5">
        <AtaEditForm
          ataId={id}
          canManage={canDelete}
          ata={{
            titulo: ata.titulo,
            data_reuniao: ata.data_reuniao,
            resumo: ata.resumo,
            pontos_principais: ata.pontos_principais,
            deliberacoes: ata.deliberacoes,
          }}
          voluntarios={voluntarios}
          participanteIds={vinculados.map((v) => v.id)}
        />

        <ParticipantesPanel
          ataId={id}
          canManage={canDelete}
          vinculados={vinculados}
          voluntarios={voluntarios}
          textoLivre={participantes}
        />

        {pontos.length > 0 && (
          <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
              <FileText size={22} aria-hidden="true" />
              Pontos principais
            </h2>
            <ul className="flex flex-col gap-2">
              {pontos.map((ponto, index) => (
                <li key={index} className="flex gap-2 text-lg leading-relaxed text-zinc-700">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2195B9]" aria-hidden="true" />
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
                className="text-base font-medium text-[#2195B9] underline decoration-[#2195B9]/40 underline-offset-4"
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
                  <div className="mt-1 flex justify-end border-t border-zinc-100 pt-1.5">
                    <DipActions
                      dip={{
                        id: dip.id,
                        ataId: id,
                        localidade: dip.localidade,
                        pais: dip.pais,
                        data: dip.data_dip,
                        participantes: dip.participantes,
                        observacoes: dip.observacoes,
                      }}
                      canManage={
                        dip.criado_por === user.id ||
                        profileResult.data?.role === "coordenador_geral"
                      }
                      localidades={localidadesCadastradas}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pautas desta reunião */}
        <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
            <ListChecks size={22} aria-hidden="true" />
            Pautas desta reunião
          </h2>

          {pautasDiscutidas.length === 0 && pautasPendentes.length === 0 ? (
            <p className="text-lg text-zinc-600">
              Nenhuma pauta vinculada a esta reunião.
            </p>
          ) : (
            <div className="flex w-full flex-col gap-3">
              {pautasDiscutidas.length > 0 && (
                <div className="flex w-full flex-col gap-2">
                  <h3 className="text-base font-semibold text-green-700">
                    Discutidas ({pautasDiscutidas.length})
                  </h3>
                  <ul className="flex w-full flex-col gap-2">
                    {pautasDiscutidas.map((pauta) => (
                      <li
                        key={pauta.id}
                        className="flex flex-col gap-0.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3"
                      >
                        <span className="text-lg font-semibold text-zinc-900 line-through decoration-zinc-300">
                          {pauta.titulo}
                        </span>
                        <span className="text-sm text-zinc-500">
                          por {pauta.autor}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {pautasPendentes.length > 0 && (
                <div className="flex w-full flex-col gap-2">
                  <h3 className="text-base font-semibold text-zinc-700">
                    Pendentes — marcar como discutida aqui ({pautasPendentes.length})
                  </h3>
                  <ul className="flex w-full flex-col gap-2">
                    {pautasPendentes.map((pauta) => (
                      <li
                        key={pauta.id}
                        className="flex flex-col gap-1.5 rounded-xl border border-zinc-200 p-3"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-lg font-semibold leading-snug text-zinc-900">
                            {pauta.titulo}
                          </span>
                          <span className="text-sm text-zinc-500">
                            por {pauta.autor}
                          </span>
                        </div>
                        {pauta.contexto && (
                          <p className="whitespace-pre-wrap text-base leading-relaxed text-zinc-700">
                            {pauta.contexto}
                          </p>
                        )}
                        {(isCoordenadorGeral || pauta.criadoPor === user.id) && (
                          <div className="mt-1">
                            <PautaDiscutirButton
                              pautaId={pauta.id}
                              ataId={id}
                              atasDisponiveis={atasDisponiveis}
                            />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Log de Pautas — pautas solicitadas para esta reunião */}
        {pautasSolicitadas.length > 0 && (
          <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
            <div className="flex items-center gap-2">
              <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
                <FileText size={22} aria-hidden="true" />
                Log de Pautas
              </h2>
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-sm font-medium text-zinc-700">
                {pautasSolicitadas.length} {pautasSolicitadas.length === 1 ? "pauta" : "pautas"}
              </span>
            </div>
            <p className="text-base text-zinc-500">
              Pautas que foram solicitadas para esta reunião (separado da ata completa).
            </p>
            <ul className="flex w-full flex-col gap-2">
              {pautasSolicitadas.map((pauta) => (
                <li
                  key={pauta.id}
                  className="flex flex-col gap-1 rounded-xl border border-zinc-200 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-lg font-semibold leading-snug text-zinc-900">
                        {pauta.titulo}
                      </span>
                      <span className="text-sm text-zinc-500">
                        por {pauta.autor} · {format(new Date(pauta.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        pauta.status === "discutida"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {pauta.status === "discutida" ? "Discutida" : "Pendente"}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                        {pauta.origem === "ata" ? "IA" : "Manual"}
                      </span>
                    </div>
                  </div>
                  {pauta.contexto && (
                    <p className="whitespace-pre-wrap text-base leading-relaxed text-zinc-700">
                      {pauta.contexto}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {ata.texto && (
          <details className="group w-full rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
            <summary className="flex min-h-14 w-full cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] [&::-webkit-details-marker]:hidden">
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
