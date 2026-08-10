// /dips/cadastro — cadastro independente de DIP, sem vínculo com reunião.
// Botão no topo leva ao cadastro de localidades (/dips/localidades).
import Link from "next/link";
import { ArrowLeft, MapPin, PlusCircle, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../page-container";
import CadastroDipForm from "./cadastro-dip-form";

export default async function CadastroDipPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: localidades } = await supabase
    .from("dip_localidades")
    .select("localidade, pais")
    .order("localidade");

  return (
    <PageContainer>
      <Link
        href="/dips"
        className="inline-flex w-fit items-center gap-1.5 text-base font-medium text-zinc-400 transition-colors hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar para as DIPs
      </Link>

      <header className="flex w-full flex-col gap-1">
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
          <PlusCircle size={30} aria-hidden="true" />
          Cadastro de DIP
        </h1>
        <p className="max-w-2xl text-xl text-zinc-500">
          Registre uma Dinâmica DIP de forma independente, sem vínculo com
          uma reunião.
        </p>
      </header>

      <Link
        href="/dips/localidades"
        className="flex w-fit items-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-3 text-lg font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900"
      >
        <Settings size={18} aria-hidden="true" />
        <MapPin size={18} aria-hidden="true" className="text-amber-500" />
        Cadastro de localidade
      </Link>

      <section className="flex w-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
        <CadastroDipForm
          localidades={(localidades ?? []).map((l) => ({
            localidade: l.localidade,
            pais: l.pais,
          }))}
        />
      </section>
    </PageContainer>
  );
}
