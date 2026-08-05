import { CheckCircle2 } from "lucide-react";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const erro = params.erro;

  return (
    <main className="flex min-h-dvh flex-1 items-stretch bg-gradient-to-br from-slate-50 via-white to-[#E6E6E6]/20">
      <aside
        aria-hidden="true"
        className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-[#28627B] via-[#28627B] to-[#2195B9] p-12 text-white lg:flex"
      >
        <div className="flex items-center gap-3">
            <img src="/logo-ectolab.png" alt="EctoLab" className="h-12" />
        </div>

        <div className="flex flex-col gap-6">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Tudo que a instituição precisa, em um só lugar.
          </h2>
          <ul className="flex flex-col gap-4 text-lg text-[#faf0e4]">
            <li className="flex items-center gap-3">
              <CheckCircle2 size={22} className="shrink-0 text-[#f5e6d3]" strokeWidth={1.5} />
              Demandas e prazos sem perseguição manual
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 size={22} className="shrink-0 text-[#f5e6d3]" strokeWidth={1.5} />
              Lembretes automáticos por e-mail
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 size={22} className="shrink-0 text-[#f5e6d3]" strokeWidth={1.5} />
              Visão geral do coordenador e das finanças
            </li>
          </ul>
        </div>

        <p className="text-sm text-[#f5e6d3]">
          Acesso exclusivo para voluntários da instituição.
        </p>
      </aside>

      <section className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
        <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-3 lg:hidden">
          <img src="/logo-ectolab.png" alt="EctoLab" className="h-12" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Entrar no EctoDash
          </h1>
          <p className="text-sm text-slate-600">
            Digite seu e-mail principal abaixo. Enviaremos um link de acesso
            por e-mail — não é preciso criar ou digitar nenhuma senha.
            Na primeira vez, você escolherá seu nome na lista de voluntários
            para vincular o cadastro.
          </p>
          {erro === "link_invalido" && (
            <p className="text-sm font-medium text-red-600">
              O link expirou ou já foi usado. Peça um novo link de acesso
              abaixo.
            </p>
          )}
        </div>
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
