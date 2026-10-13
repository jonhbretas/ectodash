"use client";

// Scoped error boundary for /reunioes/analisar — shows the digest so the
// underlying failure (AI gateway, timeout, render) can be reported instead
// of wiping into the global "Ops, algo deu errado" page.
export default function AnalisarReuniaoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("analisar reunioes error:", error);
  const actionDesatualizada =
    error.message.includes("Server Action") &&
    error.message.includes("was not found on the server");

  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5">
      <h1 className="text-xl font-semibold text-red-900">
        {actionDesatualizada
          ? "A página precisa ser atualizada"
          : "Não foi possível concluir a análise"}
      </h1>
      {actionDesatualizada ? (
        <p className="text-base text-red-800">
          O sistema foi atualizado enquanto esta página estava aberta. Atualize
          a página e envie a análise novamente.
        </p>
      ) : (
        <p className="text-base text-red-800">
          Anote este código e me envie:{" "}
          <code className="rounded bg-white px-2 py-0.5 font-mono text-sm">
            {error.digest ?? error.message ?? "sem-digest"}
          </code>
        </p>
      )}
      <button
        type="button"
        onClick={() =>
          actionDesatualizada ? window.location.reload() : reset()
        }
        className="rounded-xl bg-[#2195B9] px-5 py-2.5 text-base font-medium text-white hover:bg-[#28627B]"
      >
        {actionDesatualizada ? "Atualizar página" : "Tentar novamente"}
      </button>
    </div>
  );
}
