import DescadastrarFormClient from "./descadastrar-form-client";

export const metadata = {
  title: "Descadastrar — Ectolab",
  robots: "noindex, nofollow",
};

export default async function DescadastrarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const raw = params.token;
  const token = Array.isArray(raw) ? raw[0] : raw;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="flex w-full max-w-lg flex-col items-center gap-5 rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <h1 className="text-3xl font-semibold text-zinc-900">Não receber mais e-mails</h1>
        {!token ? (
          <p className="text-lg text-zinc-600" role="alert">
            Link incompleto. Use o botão do rodapé do e-mail que você recebeu.
          </p>
        ) : (
          <>
            <p className="text-lg text-zinc-600">
              Toque abaixo para sair da lista de marketing da Ectolab. Você some da base de disparos na hora.
            </p>
            <DescadastrarFormClient token={token} />
          </>
        )}
      </div>
    </main>
  );
}
