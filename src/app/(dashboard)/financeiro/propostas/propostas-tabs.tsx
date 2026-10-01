"use client";

// src/app/(dashboard)/financeiro/propostas/propostas-tabs.tsx
// Abas internas das Propostas: lista, cadastro e planilha. Ativa pela rota.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ABAS = [
  { href: "/financeiro/propostas", rotulo: "Propostas" },
  { href: "/financeiro/propostas/nova", rotulo: "Cadastrar" },
  { href: "/financeiro/propostas/planilha", rotulo: "Planilha" },
];

export default function PropostasTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções das propostas" className="flex w-full flex-wrap gap-2">
      {ABAS.map((aba) => {
        const ativa = pathname === aba.href;
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center rounded-full border px-5 text-lg transition-colors",
              ativa
                ? "border-[#2195B9] bg-[#2195B9] font-semibold text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            )}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
