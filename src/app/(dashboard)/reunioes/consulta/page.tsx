import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../page-container";
import ConsultaAtas from "./consulta-atas";
import { CAMPOS_CONSULTA, mapearAtaConsulta, type AtaConsulta } from "../_lib/consulta-atas";

export const metadata = { title: "Consultar atas — EctoDash" };

export default async function ConsultaAtasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Load all accessible rows, including beyond the API's default row limit.
  // The session client applies the same RLS permissions as the ata detail page.
  const atas: AtaConsulta[] = [];
  let falha = false;
  const tamanhoPagina = 500;
  for (let inicio = 0; ; inicio += tamanhoPagina) {
    const { data, error } = await supabase.from("reunioes")
      .select(`id, data_reuniao, ${Object.keys(CAMPOS_CONSULTA).join(", ")}`)
      .order("data_reuniao", { ascending: false })
      .order("id", { ascending: false })
      .range(inicio, inicio + tamanhoPagina - 1);
    if (error) { falha = true; break; }
    const pagina = (data ?? []) as unknown as Parameters<typeof mapearAtaConsulta>[0][];
    atas.push(...pagina.map(mapearAtaConsulta));
    if (pagina.length < tamanhoPagina) break;
  }

  return (
    <PageContainer>
      <div className="flex w-full flex-col gap-5">
        <Link href="/reunioes?tab=atas" className="inline-flex min-h-11 items-center gap-2 self-start text-base font-medium text-[#28627B] hover:underline"><ArrowLeft size={18} aria-hidden="true" /> Voltar para atas</Link>
        <header className="space-y-2">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900"><Search size={28} aria-hidden="true" /> Consultar atas</h1>
          <p className="max-w-3xl text-base text-zinc-600">Localize datas, assuntos, participantes e decisões no conteúdo registrado das atas. Busque por palavras, com ou sem acentos, e combine com um período.</p>
        </header>
        {falha ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">Não foi possível carregar as atas. Recarregue a página para tentar novamente.</div>
        ) : <ConsultaAtas atas={atas} />}
      </div>
    </PageContainer>
  );
}
