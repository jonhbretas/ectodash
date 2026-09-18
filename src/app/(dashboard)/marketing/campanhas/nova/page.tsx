import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageContainer from "../../../page-container";
import { requireMarketingGate } from "../../page";
import CampaignEditorClient from "./campaign-editor-client";

export default async function NovaCampanhaPage() {
  const gate = await requireMarketingGate();
  if (gate.blocked) {
    return (
      <PageContainer>
        <p className="py-16 text-center text-lg text-zinc-500">Acesso restrito ao coordenador geral.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex w-full flex-col gap-8">
        <Link href="/marketing" className="inline-flex w-fit items-center gap-1.5 text-base font-medium text-zinc-400 hover:text-zinc-600">
          <ArrowLeft size={16} aria-hidden="true" /> Voltar ao Marketing
        </Link>
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900">Nova campanha</h1>
          <p className="mt-1 text-lg text-zinc-500">Remetente: Ectolab &lt;contato@ectolab.org&gt; · o rodapé de descadastro entra sozinho.</p>
        </div>
        <CampaignEditorClient />
      </div>
    </PageContainer>
  );
}
