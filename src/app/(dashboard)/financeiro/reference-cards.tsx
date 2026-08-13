"use client";

// Cards do /financeiro: Receita, Despesa, Resultado e Caixa acumulado no
// ano (calculados dos lançamentos) + Saldo em caixa e Valor aplicado
// (referências mensais — da planilha ou preenchidas aqui). As referências
// são editáveis num dialog; linhas de total/soma/saldo nunca entram na
// conta de receita/despesa (elas vivem só nestes cards).
import { useEffect, useState, useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowUpRight,
  ArrowDownRight,
  Pencil,
  PiggyBank,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  salvarReferenciasFinanceiras,
  type SalvarReferenciasFinanceirasState,
} from "./actions";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// Formato de input de valores: "1.234,56" sem prefixo R$.
function inputValor(value: number | null): string {
  if (value === null) return "";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export type ReferenceCardsProps = {
  mes: string; // mês-alvo dos cards (MM/yyyy)
  labelMes: string; // "Agosto de 2026"
  receita: { label: string; value: number; delta: number | null };
  despesa: { label: string; value: number; delta: number | null };
  resultado: { label: string; value: number; delta: number | null };
  caixaAno: { label: string; value: number };
  refs: {
    saldoAnterior: number | null;
    receitaTotal: number | null;
    despesaTotal: number | null;
    saldoTotal: number | null;
    saldoCaixa: number | null;
    aplicacao: number | null;
  };
};

export default function ReferenceCards(props: ReferenceCardsProps) {
  const { mes, labelMes: labelMesTexto, refs } = props;
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          label={props.receita.label}
          value={brl.format(props.receita.value)}
          icon={
            <ArrowUpCircle size={24} aria-hidden="true" className="shrink-0 text-green-600" />
          }
          delta={props.receita.delta}
          deltaUpIsGood
        />
        <Card
          label={props.despesa.label}
          value={brl.format(props.despesa.value)}
          icon={
            <ArrowDownCircle size={24} aria-hidden="true" className="shrink-0 text-red-600" />
          }
          delta={props.despesa.delta}
        />
        <Card
          label={props.resultado.label}
          value={brl.format(props.resultado.value)}
          icon={
            <Scale size={24} aria-hidden="true" className={`shrink-0 ${props.resultado.value < 0 ? "text-red-600" : "text-[#2195B9]"}`} />
          }
          delta={props.resultado.delta}
          deltaUpIsGood
        />
        <Card
          label="Saldo em caixa"
          value={refs.saldoCaixa === null ? "—" : brl.format(refs.saldoCaixa)}
          icon={<Wallet size={24} aria-hidden="true" className="shrink-0 text-green-600" />}
          sublabel={refs.saldoCaixa === null ? "Preencha para acompanhar" : `referência de ${labelMesTexto}`}
          onEdit={() => setDialogOpen(true)}
        />
        <Card
          label="Valor aplicado"
          value={refs.aplicacao === null ? "—" : brl.format(refs.aplicacao)}
          icon={<PiggyBank size={24} aria-hidden="true" className="shrink-0 text-[#2195B9]" />}
          sublabel={refs.aplicacao === null ? "Preencha para acompanhar" : `referência de ${labelMesTexto}`}
          onEdit={() => setDialogOpen(true)}
        />
        <Card
          label={props.caixaAno.label}
          value={brl.format(props.caixaAno.value)}
          icon={<TrendingUp size={24} aria-hidden="true" className="shrink-0 text-green-600" />}
          sublabel="saldo anterior + resultado acumulado"
        />
      </div>

      <EditarReferenciasDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mes={mes}
        labelMes={labelMesTexto}
        refs={refs}
      />
    </>
  );
}

function Card({
  label,
  value,
  icon,
  delta,
  deltaUpIsGood,
  sublabel,
  onEdit,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  delta?: number | null;
  deltaUpIsGood?: boolean;
  sublabel?: string;
  onEdit?: () => void;
}) {
  return (
    <div
      role="group"
      aria-label={`${label}: ${value}`}
      className="flex min-w-0 flex-col gap-2 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-base font-medium text-zinc-500">
          {icon}
          <span className="truncate">{label}</span>
        </span>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Editar ${label}`}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            <Pencil size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <span className="truncate text-2xl font-semibold text-zinc-900">{value}</span>
      {delta !== undefined && delta !== null && (
        <DeltaBadge delta={delta} upIsGood={Boolean(deltaUpIsGood)} />
      )}
      {sublabel && <span className="truncate text-sm text-zinc-400">{sublabel}</span>}
    </div>
  );
}

// "▲ +12,4% vs mês anterior" — verde quando a variação é boa para aquele
// card (receita/resultado sobem bem; despesa subir é ruim).
function DeltaBadge({ delta, upIsGood }: { delta: number; upIsGood: boolean }) {
  const up = delta >= 0;
  const good = up === upIsGood;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium ring-1 ${
        good
          ? "bg-green-50 text-green-700 ring-green-200/60"
          : "bg-red-50 text-red-700 ring-red-200/60"
      }`}
    >
      <Icon size={14} aria-hidden="true" />
      {up ? "+" : "−"}
      {Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
      <span className="sr-only">vs mês anterior</span>
    </span>
  );
}

const dialogInitialState: SalvarReferenciasFinanceirasState = {
  ok: false,
  message: "",
};

function EditarReferenciasDialog({
  open,
  onOpenChange,
  mes,
  labelMes,
  refs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mes: string;
  labelMes: string;
  refs: ReferenceCardsProps["refs"];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    salvarReferenciasFinanceiras,
    dialogInitialState
  );

  useEffect(() => {
    if (state.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state.ok, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Referências de {labelMes}</DialogTitle>
          <DialogDescription>
            Saldo anterior, totais e aplicação do mês — preenchidos pela
            planilha ou ajustados aqui. Não alteram os lançamentos de
            receita/despesa.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="mes" value={mes} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReferenciaInput
              name="saldoAnterior"
              label="Saldo anterior"
              defaultValue={inputValor(refs.saldoAnterior)}
            />
            <ReferenciaInput
              name="aplicacao"
              label="Aplicação"
              defaultValue={inputValor(refs.aplicacao)}
            />
            <ReferenciaInput
              name="receitaTotal"
              label="Receita total"
              defaultValue={inputValor(refs.receitaTotal)}
            />
            <ReferenciaInput
              name="despesaTotal"
              label="Despesa total"
              defaultValue={inputValor(refs.despesaTotal)}
            />
            <ReferenciaInput
              name="saldoTotal"
              label="Saldo total"
              defaultValue={inputValor(refs.saldoTotal)}
            />
            <ReferenciaInput
              name="saldoCaixa"
              label="Saldo em caixa"
              defaultValue={inputValor(refs.saldoCaixa)}
            />
          </div>
          <div aria-live="polite" className="flex flex-col gap-1">
            {state.message && (
              <p className={`text-base ${state.ok ? "text-green-800" : "text-red-700"}`}>
                {state.message}
              </p>
            )}
          </div>
          <SalvarReferenciasButton />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReferenciaInput({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-base font-medium text-zinc-700">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        name={name}
        defaultValue={defaultValue}
        placeholder="0,00"
        className="min-h-12 rounded-lg border border-zinc-400 bg-white px-3 py-2 text-lg text-zinc-900 placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
      />
    </label>
  );
}

function SalvarReferenciasButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-lg bg-[#2195B9] px-4 py-3 text-lg font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Salvando..." : "Salvar referências"}
    </button>
  );
}
