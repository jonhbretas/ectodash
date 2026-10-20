import Link from "next/link";
import { BarChart3, Bot, ChevronRight, LayoutDashboard, Lock, Mail, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";

const atalhos = [
  {
    href: "/painel",
    title: "Painel do coordenador",
    description: "Acompanhe demandas, áreas, responsáveis e alertas institucionais.",
    Icon: LayoutDashboard,
    tone: "bg-sky-50 text-sky-700 ring-sky-100",
  },
  {
    href: "/analise",
    title: "Inteligência",
    description: "Analise indicadores e informações estratégicas da instituição.",
    Icon: BarChart3,
    tone: "bg-violet-50 text-violet-700 ring-violet-100",
  },
  {
    href: "/analisar",
    title: "Analisar com IA",
    description: "Use a IA para examinar documentos e apoiar decisões.",
    Icon: Bot,
    tone: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  },
  {
    href: "/marketing",
    title: "Marketing",
    description: "Planeje campanhas e acompanhe a comunicação institucional.",
    Icon: Mail,
    tone: "bg-rose-50 text-rose-700 ring-rose-100",
  },
  {
    href: "/vendas",
    title: "Loja Ectolab",
    description: "Consulte pedidos, produtos, alunos e o desempenho da loja.",
    Icon: ShoppingCart,
    tone: "bg-amber-50 text-amber-700 ring-amber-100",
  },
];

export default async function AdministrativoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "coordenador_geral") {
    return <AcessoNegado />;
  }

  return (
    <PageContainer>
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-zinc-900">Administrativo</h1>
        <p className="text-lg text-zinc-500">Ferramentas de gestão e acompanhamento institucional.</p>
      </header>
      <section aria-label="Ferramentas administrativas" className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-3">
        {atalhos.map(({ href, title, description, Icon, tone }) => (
          <Link key={href} href={href} className="group flex min-h-44 flex-col justify-between rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]">
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${tone}`}><Icon size={22} aria-hidden="true" /></span>
            <span className="mt-5 flex items-end justify-between gap-3">
              <span><span className="block text-xl font-semibold text-zinc-900">{title}</span><span className="mt-1 block text-base text-zinc-500">{description}</span></span>
              <ChevronRight size={20} className="shrink-0 text-zinc-400 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </section>
    </PageContainer>
  );
}

function AcessoNegado() {
  return <PageContainer><div className="flex flex-col items-center gap-4 py-16 text-center"><Lock size={48} className="text-zinc-400" aria-hidden="true" /><h1 className="text-3xl font-semibold text-zinc-900">Área exclusiva da Coordenação Geral</h1><Link href="/" className="rounded-xl bg-[#2195B9] px-5 py-3 text-lg font-medium text-white">Voltar ao início</Link></div></PageContainer>;
}
