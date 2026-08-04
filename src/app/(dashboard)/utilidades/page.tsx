import Link from "next/link";
import { LayoutDashboard, Sparkles, Wallet, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";

// Utilities hub — quick access to the app's secondary tools. Each entry
// stays gated by its own destination's server-side role check + RLS; this
// page only decides which cards render (UX hiding).
export default async function UtilidadesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  const isCoordenador = role === "coordenador_geral";
  const isFinanceiro = role === "financeiro";
  const canExtract = role === "coordenador_geral" || role === "lider_area";

  const tools: Array<{
    href: string;
    title: string;
    description: string;
    Icon: typeof Wrench;
    show: boolean;
  }> = [
    {
      href: "/demandas/extrair",
      title: "Extrair demandas de reunião",
      description:
        "Cole o resumo de uma reunião e deixe a IA sugerir as demandas para revisar.",
      Icon: Sparkles,
      show: canExtract,
    },
    {
      href: "/painel",
      title: "Painel do coordenador",
      description: "Visão geral de todas as demandas da instituição.",
      Icon: LayoutDashboard,
      show: isCoordenador,
    },
    {
      href: "/financeiro",
      title: "Financeiro",
      description: "Fluxo de caixa sincronizado com a planilha da instituição.",
      Icon: Wallet,
      show: isCoordenador || isFinanceiro,
    },
  ];

  const visibleTools = tools.filter((tool) => tool.show);

  return (
    <PageContainer>
      <div className="flex w-full max-w-4xl flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <Wrench size={28} aria-hidden="true" />
          Utilidades
        </h1>
        <p className="text-base text-zinc-700">
          Ferramentas extras do EctoDash.
        </p>
      </div>

      {visibleTools.length === 0 ? (
        <div className="flex w-full max-w-4xl flex-col items-center gap-4 py-16 text-center">
          <Wrench size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhuma ferramenta disponível para você
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            As ferramentas aparecem aqui conforme o seu papel na instituição.
          </p>
        </div>
      ) : (
        <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
          {visibleTools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <span className="flex items-center gap-2 text-xl font-semibold text-zinc-900">
                <tool.Icon size={20} aria-hidden="true" />
                {tool.title}
              </span>
              <span className="text-base leading-relaxed text-zinc-700">
                {tool.description}
              </span>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
