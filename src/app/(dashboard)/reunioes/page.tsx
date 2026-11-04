import Link from "next/link";
import { redirect } from "next/navigation";
import { ListTodo, NotebookPen, PlusCircle, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import AtasTab from "./_components/atas-tab";

type Props = { searchParams?: Promise<{ tab?: string }> };

export default async function AtasPage({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  // Links antigos (/reunioes?tab=pautas|historico) agora vivem em /reunioes/pautas.
  if (sp.tab === "pautas" || sp.tab === "proxima") redirect("/reunioes/pautas");
  if (sp.tab === "historico") redirect("/reunioes/pautas?tab=historico");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [atasResult, dipsResult] = await Promise.all([
    supabase.from("reunioes").select("id, titulo, data_reuniao, horario, status, resumo, participantes, deliberacoes").order("data_reuniao", { ascending: false }),
    supabase.from("dips").select("ata_id"),
  ]);

  const dipCountByAta = new Map<number, number>();
  for (const r of dipsResult.data ?? []) dipCountByAta.set(r.ata_id, (dipCountByAta.get(r.ata_id) ?? 0) + 1);
  const rows = (atasResult.data ?? []).map((r) => ({ id: r.id, titulo: r.titulo, data_reuniao: r.data_reuniao, horario: r.horario, status: (r as { status?: string | null }).status ?? null, resumo: r.resumo, participantes: r.participantes, deliberacoes: r.deliberacoes, dipCount: dipCountByAta.get(r.id) ?? 0 }));

  return (
    <PageContainer>
      <div className="flex w-full flex-col gap-5">
        <header className="flex w-full flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900"><NotebookPen size={28} /> Atas de reunião</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">Consulte as atas registradas, as decisões tomadas e o que foi combinado em cada reunião.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/reunioes/nova" className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-5 text-base font-semibold text-white hover:bg-[#1d6f8d]"><PlusCircle size={18} /> Registrar ata</Link>
            <Link href="/analisar" className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-base font-medium text-zinc-900 hover:bg-zinc-50"><Sparkles size={18} /> Analisar por IA</Link>
            <Link href="/reunioes/pautas" className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-base font-medium text-zinc-900 hover:bg-zinc-50"><ListTodo size={18} /> Pedidos de pauta</Link>
          </div>
        </header>

        <AtasTab atas={rows} />
      </div>
    </PageContainer>
  );
}
