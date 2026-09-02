import Link from "next/link";
import { CalendarClock, CheckCheck, Clock, FileText, ListChecks, NotebookPen, PlusCircle, Sparkles, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";
import { proximaTerca, HORARIO_REUNIAO } from "@/lib/proxima-reuniao";
import PageContainer from "../page-container";
import PautaItemActions from "./pauta-item-actions";
import { PedirPautaTrigger } from "./pauta-modal";
import FaixaProxima from "./_components/faixa-proxima";
import PautasTab from "./_components/pautas-tab";
import AtasTab from "./_components/atas-tab";
import { formatarProximaLabel } from "./_lib/format-data";

type Props = { searchParams?: Promise<{ tab?: string }> };

export default async function ReunioesPage({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  const tab = sp.tab === "pautas" ? "pautas" : sp.tab === "atas" ? "atas" : "proxima";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [atasResult, dipsResult, pautasResult, profileResult] = await Promise.all([
    supabase.from("reunioes").select("id, titulo, data_reuniao, horario, resumo, participantes, deliberacoes").order("data_reuniao", { ascending: false }),
    supabase.from("dips").select("ata_id"),
    supabase.from("pautas").select("id, titulo, contexto, status, origem, stand_by, ata_id, ata_discutida_id, data_solicitada, horario_solicitado, reuniao_selecionada_id, criado_por, created_at, updated_at, profiles(full_name, email)").order("created_at", { ascending: true }),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
  ]);

  const dipCountByAta = new Map<number, number>();
  for (const r of dipsResult.data ?? []) dipCountByAta.set(r.ata_id, (dipCountByAta.get(r.ata_id) ?? 0) + 1);
  const ataById = new Map<number, { titulo: string; data_reuniao: string }>();
  for (const r of atasResult.data ?? []) ataById.set(r.id, { titulo: r.titulo, data_reuniao: r.data_reuniao });
  const ataTitulo = (id: number | null) => (id === null ? null : (ataById.get(id)?.titulo ?? null));

  const rows = (atasResult.data ?? []).map((r) => ({ id: r.id, titulo: r.titulo, data_reuniao: r.data_reuniao, horario: r.horario, resumo: r.resumo, participantes: r.participantes, deliberacoes: r.deliberacoes, dipCount: dipCountByAta.get(r.id) ?? 0 }));
  const canManagePauta = profileResult.data?.role === "coordenador_geral";
  const pautas = (pautasResult.data ?? []).map((row: any) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return { id: row.id, titulo: row.titulo, contexto: row.contexto, status: row.status, origem: row.origem, standBy: row.stand_by, ataId: row.ata_id, ataTitulo: ataTitulo(row.ata_id), ataDiscutidaId: row.ata_discutida_id, ataDiscutidaTitulo: ataTitulo(row.ata_discutida_id), ataDiscutidaData: row.ata_discutida_id ? (ataById.get(row.ata_discutida_id)?.data_reuniao ?? null) : null, dataSolicitada: row.data_solicitada, horarioSolicitado: row.horario_solicitado, reuniaoSelecionadaId: row.reuniao_selecionada_id, reuniaoSelecionadaTitulo: ataTitulo(row.reuniao_selecionada_id), criadoPor: row.criado_por, autor: displayName({ full_name: profile?.full_name ?? null, email: profile?.email ?? null }), createdAt: row.created_at };
  });

  const pendentes = pautas.filter((p: any) => p.status === "pendente" && !p.standBy);
  const emEspera = pautas.filter((p: any) => p.status === "pendente" && p.standBy);
  const proxima = proximaTerca();
  const proximaDataStr = format(proxima, "yyyy-MM-dd");
  const ataProxima = rows.find((r) => r.data_reuniao === proximaDataStr) ?? null;
  const counts = { proxima: pendentes.length, pautas: pautas.length, atas: rows.length };

  const tabBase = "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors";
  const tabActive = "bg-[#2195B9] text-white shadow-sm";
  const tabIdle = "bg-zinc-100 text-zinc-700 hover:bg-zinc-200";

  return (
    <PageContainer>
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
        {/* Header */}
        <header className="flex w-full flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900"><NotebookPen size={28} /> Reuniões</h1>
            <p className="text-base text-zinc-600">Pauta da próxima reunião e histórico das atas.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PedirPautaTrigger />
            <Link href="/reunioes/nova" className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-base font-medium text-zinc-900 hover:bg-zinc-50"> <PlusCircle size={18} /> Registrar ata</Link>
            <details className="relative">
              <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 [&::-webkit-details-marker]:hidden"><MoreHorizontal size={18} /></summary>
              <div className="absolute right-0 top-full z-20 mt-2 flex w-56 flex-col rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
                <Link href="/reunioes/nova" className="px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50">Registrar ata</Link>
                <Link href="/analisar" className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50"><Sparkles size={14} /> Analisar por IA</Link>
                <Link href="/reunioes?tab=atas" className="px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50">Exportar / Ver atas</Link>
              </div>
            </details>
          </div>
        </header>

        <FaixaProxima pendentes={pendentes.length} emEspera={emEspera.length} />

        {/* Tabs */}
        <nav aria-label="Abas" className="flex gap-2 overflow-x-auto border-b border-zinc-200 pb-3">
          <Link href="/reunioes" className={`${tabBase} ${tab === "proxima" ? tabActive : tabIdle}`}>Próxima reunião</Link>
          <Link href="/reunioes?tab=pautas" className={`${tabBase} ${tab === "pautas" ? tabActive : tabIdle}`}>Pautas <span className={`rounded-full px-2 py-0.5 text-xs ${tab === "pautas" ? "bg-white/20" : "bg-white"}`}>{counts.pautas}</span></Link>
          <Link href="/reunioes?tab=atas" className={`${tabBase} ${tab === "atas" ? tabActive : tabIdle}`}>Atas <span className={`rounded-full px-2 py-0.5 text-xs ${tab === "atas" ? "bg-white/20" : "bg-white"}`}>{counts.atas}</span></Link>
        </nav>

        {tab === "proxima" && (
          <section className="flex flex-col gap-4">
            {/* Bloco A */}
            <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200/60">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900"><ListChecks size={20} className="text-[#2195B9]" /> Pauta confirmada</h2>
                <span className="rounded-full bg-[#E6E6E6] px-3 py-1 text-sm font-medium text-[#28627B]">{pendentes.length} {pendentes.length === 1 ? "pauta" : "pautas"}</span>
              </div>

              {ataProxima && (
                <Link href={`/reunioes/${ataProxima.id}`} className="mt-3 flex items-center gap-3 rounded-xl border border-[#2195B9]/20 bg-[#2195B9]/5 px-4 py-3 text-sm text-[#2195B9] hover:bg-[#2195B9]/10">
                  <FileText size={16} /> {ataProxima.titulo} <span className="text-xs text-zinc-600">· Ver ata</span>
                </Link>
              )}

              {pendentes.length === 0 ? (
                <div className="flex max-h-[160px] flex-col items-center justify-center gap-3 py-8 text-center">
                  <p className="text-base text-zinc-600">Ainda não há pautas. Sugira o primeiro assunto.</p>
                  <PedirPautaTrigger className="!min-h-10 !text-base" />
                </div>
              ) : (
                <ol className="mt-4 flex flex-col gap-2">
                  {pendentes.map((p: any, i: number) => (
                    <li key={p.id} className="flex flex-col gap-1.5 rounded-xl border border-zinc-200 p-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E6E6E6] text-sm font-semibold text-[#28627B]">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-semibold text-zinc-900">{p.titulo}</p>
                          <p className="text-sm text-zinc-600">por {p.autor}</p>
                        </div>
                      </div>
                      {p.contexto && <p className="whitespace-pre-wrap pl-10 text-sm leading-relaxed text-zinc-700">{p.contexto}</p>}
                      {(canManagePauta || p.criadoPor === user.id) && <div className="pl-10"><PautaItemActions pautaId={p.id} status={p.status} standBy={p.standBy} atasDisponiveis={rows.map((r) => ({ id: r.id, titulo: r.titulo, data_reuniao: r.data_reuniao }))} /></div>}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* Bloco B - Em espera */}
            <details className="rounded-xl border border-zinc-200 bg-zinc-50/60" open={emEspera.length > 0 && pendentes.length === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2"><Clock size={16} className="text-zinc-500" /> Em espera ({emEspera.length})</span>
                <span className="text-xs text-zinc-500">Expandir</span>
              </summary>
              <ul className="flex flex-col gap-1.5 border-t border-zinc-200 px-4 py-3">
                {emEspera.length === 0 ? <li className="text-sm text-zinc-500">Nenhuma pauta em espera.</li> : emEspera.map((p: any) => (
                  <li key={p.id} className="flex items-start gap-2 text-sm text-zinc-600">
                    <Clock size={14} className="mt-1 shrink-0 text-zinc-400" />
                    <span className="flex-1">{p.titulo} <span className="text-xs text-zinc-500">· por {p.autor}</span></span>
                    {(canManagePauta || p.criadoPor === user.id) && <PautaItemActions pautaId={p.id} status={p.status} standBy={p.standBy} atasDisponiveis={rows.map((r) => ({ id: r.id, titulo: r.titulo, data_reuniao: r.data_reuniao }))} />}
                  </li>
                ))}
              </ul>
            </details>
          </section>
        )}

        {tab === "pautas" && <PautasTab pautas={pautas} />}
        {tab === "atas" && <AtasTab atas={rows} />}
      </div>

      {/* FAB mobile - Pedir pauta */}
      <PedirPautaTrigger variant="fab" />
    </PageContainer>
  );
}
