"use client";

import { CalendarRange, RefreshCw } from "lucide-react";
import { useState } from "react";

type SyncMode = "latest" | "period";

const PRESETS = [
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
  { label: "6 meses", days: 182 },
  { label: "12 meses", days: 365 },
];

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function SyncButton({
  oldestOrderDate,
  oldestProductDate,
}: {
  oldestOrderDate?: string | null;
  oldestProductDate?: string | null;
}) {
  const [loading, setLoading] = useState<SyncMode | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showPeriod, setShowPeriod] = useState(false);

  function applyPreset(days: number) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setFromDate(toInputDate(from));
    setToDate(toInputDate(to));
  }

  async function handleSync(mode: SyncMode, after?: string, before?: string) {
    setLoading(mode);
    setResult(null);
    try {
      const res = await fetch("/api/wp/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "period"
            ? { mode, after, before }
            : { mode }
        ),
      });
      const data = await res.json();
      if (res.ok) {
        const counts = `: ${data.products ?? 0} produtos, ${data.orders ?? 0} pedidos, ${data.customers ?? 0} clientes`;
        setResult(
          mode === "period"
            ? `Período importado${counts}`
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

  function handlePeriodSearch() {
    if (!fromDate) {
      setResult("Escolha a data inicial do período");
      return;
    }
    if (toDate && toDate < fromDate) {
      setResult("A data final deve ser depois da inicial");
      return;
    }
    const after = `${fromDate}T00:00:00.000Z`;
    const before = toDate ? `${toDate}T23:59:59.999Z` : undefined;
    handleSync("period", after, before);
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <button
        type="button"
        onClick={() => handleSync("latest")}
        disabled={loading !== null}
        className="flex min-h-14 items-center gap-2 self-end rounded-lg bg-[#2195B9] px-4 py-3 text-lg font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw
          size={20}
          aria-hidden="true"
          className={loading === "latest" ? "animate-spin" : ""}
        />
        {loading === "latest" ? "Sincronizando..." : "Sincronizar agora"}
      </button>

      <div className="w-full rounded-xl border border-zinc-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <button
          type="button"
          onClick={() => setShowPeriod((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-2 text-lg font-medium text-zinc-800">
            <CalendarRange size={20} aria-hidden="true" className="text-[#2195B9]" />
            Buscar dados mais antigos
          </span>
          <span
            aria-hidden="true"
            className={`text-sm text-zinc-500 transition-transform ${showPeriod ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </button>

        {showPeriod && (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.days)}
                  className="min-h-10 rounded-full border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-600">De</span>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="min-h-12 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-600">Até</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  max={toInputDate(new Date())}
                  onChange={(e) => setToDate(e.target.value)}
                  className="min-h-12 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={handlePeriodSearch}
              disabled={loading !== null}
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#2195B9] bg-[#2195B9]/5 px-4 py-2.5 text-base font-medium text-[#1d7a98] transition-colors hover:bg-[#2195B9]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CalendarRange
                size={18}
                aria-hidden="true"
                className={loading === "period" ? "animate-pulse" : ""}
              />
              {loading === "period"
                ? "Buscando período..."
                : "Buscar período selecionado"}
            </button>
            <p className="text-sm text-zinc-500">
              Períodos longos (6 ou 12 meses) podem demorar alguns minutos.
            </p>
          </div>
        )}
      </div>

      {result && (
        <span
          className={`self-end text-base font-medium ${
            result.startsWith("Erro") || result.includes("Escolha") || result.includes("deve ser")
              ? "text-red-600"
              : "text-green-700"
          }`}
        >
          {result}
        </span>
      )}

      {(oldestOrderDate || oldestProductDate) && (
        <span className="self-end text-sm text-zinc-500">
          Dados importados até: pedidos desde{" "}
          <strong className="font-medium text-zinc-700">
            {oldestOrderDate
              ? new Date(oldestOrderDate).toLocaleDateString("pt-BR")
              : "—"}
          </strong>
          {oldestProductDate && (
            <>
              {" "}· produtos desde{" "}
              <strong className="font-medium text-zinc-700">
                {new Date(oldestProductDate).toLocaleDateString("pt-BR")}
              </strong>
            </>
          )}
        </span>
      )}
    </div>
  );
}
