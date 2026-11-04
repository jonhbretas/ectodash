import Link from "next/link";
import { Clock, FileText, ListChecks, ListTodo, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { proximaTerca, formatarDataISO, HORARIO_REUNIAO } from "@/lib/proxima-reuniao";
import PageContainer from "../../page-container";
import PautaItemActions from "../pauta-item-actions";
import PautasLista from "../_components/pautas-lista";
import { PrioridadeBadge, TipoBadge, ResultadoVotacaoBadge } from "../_components/pauta-badges";
import { PedirPautaTrigger } from "../pauta-modal";
import FaixaProxima from "../_components/faixa-proxima";
import PautasTab from "../_components/pautas-tab";
import { formatarProximaLabel } from "../_lib/format-data";
import { PAUTAS_SELECT, PAUTA_VOTOS_SELECT, agruparVotos, mapearPautas } from "../_lib/get-reunioes-data";

type Props = { searchParams?: Promise<{ tab?: string }> };

export default async function PedidosDePautaPage({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  const tab = sp.tab === "historico" ? "historico" : "proxima";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [atasResult, pautasResult, votosResult, profileResult] = await Promise.all([
    supabase.from("reunioes").select("id, titulo, data_reuniao").order("data_reuniao", { ascending: false }),
    // PAUTAS_SELECT usa profiles!pautas_criado_por_fkey e o encerrador:profiles!pautas_votacao_encerrada_por_fkey (pautas tem 2 FKs para profiles).
    supabase.from("pautas").select(PAUTAS_SELECT).order("created_at", { ascending: true }),
    // PAUTA_VOTOS_SELECT embute profiles!pauta_votos_user_id_fkey (nome de quem votou).
    supabase.from("pauta_votos").select(PAUTA_VOTOS_SELECT).order("updated_at", { ascending: true }),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
  ]);

  const atas = atasResult.data ?? [];
  const ataById = new Map<number, { titulo: string; data_reuniao: string }>();
  for (const r of atas) ataById.set(r.id, { titulo: r.titulo, data_reuniao: r.data_reuniao });
  const canManagePauta = profileResult.data?.role === "coordenador_geral";
  const pautas = mapearPautas(
    (pautasResult.data ?? []) as unknown as Parameters<typeof mapearPautas>[0],
    agruparVotos((votosResult.data ?? []) as unknown as Parameters<typeof agruparVotos>[0]),
    ataById
  );
  const atasDisponiveis = atas.map((r) => ({ id: r.id, titulo: r.titulo, data_reuniao: r.data_reuniao }));

  const pendentes = pautas.filter((p) => p.status === "pendente" && !p.standBy);
  const emEspera = pautas.filter((p) => p.status === "pendente" && p.standBy);
  const proxima = proximaTerca();
  const proximaDataStr = formatarDataISO(proxima);
  const ataProxima = atas.find((r) => r.data_reuniao === proximaDataStr) ?? null;

  const tabBase = "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors";
  const tabActive = "bg-[#2195B9] text-white shadow-sm";
  const tabIdle = "bg-zinc-100 text-zinc-700 hover:bg-zinc-200";

  return (
    <PageContainer>
      <div className="flex w-full flex-col gap-5">
        <header className="flex w-full flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900"><ListTodo size={28} /> Pedidos de pauta</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">Sugira um assunto, consulte os materiais anexados e participe das decisões. Acompanhe o que está pendente ou consulte as pautas já discutidas.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PedirPautaTrigger />
            <Link href="/reunioes" className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-base font-medium text-zinc-900 hover:bg-zinc-50"><FileText size={18} /> Ver atas</Link>
          </div>
        </header>

        <FaixaProxima pendentes={pendentes.length} emEspera={emEspera.length} />

        <nav aria-label="Abas" className="flex gap-2 overflow-x-auto border-b border-zinc-200 pb-3">
          <Link href="/reunioes/pautas" aria-current={tab === "proxima" ? "page" : undefined} className={`${tabBase} ${tab === "proxima" ? tabActive : tabIdle}`}>Próxima reunião <span className={`rounded-full px-2 py-0.5 text-xs ${tab === "proxima" ? "bg-white/20" : "bg-white"}`}>{pendentes.length}</span></Link>
          <Link href="/reunioes/pautas?tab=historico" aria-current={tab === "historico" ? "page" : undefined} className={`${tabBase} ${tab === "historico" ? tabActive : tabIdle}`}>Histórico de pautas <span className={`rounded-full px-2 py-0.5 text-xs ${tab === "historico" ? "bg-white/20" : "bg-white"}`}>{pautas.length}</span></Link>
        </nav>

        {tab === "proxima" && (
          <section className="flex flex-col gap-4">
            <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200/60">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900"><ListChecks size={20} className="shrink-0 text-[#2195B9]" /> Pautas da próxima reunião</h2>
                <span className="rounded-full bg-[#E6E6E6] px-3 py-1 text-sm font-medium text-[#28627B]">{pendentes.length} {pendentes.length === 1 ? "pauta" : "pautas"}</span>
              </div>
              <p className="mt-3 text-base font-medium text-[#28627B]">{formatarProximaLabel(proxima, HORARIO_REUNIAO)}</p>
              <p className="mt-1 text-sm text-zinc-500">Assuntos pendentes para discussão. Pautas já discutidas ficam no histórico; as que estão em espera aparecem abaixo.</p>

              {ataProxima && (
                <Link href={`/reunioes/${ataProxima.id}`} className="mt-3 flex items-center gap-3 rounded-xl border border-[#2195B9]/20 bg-[#2195B9]/5 px-4 py-3 text-sm text-[#2195B9] hover:bg-[#2195B9]/10">
                  <FileText size={16} /> {ataProxima.titulo} <span className="text-xs text-zinc-600">· Ver ata</span>
                </Link>
              )}

              {pendentes.length === 0 ? (
                <div className="flex max-h-[160px] flex-col items-center justify-center gap-3 py-8 text-center">
                  <p className="text-base text-zinc-600">Ainda não há pautas para a próxima reunião. Sugira o primeiro assunto.</p>
                  <PedirPautaTrigger className="!min-h-10 !text-base" />
                </div>
              ) : (
                <PautasLista pautas={pendentes} meuUserId={user.id} isCoordenador={canManagePauta} atasDisponiveis={atasDisponiveis} />
              )}
            </div>

            <details className="group rounded-xl border border-zinc-200 bg-zinc-50/60" open={emEspera.length > 0 && pendentes.length === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2"><Clock size={16} className="text-zinc-500" /> Em espera ({emEspera.length})</span>
                <span className="text-xs text-zinc-500"><span className="group-open:hidden">Ver pautas</span><span className="hidden group-open:inline">Recolher</span></span>
              </summary>
              <ul className="flex flex-col gap-1.5 border-t border-zinc-200 px-4 py-3">
                {emEspera.length === 0 ? <li className="text-sm text-zinc-500">Nenhuma pauta em espera.</li> : emEspera.map((p) => (
                  <li key={p.id} className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-700">
                    <div className="flex items-start gap-2">
                      <Clock size={14} className="mt-1 shrink-0 text-zinc-400" aria-hidden="true" />
                      <span className="flex-1 text-base">{p.titulo} <span className="text-sm text-zinc-600">· por {p.autor}</span></span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-6">
                      <PrioridadeBadge prioridade={p.prioridade} compact />
                      <TipoBadge tipo={p.tipo} />
                      {p.votacaoStatus && p.votacaoStatus !== "aberta" && <ResultadoVotacaoBadge status={p.votacaoStatus} />}
                      {p.anexoUrl && (
                        <a href={p.anexoUrl} target="_blank" rel="noopener noreferrer" aria-label={`Ver anexo: ${p.anexoNome ?? "arquivo"}`} className="inline-flex min-h-12 items-center gap-1.5 rounded-xl px-2 text-base font-semibold text-[#1d6f8d] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2195B9]">
                          <Paperclip size={16} aria-hidden="true" /> Anexo
                        </a>
                      )}
                    </div>
                    {(canManagePauta || p.criadoPor === user.id) && <div className="pl-6"><PautaItemActions pautaId={p.id} status={p.status} standBy={p.standBy} atasDisponiveis={atasDisponiveis} /></div>}
                  </li>
                ))}
              </ul>
            </details>
          </section>
        )}

        {tab === "historico" && <PautasTab pautas={pautas} meuUserId={user.id} isCoordenador={canManagePauta} />}
      </div>

      {/* FAB mobile - Pedir pauta */}
      <PedirPautaTrigger variant="fab" />
    </PageContainer>
  );
}
