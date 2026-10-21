// /contrato/<token> — formulário público: o aluno preenche os próprios dados,
// confere a prévia do contrato e confirma; o contrato segue para assinatura
// na Assinafy. Sem login. Travas anti-duplicidade em lib/contratos/formulario.ts.
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  carregarFormularioPublico,
  formularioLotado,
} from "@/lib/contratos/formulario";
import { ALUNO_CAMPOS } from "@/lib/contratos/aluno";
import FormularioContratoClient from "./formulario-client";

export const metadata = {
  title: "Contrato — Ectolab",
  robots: "noindex, nofollow",
};

export const dynamic = "force-dynamic";

function formatarData(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export default async function FormularioContratoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();
  const carga = await carregarFormularioPublico(admin, token);
  const lotado = carga.ok ? await formularioLotado(admin, carga.formulario.id) : false;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col items-center gap-4 text-center">
          <Image src="/logo-ectolab.png" alt="Ectolab" width={180} height={68} priority />
          {carga.ok && (
            <>
              <h1 className="text-3xl font-semibold text-zinc-900">{carga.formulario.titulo}</h1>
              <p className="text-lg text-zinc-600">
                {carga.formulario.modelo.titulo}
                {carga.formulario.evento
                  ? ` · ${carga.formulario.evento.titulo}${
                      carga.formulario.evento.data_evento
                        ? ` (${formatarData(carga.formulario.evento.data_evento)})`
                        : ""
                    }`
                  : ""}
              </p>
            </>
          )}
        </header>

        {!carga.ok || lotado ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm" role="alert">
            <p className="text-xl text-zinc-700">
              {carga.ok ? "Este formulário atingiu o limite de respostas. Fale com a organização." : carga.motivo}
            </p>
          </div>
        ) : (
          <FormularioContratoClient
            token={token}
            instrucoes={carga.formulario.instrucoes}
            envioAutomatico={carga.formulario.envioAutomatico}
            campos={carga.formulario.campos.map((campo) => ({
              campo,
              label: ALUNO_CAMPOS.find((c) => c.campo === campo)?.label ?? campo,
            }))}
          />
        )}

        <p className="text-center text-sm text-zinc-500">
          Ectolab — Associação Internacional de Pesquisa Laboratorial em Ectoplasmia e Paracirurgia.
          <br />
          Seus dados são usados apenas para emitir este contrato.
        </p>
      </div>
    </main>
  );
}
