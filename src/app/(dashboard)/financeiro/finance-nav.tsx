"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, ReceiptText, WalletCards, ScanSearch } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/financeiro", label: "Visão geral", description: "Fluxo de caixa", Icon: BarChart3 },
  { href: "/financeiro/lancamentos", label: "Lançamentos", description: "Livro financeiro", Icon: ClipboardList },
  { href: "/financeiro/pagar", label: "A pagar", description: "Despesas e prazos", Icon: WalletCards },
  { href: "/financeiro/propostas", label: "Propostas", description: "Recebimentos", Icon: ReceiptText },
  { href: "/financeiro/conferencia", label: "Conferência", description: "Revisão manual", Icon: ScanSearch },
] as const;

export default function FinanceNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação do financeiro" className="grid w-full grid-cols-2 gap-2 lg:grid-cols-4">
      {items.map(({ href, label, description, Icon }) => {
        const active = href === "/financeiro" ? pathname === href : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-16 items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]",
              active
                ? "border-[#2195B9]/30 bg-[#2195B9]/10 text-[#176d89]"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-[#2195B9]/30 hover:bg-zinc-50"
            )}
          >
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", active ? "bg-[#2195B9] text-white" : "bg-zinc-100 text-zinc-600")}>
              <Icon size={19} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold leading-tight">{label}</span>
              <span className="hidden truncate text-sm text-zinc-500 sm:block">{description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
