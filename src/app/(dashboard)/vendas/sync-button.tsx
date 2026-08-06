"use client";

import { History, RefreshCw } from "lucide-react";
import { useState } from "react";

type SyncMode = "latest" | "backfill";

export default function SyncButton() {
  const [loading, setLoading] = useState<SyncMode | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync(mode: SyncMode) {
    setLoading(mode);
    setResult(null);
    try {
      const res = await fetch("/api/wp/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (res.ok) {
        const counts = `: ${data.products ?? 0} produtos, ${data.orders ?? 0} pedidos, ${data.customers ?? 0} clientes`;
        setResult(
          mode === "backfill"
            ? `Dados antigos importados${counts}`
            : `Sincronizado${counts}`
        );
        // Refresh the page to show new data after a short delay.
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setResult(`Erro: ${data.error ?? "desconhecido"}`);
      }
    } catch {
      setResult("Erro de conexão");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => handleSync("latest")}
          disabled={loading !== null}
          className="flex min-h-14 items-center gap-2 rounded-lg bg-[#2195B9] px-4 py-3 text-lg font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw
            size={20}
            aria-hidden="true"
            className={loading === "latest" ? "animate-spin" : ""}
          />
          {loading === "latest" ? "Sincronizando..." : "Sincronizar agora"}
        </button>
        <button
          type="button"
          onClick={() => handleSync("backfill")}
          disabled={loading !== null}
          className="flex min-h-14 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-lg font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <History
            size={20}
            aria-hidden="true"
            className={loading === "backfill" ? "animate-spin" : ""}
          />
          {loading === "backfill"
            ? "Buscando antigos..."
            : "Buscar dados mais antigos"}
        </button>
      </div>
      {result && (
        <span
          className={`text-base font-medium ${
            result.startsWith("Erro") ? "text-red-600" : "text-green-700"
          }`}
        >
          {result}
        </span>
      )}
    </div>
  );
}
