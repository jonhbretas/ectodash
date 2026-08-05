// /voluntarios/localidades — cadastro das localidades (regiões/cidades) dos
// voluntários (voluntario_localidades, migration 0025), acessível pela tela
// de voluntários. O CRUD é exclusivo do coordenador_geral (RLS é o limite
// real; este é o gate de UX, como o /areas).
import Link from "next/link";
import { ArrowLeft, Lock, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../page-container";
import LocalidadesVoluntarioConfig from "../localidades-config";

export default async function LocalidadesVoluntarioPage() {
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
            Você não tem acesso ao cadastro de localidades dos voluntários.
          </p>
          <Link
            href="/voluntarios"
            className="flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-[#d4883a] to-[#e8a85c] px-5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(212,136,58,0.25)] transition-all duration-200 hover:from-[#c07828] hover:to-[#d4883a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]"
          >
            Voltar para a equipe
          </Link>
        </div>
      </PageContainer>
    );
  }

  const { data: localidades } = await supabase
    .from("voluntario_localidades")
    .select("id, nome")
    .order("nome");

  return (
    <PageContainer>
      <Link
        href="/voluntarios"
        className="inline-flex w-fit items-center gap-1.5 text-base font-medium text-zinc-400 transition-colors hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar para os voluntários
      </Link>

      <header className="flex w-full flex-col gap-1">
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
          <MapPin size={30} aria-hidden="true" />
          Localidades dos voluntários
        </h1>
        <p className="max-w-2xl text-xl text-zinc-500">
          Regiões/cidades de atuação da equipe — usadas no filtro de
          localidade e na análise por região.
        </p>
      </header>

      <LocalidadesVoluntarioConfig
        localidades={(localidades ?? []).map((l) => ({
          id: l.id,
          nome: l.nome,
        }))}
      />
    </PageContainer>
  );
}
