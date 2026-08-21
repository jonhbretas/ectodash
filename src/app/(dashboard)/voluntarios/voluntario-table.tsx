"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckSquare, Square, MessageCircle, UserRoundCheck, MoonStar } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { roleLabel } from "@/lib/role-labels";
import { exibirUnidade } from "@/lib/unidade-label";

export type VoluntarioTableRow = {
  id: number;
  nome: string;
  codigo_pf: string | null;
  unidade: string | null;
  org_depto: string | null;
  funcao: string | null;
  data_inicio: string | null;
  data_saida: string | null;
  area_atuacao: string | null;
  role: string | null;
  ativo: boolean;
  situacao: string | null;
  telefone1: string | null;
  telefone2: string | null;
  profiles: { email: string; role: string }[] | { email: string; role: string } | null;
};

function linkedProfile(row: VoluntarioTableRow) {
  if (!row.profiles) return null;
  return Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
}

function formatData(iso: string | null): string | null {
  if (!iso) return null;
  return format(new Date(`${iso}T00:00:00`), "dd/MM/yyyy", { locale: ptBR });
}

function phoneToDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function formatPhoneDisplay(phone: string): string {
  const digits = phoneToDigits(phone);
  if (digits.length <= 2) return phone;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

export type VoluntarioTableProps = {
  voluntarios: VoluntarioTableRow[];
  selectionActive?: boolean;
  selectedIds?: Set<number>;
  onToggle?: (id: number, shiftKey?: boolean) => void;
};

export default function VoluntarioTable({
  voluntarios,
  selectionActive = false,
  selectedIds,
  onToggle,
}: VoluntarioTableProps) {
  return (
    <Table className="w-full table-fixed overflow-hidden rounded-2xl ring-1 ring-zinc-200/60">
      <TableHeader>
        <TableRow className="border-b-0 bg-zinc-100/80 text-base font-semibold text-zinc-600 hover:bg-zinc-100/80">
          {selectionActive && (
            <TableHead className="h-auto w-[3.5rem] px-3 py-3.5 text-left">
              <span className="sr-only">Selecionar</span>
            </TableHead>
          )}
          <TableHead
            className={`h-auto px-5 py-3.5 text-left font-semibold text-zinc-600 ${
              selectionActive ? "w-[28%]" : "w-[30%]"
            }`}
          >
            Nome
          </TableHead>
          <TableHead className="h-auto w-[10%] px-5 py-3.5 text-left font-semibold text-zinc-600">
            Cód. PF
          </TableHead>
          <TableHead className="h-auto w-[12%] px-5 py-3.5 text-left font-semibold text-zinc-600">
            Localidade
          </TableHead>
          <TableHead className="h-auto w-[16%] px-5 py-3.5 text-left font-semibold text-zinc-600">
            Função / Área
          </TableHead>
          <TableHead className="h-auto w-[10%] px-5 py-3.5 text-left font-semibold text-zinc-600">
            Papel
          </TableHead>
          <TableHead className="h-auto w-[10%] px-5 py-3.5 text-left font-semibold text-zinc-600">
            Início
          </TableHead>
          <TableHead className="h-auto w-[14%] px-5 py-3.5 text-left font-semibold text-zinc-600">
            Contato
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {voluntarios.map((row) => {
          const linked = linkedProfile(row);
          const afastado = Boolean(row.data_saida);
          const effectiveRole = linked?.role ?? row.role ?? "voluntario_comum";
          const selected = selectionActive
            ? selectedIds?.has(row.id) ?? false
            : false;

          const rowContent = (
            <>
              {selectionActive && (
                <TableCell className="px-3 py-3">
                  <span className="flex justify-center">
                    {selected ? (
                      <CheckSquare size={20} className="text-[#2195B9]" />
                    ) : (
                      <Square size={20} className="text-zinc-400" />
                    )}
                  </span>
                </TableCell>
              )}
              <TableCell className="px-5 py-3" title={row.nome}>
                <div className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`truncate font-medium ${
                        row.ativo ? "text-zinc-900" : "text-zinc-500 line-through"
                      }`}
                    >
                      {row.nome}
                    </span>
                    {linked && (
                      <span className="flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full bg-[#E6E6E6] px-1.5 py-0.5 text-xs font-medium text-[#28627B]">
                        <UserRoundCheck size={10} />
                        Vinculado
                      </span>
                    )}
                    {row.situacao === "ocioso" && (
                      <span className="flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                        <MoonStar size={10} />
                        Ocioso
                      </span>
                    )}
                    {afastado && (
                      <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                        Saída: {formatData(row.data_saida)}
                      </span>
                    )}
                  </div>
                  <span className="truncate text-sm text-zinc-500">
                    {row.funcao ?? "—"}
                  </span>
                </div>
              </TableCell>
              <TableCell className="px-5 py-3 text-sm text-zinc-600">
                {row.codigo_pf ?? "—"}
              </TableCell>
              <TableCell className="px-5 py-3 text-sm text-zinc-600">
                {exibirUnidade(row.unidade)}
              </TableCell>
              <TableCell className="px-5 py-3">
                <span className="max-w-40 truncate rounded-full bg-zinc-100 px-2.5 py-0.5 text-sm text-zinc-700">
                  {row.area_atuacao ?? "Sem área"}
                </span>
              </TableCell>
              <TableCell className="px-5 py-3">
                <span className="whitespace-nowrap rounded-full bg-zinc-100 px-2.5 py-0.5 text-sm font-medium text-zinc-800 ring-1 ring-zinc-200/60">
                  {roleLabel(effectiveRole)}
                </span>
              </TableCell>
              <TableCell className="px-5 py-3 text-sm text-zinc-600">
                {formatData(row.data_inicio) ?? "—"}
              </TableCell>
              <TableCell className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {linked?.email && (
                    <span className="truncate text-sm text-zinc-500" title={linked.email}>
                      {linked.email}
                    </span>
                  )}
                  {row.telefone1 && (
                    <a
                      href={`https://wa.me/${phoneToDigits(row.telefone1).startsWith("55") ? phoneToDigits(row.telefone1) : "55" + phoneToDigits(row.telefone1)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex shrink-0 items-center gap-0.5 text-green-700 hover:text-green-900 hover:underline"
                      title={formatPhoneDisplay(row.telefone1)}
                    >
                      <MessageCircle size={12} />
                    </a>
                  )}
                </div>
              </TableCell>
            </>
          );

          const baseClassName = `cursor-pointer border-t border-b-0 border-zinc-100 bg-white text-base text-zinc-900 transition-colors duration-200 ${
            selected ? "bg-[#2195B9]/5 hover:bg-[#2195B9]/10" : "hover:bg-zinc-50"
          } ${!row.ativo ? "opacity-60" : ""}`;

          if (selectionActive) {
            return (
              <TableRow
                key={row.id}
                onClick={(e) => onToggle?.(row.id, e.shiftKey)}
                aria-selected={selected}
                className={baseClassName}
              >
                {rowContent}
              </TableRow>
            );
          }

          return (
            <TableRow key={row.id} className={baseClassName}>
              <TableCell colSpan={selectionActive ? 8 : 7} className="p-0">
                <Link
                  href={`/voluntarios/${row.id}`}
                  className="flex w-full items-stretch focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
                >
                  <div className="flex w-full items-center">
                    {rowContent}
                  </div>
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
