// Shared DIP record entry — one line in a localidade's agenda (próximas or
// histórico), used by both /dips and /dips/[localidade]. Links back to the
// source ata and, when the caller can manage it, shows the edit/delete
// actions (DipActions).
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DipActions from "./dip-actions";

export type DipRow = {
  id: number;
  localidade: string;
  pais: string;
  data_dip: string | null;
  participantes: number | null;
  observacoes: string | null;
  ataId: number;
  ataTitulo: string;
  ataData: string;
  criadoPor: string;
};

export default function DipEntry({
  registro,
  index,
  isLast,
  highlight,
  canManage,
}: {
  registro: DipRow;
  index: number;
  isLast: boolean;
  highlight?: boolean;
  canManage?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1 border-b border-zinc-100 py-3 last:border-b-0 ${index === 0 ? "pt-0" : ""} ${highlight ? "bg-blue-50/50 -mx-2 px-2 rounded-lg" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`flex items-center gap-2 text-lg font-medium ${highlight ? "text-blue-900" : "text-zinc-900"}`}>
          {registro.data_dip
            ? format(new Date(`${registro.data_dip}T00:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
            : "Data não informada"}
        </span>
        {registro.participantes !== null && (
          <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-base font-medium text-purple-800 ring-1 ring-purple-200/60">
            {registro.participantes} {registro.participantes === 1 ? "participante" : "participantes"}
          </span>
        )}
      </div>
      {registro.observacoes && (
        <p className="text-base leading-relaxed text-zinc-700">{registro.observacoes}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/reunioes/${registro.ataId}`}
          className="w-fit text-base font-medium text-blue-700 underline decoration-blue-700/40 underline-offset-4"
        >
          {registro.ataTitulo}
          {registro.ataData
            ? ` — ${format(new Date(`${registro.ataData}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}`
            : ""}
        </Link>
        {canManage && (
          <DipActions
            dip={{
              id: registro.id,
              ataId: registro.ataId,
              localidade: registro.localidade,
              pais: registro.pais,
              data: registro.data_dip,
              participantes: registro.participantes,
              observacoes: registro.observacoes,
            }}
            canManage
          />
        )}
      </div>
    </div>
  );
}
