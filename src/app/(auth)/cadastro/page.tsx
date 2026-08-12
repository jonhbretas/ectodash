import { CheckCircle2 } from "lucide-react";
import CadastroForm from "./cadastro-form";

export default function CadastroPage() {
  return (
    <main className="flex min-h-dvh flex-1 items-stretch bg-gradient-to-br from-slate-50 via-white to-[#E6E6E6]/20">
      <aside
        aria-hidden="true"
        className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-[#28627B] via-[#28627B] to-[#2195B9] p-12 text-white lg:flex"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white p-2">
            <img src="/logo-ectolab.png" alt="EctoLab" className="h-10" />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Crie sua conta no EctoDash.
          </h2>
          <ul className="flex flex-col gap-4 text-lg text-[#faf0e4]">
            <li className="flex items-center gap-3">
              <CheckCircle2 size={22} className="shrink-0 text-[#f5e6d3]" strokeWidth={1.5} />
              Cadastro rápido com e-mail e senha
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 size={22} className="shrink-0 text-[#f5e6d3]" strokeWidth={1.5} />
              Verificação de e-mail para sua segurança
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 size={22} className="shrink-0 text-[#f5e6d3]" strokeWidth={1.5} />
              Acesse de qualquer dispositivo
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
            Criar conta
          </h1>
          <p className="text-sm text-slate-600">
            Preencha seus dados abaixo para criar sua conta. Você receberá um
            e-mail de verificação para confirmar seu cadastro.
          </p>
        </div>
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60">
          <CadastroForm />
        </div>
      </section>
    </main>
  );
}
