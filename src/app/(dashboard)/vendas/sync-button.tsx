"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

export default function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/wp/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult(
          `Sincronizado: ${data.products ?? 0} produtos, ${data.orders ?? 0} pedidos, ${data.customers ?? 0} clientes`
        );
        // Refresh the page to show new data after a short delay.
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setResult(`Erro: ${data.error ?? "desconhecido"}`);
      }
    } catch {
      setResult("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleSync}
        disabled={loading}
        className="flex min-h-14 items-center gap-2 rounded-lg bg-[#2195B9] px-4 py-3 text-lg font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw
          size={20}
          aria-hidden="true"
          className={loading ? "animate-spin" : ""}
        />
        {loading ? "Sincronizando..." : "Sincronizar agora"}
      </button>
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
