import Link from "next/link";
import { Lock, Mail, Users, Plus, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";

function GateBloqueado() {
  return (
    <PageContainer>
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <Lock size={48} className="text-slate-400" aria-hidden="true" />
        <h1 className="text-3xl font-semibold text-slate-900">Marketing é exclusivo do coordenador e da comunicação</h1>
        <p className="max-w-md text-lg text-slate-600">Você não tem acesso ao módulo de disparos. Toque abaixo para voltar.</p>
        <Link href="/" className="flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-[#2195B9] to-[#FDBA2F] px-5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(33,149,185,0.25)]">
          Voltar ao início
        </Link>
      </div>
    </PageContainer>
  );
}

export async function requireMarketingGate() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { blocked: true as const };
  // Coordenador geral entra sempre; demais só com cargo que tenha o
  // módulo "marketing" concedido (ex.: equipe de comunicação) —
  // a RLS (0104) aplica a mesma regra no banco.
  const [{ data: profile }, { data: cargos }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.rpc("meus_cargos"),
  ]);
  const temModuloMarketing = ((cargos ?? []) as { modulos: string[] }[]).some(
    (c) => (c.modulos ?? []).includes("marketing")
  );
  if (profile?.role !== "coordenador_geral" && !temModuloMarketing) {
    return { blocked: true as const };
  }
  return { blocked: false as const, supabase };
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  queued: "Na fila",
  sending: "Disparando",
  sent: "Enviada",
  failed: "Falhou",
};

export default async function MarketingPage() {
  const gate = await requireMarketingGate();
  if (gate.blocked) return <GateBloqueado />;
  const { supabase } = gate;

  const [ativos, descad, campanhas] = await Promise.all([
    supabase.from("marketing_leads").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("marketing_leads").select("id", { count: "exact", head: true }).eq("status", "unsubscribed"),
    supabase.from("marketing_campaigns").select("id, titulo, assunto, status, total, sent_count, created_at").order("created_at", { ascending: false }).limit(10),
  ]);

  return (
    <PageContainer>
      <div className="flex w-full flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-900">Marketing</h1>
            <p className="mt-1 text-lg text-zinc-500">
              Base de leads, campanhas e disparos via <span className="font-medium">contato@ectolab.org</span>
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/marketing/leads" className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-base font-medium text-slate-700 hover:bg-slate-50">
              <Upload size={18} aria-hidden="true" /> Importar leads
            </Link>
            <Link href="/marketing/campanhas/nova" className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#2195B9] px-4 text-base font-medium text-white hover:bg-[#1a7a98]">
              <Plus size={18} aria-hidden="true" /> Nova campanha
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-slate-500"><Users size={18} aria-hidden="true" /><span className="text-base">Leads ativos</span></div>
            <p className="mt-1 text-4xl font-semibold text-zinc-900">{ativos.count ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-slate-500"><Users size={18} aria-hidden="true" /><span className="text-base">Descadastrados</span></div>
            <p className="mt-1 text-4xl font-semibold text-zinc-900">{descad.count ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-slate-500"><Mail size={18} aria-hidden="true" /><span className="text-base">Plano Resend</span></div>
            <p className="mt-1 text-lg font-medium text-zinc-900">Pro — 50 mil/mês</p>
            <p className="text-sm text-slate-500">15 mil leads × 4 disparos = 60 mil: considere o plano de $35 (100 mil).</p>
          </div>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-zinc-900">Campanhas recentes</h2>
          {(campanhas.data ?? []).length === 0 && (
            <p className="text-lg text-zinc-500">Nenhuma campanha ainda. Crie a primeira acima.</p>
          )}
          {(campanhas.data ?? []).map((c) => (
            <Link key={c.id} href={`/marketing/campanhas/${c.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-[#2195B9]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-medium text-zinc-900">{c.titulo as string}</p>
                  <p className="text-base text-zinc-500">{c.assunto as string}</p>
                </div>
                <div className="flex items-center gap-3">
                  {(c.status as string) === "sent" && (
                    <span className="text-base text-zinc-500">{c.sent_count as number}/{c.total as number} enviados</span>
                  )}
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                    {STATUS_LABEL[c.status as string] ?? c.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </PageContainer>
  );
}
