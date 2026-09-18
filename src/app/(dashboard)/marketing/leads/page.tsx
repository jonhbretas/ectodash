import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageContainer from "../../page-container";
import { requireMarketingGate } from "../page";
import LeadsUploadClient from "./leads-upload-client";

export default async function LeadsPage() {
  const gate = await requireMarketingGate();
  if (gate.blocked) {
    return (
      <PageContainer>
        <p className="py-16 text-center text-lg text-zinc-500">Acesso restrito ao coordenador geral.</p>
      </PageContainer>
    );
  }
  const { supabase } = gate;

  const [ativos, quarentena, descad] = await Promise.all([
    supabase.from("marketing_leads").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("marketing_leads").select("id", { count: "exact", head: true }).eq("status", "invalid"),
    supabase.from("marketing_leads").select("id", { count: "exact", head: true }).eq("status", "unsubscribed"),
  ]);

  return (
    <PageContainer>
      <div className="flex w-full flex-col gap-8">
        <Link href="/marketing" className="inline-flex w-fit items-center gap-1.5 text-base font-medium text-zinc-400 hover:text-zinc-600">
          <ArrowLeft size={16} aria-hidden="true" /> Voltar ao Marketing
        </Link>
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900">Base de leads</h1>
          <p className="mt-1 text-lg text-zinc-500">
            {ativos.count ?? 0} ativos · {descad.count ?? 0} descadastrados (fora dos disparos) · {quarentena.count ?? 0} inválidos
          </p>
        </div>
        <LeadsUploadClient />
      </div>
    </PageContainer>
  );
}
