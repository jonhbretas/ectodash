import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "./sidebar";

// The (dashboard) group shell: one role read shared by the sidebar (menu
// visibility is UX-only; every destination keeps its own server-side gate
// and RLS as the real boundary). The mobile top bar + desktop sidebar live
// here so no page renders them individually.
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
    .select("role")
    .eq("id", user.id)
    .single();

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
