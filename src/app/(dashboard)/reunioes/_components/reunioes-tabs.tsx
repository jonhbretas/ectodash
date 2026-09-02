"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Props = { counts: { proxima: number; pautas: number; atas: number } };

export default function ReunioesTabs({ counts }: Props) {
  const sp = useSearchParams();
  const tab = sp.get("tab") === "pautas" ? "pautas" : sp.get("tab") === "atas" ? "atas" : "proxima";
  const base = "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors";
  const active = "bg-[#2195B9] text-white shadow-sm";
  const idle = "bg-zinc-100 text-zinc-700 hover:bg-zinc-200";
  return (
    <nav aria-label="Abas de Reuniões" className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3">
      <Link href="/reunioes" className={`${base} ${tab === "proxima" ? active : idle}`}>
        Próxima reunião
      </Link>
      <Link href="/reunioes?tab=pautas" className={`${base} ${tab === "pautas" ? active : idle}`}>
        Pautas <span className={`rounded-full px-2 py-0.5 text-xs ${tab === "pautas" ? "bg-white/20" : "bg-white"}`}>{counts.pautas}</span>
      </Link>
      <Link href="/reunioes?tab=atas" className={`${base} ${tab === "atas" ? active : idle}`}>
        Atas <span className={`rounded-full px-2 py-0.5 text-xs ${tab === "atas" ? "bg-white/20" : "bg-white"}`}>{counts.atas}</span>
      </Link>
    </nav>
  );
}
