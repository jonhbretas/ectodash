"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { buscarAlertasRepeticao } from "./actions";

type Alerta = {
  voluntario_id: number;
  nome: string;
  funcao: string;
  total_mes: number;
};

export default function AlertasRepeticaoPanel({
  escalaId,
  alocacoes,
}: {
  escalaId: number;
  alocacoes: { voluntario_id: number; funcao: string }[];
}) {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (alocacoes.length === 0) {
      setAlertas([]);
      return;
    }
    startTransition(async () => {
      const data = await buscarAlertasRepeticao(escalaId);
      setAlertas(data);
    });
  }, [escalaId, alocacoes.length]);

  if (alertas.length === 0) return null;

  return (
    <div className="rounded-2xl bg-amber-50 px-6 py-4 ring-1 ring-amber-200/60">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-amber-800 mb-2">
        <AlertTriangle size={20} aria-hidden="true" />
        Alertas de repetição no mês
      </h3>
      <div className="flex flex-col gap-1.5">
        {alertas.map((a) => (
          <p key={`${a.voluntario_id}-${a.funcao}`} className="text-base text-amber-700">
            <span className="font-medium">{a.nome}</span> já fez{" "}
            <span className="font-medium">{a.funcao}</span>{" "}
            <span className="font-semibold">{a.total_mes}</span> vez(es) este mês.
          </p>
        ))}
      </div>
    </div>
  );
}
