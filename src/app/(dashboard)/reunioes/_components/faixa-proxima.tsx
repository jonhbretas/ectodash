import { CalendarClock } from "lucide-react";
import { proximaTerca, HORARIO_REUNIAO } from "@/lib/proxima-reuniao";
import { formatarProximaLabel } from "../_lib/format-data";

type Props = { pendentes: number; emEspera: number };

export default function FaixaProxima({ pendentes, emEspera }: Props) {
  const proxima = proximaTerca();
  const label = formatarProximaLabel(proxima, HORARIO_REUNIAO);
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-[#2195B9]/20 bg-[#2195B9]/5 px-4 py-2.5 text-sm font-medium text-[#28627B] backdrop-blur">
      <span className="flex items-center gap-2">
        <CalendarClock size={16} /> PRÓXIMA: {label}
      </span>
      <span className="hidden sm:inline text-[#2195B9]/40">·</span>
      <span>{pendentes} {pendentes === 1 ? "pauta" : "pautas"}</span>
      <span className="text-[#2195B9]/40">·</span>
      <span>{emEspera} em espera</span>
    </div>
  );
}
