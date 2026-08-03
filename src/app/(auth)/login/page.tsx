import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const erro = params.erro;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-16">
      <div className="flex w-full max-w-md flex-col gap-4 text-center">
        <h1 className="text-3xl font-semibold text-zinc-900">
          Entrar no EctoDash
        </h1>
        <p className="text-xl text-zinc-700">
          Digite seu e-mail institucional abaixo. Enviaremos um link de
          acesso por e-mail — não é preciso criar ou digitar nenhuma senha.
        </p>
        {erro === "link_invalido" && (
          <p className="text-xl font-medium text-red-700">
            O link expirou ou já foi usado. Peça um novo link de acesso
            abaixo.
          </p>
        )}
      </div>
      <LoginForm />
    </main>
  );
}
