"use client";

// Global error boundary — replaces the default black error screen with a
// friendly, actionable message. Errors here are UNEXPECTED (a known failure
// returns a state object and renders inline); this catches the ones that
// escape, so the user never sees a blank page. The technical detail is
// logged server-side and optionally shown for diagnosis.
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("Unhandled page error:", error);

  const detail = error.digest ?? error.message ?? "";

  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-6 py-16 text-center">
        <AlertTriangle size={48} className="text-zinc-300" aria-hidden="true" />
        <h1 className="text-3xl font-semibold text-zinc-900">
          Ops, algo deu errado
        </h1>
        <p className="max-w-md text-xl text-zinc-500">
          Não foi possível carregar esta página agora. Tente novamente — se o
          problema persistir, recarregue a página.
        </p>
        {detail && (
          <p className="max-w-md break-all rounded-lg bg-zinc-100 px-3 py-2 text-base text-zinc-500">
            Detalhe técnico: {detail}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="flex min-h-14 items-center justify-center rounded-xl bg-[#d4883a] px-6 text-xl font-medium text-white transition-colors hover:bg-[#c07828] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]"
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
