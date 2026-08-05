import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "./sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <>{children}</>;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, ativo, vincular_pendente")
    .eq("id", user.id)
    .single();

  if (profile && profile.vincular_pendente) {
    redirect("/vincular");
  }

  if (profile && profile.ativo === false) {
    return (
      <main
        id="main-content"
        className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-50 to-[#f5f0eb]/30 px-6 py-16 text-center"
      >
        <Lock size={48} className="text-slate-400" aria-hidden="true" />
        <h1 className="text-3xl font-semibold text-slate-900">
          Conta desativada
        </h1>
        <p className="max-w-md text-lg text-slate-600">
          Sua conta foi desativada pelo coordenador. Fale com ele para saber
          mais.
        </p>
      </main>
    );
  }

  const role = profile?.role;
  const isCoordenador = role === "coordenador_geral";
  const isFinanceiro = role === "financeiro";

  return (
    <div className="flex h-dvh overflow-hidden bg-gradient-to-br from-slate-50 via-white to-[#f5f0eb]/20">
      <Sidebar isCoordenador={isCoordenador} isFinanceiro={isFinanceiro} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
