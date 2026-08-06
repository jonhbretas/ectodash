"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function MonthPicker() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const current = searchParams.get("month") ?? "";
  const [year, month] = current ? current.split("-") : ["", ""];

  function handleChange(yearVal: string, monthVal: string) {
    const params = new URLSearchParams(searchParams);
    if (yearVal && monthVal) {
      params.set("month", `${yearVal}-${monthVal.padStart(2, "0")}`);
    } else {
      params.delete("month");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear - 1, thisYear - 2];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-base font-medium text-zinc-600">Mês:</label>
      <select
        value={month}
        onChange={(e) => handleChange(year || String(thisYear), e.target.value)}
        className="min-h-12 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30"
      >
        <option value="">Todos</option>
        {MONTHS.map((m, i) => (
          <option key={i} value={String(i + 1)}>
            {m}
          </option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => handleChange(e.target.value, month || String(new Date().getMonth() + 1))}
        className="min-h-12 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30"
      >
        <option value="">Ano</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </select>
      {current && (
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams(searchParams);
            params.delete("month");
            router.push(`${pathname}?${params.toString()}`);
          }}
          className="min-h-12 rounded-xl bg-zinc-100 px-4 text-base font-medium text-zinc-600 transition-colors hover:bg-zinc-200"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
