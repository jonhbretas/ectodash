import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageContainer from "../../../page-container";
import { requireMarketingGate } from "../../page";
import DispatchClient from "./dispatch-client";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  queued: "Na fila",
  sending: "Disparando",
  sent: "Enviada",
  failed: "Falhou",
};

export default async function CampanhaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaignId = Number(id);
  const gate = await requireMarketingGate();
  if (gate.blocked || !Number.isInteger(campaignId)) {
    return (
      <PageContainer>
        <p className="py-16 text-center text-lg text-zinc-500">Campanha não encontrada ou sem acesso.</p>
      </PageContainer>
    );
  }
  const { supabase } = gate;

  const { data: campaign } = await supabase
    .from("marketing_campaigns")
    .select("id, titulo, assunto, html, status, total, sent_count, failed_count, skipped_count, created_at")
    .eq("id", campaignId)
    .single();

  if (!campaign) {
    return (
      <PageContainer>
        <p className="py-16 text-center text-lg text-zinc-500">Campanha não encontrada.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex w-full flex-col gap-8">
        <Link href="/marketing" className="inline-flex w-fit items-center gap-1.5 text-base font-medium text-zinc-400 hover:text-zinc-600">
          <ArrowLeft size={16} aria-hidden="true" /> Voltar ao Marketing
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-900">{campaign.titulo as string}</h1>
            <p className="mt-1 text-lg text-zinc-500">Assunto: {campaign.assunto as string}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-1.5 text-base font-medium text-slate-700">
            {STATUS_LABEL[campaign.status as string] ?? campaign.status}
          </span>
        </div>

        <DispatchClient
          campaignId={campaignId}
          status={campaign.status as string}
          total={(campaign.total as number) ?? 0}
          sentCount={(campaign.sent_count as number) ?? 0}
          failedCount={(campaign.failed_count as number) ?? 0}
          skippedCount={(campaign.skipped_count as number) ?? 0}
        />

        <section className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-zinc-900">Conteúdo (com rodapé de descadastro automático no envio)</h2>
          <iframe
            title="Conteúdo da campanha"
            sandbox=""
            srcDoc={(campaign.html as string) || ""}
            className="min-h-[480px] w-full rounded-xl border border-slate-200 bg-white"
          />
        </section>
      </div>
    </PageContainer>
  );
}
