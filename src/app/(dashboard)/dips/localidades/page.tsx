// /dips/localidades — cadastro das localidades da Dinâmica DIP
// (dip_localidades, migration 0024), acessível pela tela de cadastro de DIP.
// O CRUD é exclusivo do coordenador_geral.
import Link from "next/link";
import { ArrowLeft, Lock, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../page-container";
import LocalidadesConfig from "../localidades-config";

export default async function LocalidadesDipPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "coordenador_geral") {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">
            Este cadastro é exclusivo do coordenador
          </h1>
          <p className="max-w-md text-lg text-zinc-600">
            Você não tem acesso ao cadastro de localidades da DIP.
          </p>
          <Link
            href="/dips/cadastro"
            className="flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-[#2195B9] to-[#FDBA2F] px-5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(33,149,185,0.25)] transition-all duration-200 hover:from-[#28627B] hover:to-[#2195B9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            Voltar ao cadastro
          </Link>
        </div>
      </PageContainer>
    );
  }

  const { data: localidades } = await supabase
    .from("dip_localidades")
    .select("id, localidade, pais")
    .order("localidade");

  return (
    <PageContainer>
      <Link
        href="/dips/cadastro"
        className="inline-flex w-fit items-center gap-1.5 text-base font-medium text-zinc-400 transition-colors hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar ao cadastro de DIP
      </Link>

      <header className="flex w-full flex-col gap-1">
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
          <MapPin size={30} aria-hidden="true" />
          Cadastro de localidades da DIP
        </h1>
        <p className="max-w-2xl text-xl text-zinc-500">
          Padroniza os nomes das localidades usadas nos registros DIP. A
          lista serve de referência ao cadastrar e editar.
        </p>
      </header>

      <LocalidadesConfig
        localidades={(localidades ?? []).map((l) => ({
          id: l.id,
          localidade: l.localidade,
          pais: l.pais,
        }))}
      />
    </PageContainer>
  );
}
