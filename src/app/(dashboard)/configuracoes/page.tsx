import Link from "next/link";
import { ChevronRight, Lock, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "coordenador_geral") {
    return <PageContainer><div className="flex flex-col items-center gap-4 py-16 text-center"><Lock size={48} className="text-zinc-400" aria-hidden="true" /><h1 className="text-3xl font-semibold text-zinc-900">Área exclusiva da Coordenação Geral</h1><Link href="/" className="rounded-xl bg-[#2195B9] px-5 py-3 text-lg font-medium text-white">Voltar ao início</Link></div></PageContainer>;
  }

  return (
    <PageContainer>
      <header className="flex flex-col gap-1"><h1 className="text-3xl font-semibold text-zinc-900">Configurações</h1><p className="text-lg text-zinc-500">Defina quem acessa cada área e quais permissões estão disponíveis.</p></header>
      <section aria-label="Configurações administrativas" className="grid w-full gap-4 md:grid-cols-2">
        <Link href="/painel/acessos" className="group flex min-h-44 flex-col justify-between rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100"><ShieldCheck size={22} aria-hidden="true" /></span>
          <span className="mt-5 flex items-end justify-between gap-3"><span><span className="block text-xl font-semibold text-zinc-900">Acessos e cargos</span><span className="mt-1 block text-base text-zinc-500">Gerencie modelos de cargos, permissões por módulo e acessos das pessoas.</span></span><ChevronRight size={20} className="shrink-0 text-zinc-400 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
        </Link>
      </section>
    </PageContainer>
  );
}
