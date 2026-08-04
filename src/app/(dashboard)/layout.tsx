import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "./sidebar";

// The (dashboard) group shell: one role read shared by the sidebar (menu
// visibility is UX-only; every destination keeps its own server-side gate
// and RLS as the real boundary). Also gates soft-deleted accounts (ativo =
// false, migration 0014): a disabled volunteer gets a clear screen instead
// of the app. And routes brand-new accounts to the self-link flow
// (vincular_pendente, migration 0017): until the volunteer chooses their
// name in the institutional roster at /vincular, every dashboard page
// redirects there — the roster search/link functions (0017) require the
// pending flag, so the flow cannot be skipped or revisited later.
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware (src/proxy.ts) already redirects unauthenticated visitors
  // away from this group; the null-return guard keeps the layout correct
  // if it is ever rendered without middleware (e.g. a test harness).
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
        className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 py-16 text-center"
      >
        <Lock size={48} className="text-zinc-400" aria-hidden="true" />
        <h1 className="text-3xl font-semibold text-zinc-900">
          Conta desativada
        </h1>
        <p className="max-w-md text-xl text-zinc-700">
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
    <div className="flex min-h-full flex-1 bg-zinc-50">
      <Sidebar isCoordenador={isCoordenador} isFinanceiro={isFinanceiro} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
