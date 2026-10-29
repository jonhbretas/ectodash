"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ScanSearch, UploadCloud, Home, ListChecks, ArrowLeftRight, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/financeiro", label: "Início", description: "Ações principais", Icon: Home },
  { href: "/financeiro/importar", label: "Subir arquivos", description: "Envio e validação", Icon: UploadCloud },
  { href: "/financeiro/lancamentos", label: "Lançamentos", description: "Dados extraídos", Icon: ListChecks },
  { href: "/financeiro/conciliacao", label: "Conciliação", description: "Venda e depósito", Icon: ArrowLeftRight },
  { href: "/financeiro/analise", label: "Análise", description: "Resumo e períodos", Icon: BarChart3 },
  { href: "/financeiro/conferencia", label: "Conferência", description: "Revisão manual", Icon: ScanSearch },
  { href: "/financeiro/fechamento", label: "Fechamento", description: "Validar e fechar mês", Icon: LockKeyhole },
] as const;

export default function FinanceNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação do financeiro" className="grid w-full grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
      {items.map(({ href, label, description, Icon }) => {
        const active = href === "/financeiro" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

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
