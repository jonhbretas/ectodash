import { ShieldCheck } from "lucide-react";

export default function CoordenacaoBanner() {
  return (
    <div className="flex w-full items-start gap-3 rounded-2xl border border-violet-200 border-l-4 border-l-violet-600 bg-gradient-to-r from-violet-100 to-violet-50 p-4 sm:items-center sm:gap-4 sm:p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-700 text-white shadow-sm">
        <ShieldCheck size={24} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wider text-violet-700">
          Área da Coordenação Geral
        </p>
        <p className="mt-1 text-sm font-medium text-violet-950">
          Demandas privadas, visíveis somente para coordenadores gerais.
          {" "}Atribuições e menções não concedem acesso nem enviam e-mails.
        </p>
      </div>
      <span className="hidden shrink-0 rounded-full bg-violet-700 px-3 py-1 text-xs font-semibold text-white sm:inline-flex">
        Acesso restrito
      </span>
    </div>
  );
}
