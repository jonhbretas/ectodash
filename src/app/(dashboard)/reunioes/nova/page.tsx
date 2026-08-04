import PageContainer from "../../page-container";
import AtaForm from "../ata-form";

export default async function NovaAtaPage() {
  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold text-zinc-900">Registrar ata</h1>
      <AtaForm />
    </PageContainer>
  );
}
