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
    <main className="flex min-h-full flex-1 items-stretch bg-zinc-50">
      {/* Brand panel — visual/descriptive side, hidden on small screens
          where the form takes the full width. Decorative content carries
          aria-hidden; the form below is the sole focusable content. */}
      <aside
        aria-hidden="true"
        className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-blue-800 via-blue-700 to-blue-600 p-12 text-white lg:flex"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl font-bold">
            E
          </span>
          <span className="text-3xl font-semibold">EctoDash</span>
        </div>

        <div className="flex flex-col gap-6">
          <h2 className="text-4xl font-semibold leading-tight">
            Tudo que a instituição precisa, em um só lugar.
          </h2>
          <ul className="flex flex-col gap-4 text-xl text-blue-50">
            <li className="flex items-center gap-3">
              <CheckCircle2 size={24} className="shrink-0 text-blue-100" />
              Demandas e prazos sem perseguição manual
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 size={24} className="shrink-0 text-blue-100" />
              Lembretes automáticos por e-mail
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 size={24} className="shrink-0 text-blue-100" />
              Visão geral do coordenador e das finanças
            </li>
          </ul>
        </div>

        <p className="text-base text-blue-100">
          Acesso exclusivo para voluntários da instituição.
        </p>
      </aside>

      <section className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
        <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-2xl font-bold text-white">
              E
            </span>
            <span className="text-3xl font-semibold text-zinc-900">
              EctoDash
            </span>
          </div>
          <h1 className="text-3xl font-semibold text-zinc-900">
            Entrar no EctoDash
          </h1>
          <p className="text-xl text-zinc-700">
            Digite seu e-mail institucional abaixo. Enviaremos um link de
            acesso por e-mail — não é preciso criar ou digitar nenhuma senha.
            Na primeira vez, você escolherá seu nome na lista de voluntários
            para vincular o cadastro.
          </p>
          {erro === "link_invalido" && (
            <p className="text-xl font-medium text-red-700">
              O link expirou ou já foi usado. Peça um novo link de acesso
              abaixo.
            </p>
          )}
        </div>
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
