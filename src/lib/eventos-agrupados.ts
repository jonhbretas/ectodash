// src/lib/eventos-agrupados.ts
// Shared helper: group eventos by month (pt-BR label) so every event picker
// (filtro de demandas, formulário, editor inline) shows the same
// month-subcategorized list — "ao clicar em evento, uma subcategoria por
// mês" (user request). Pure function, no I/O, used by client components.
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type EventoComData = {
  id: number;
  titulo: string;
  data_evento: string;
  local: string | null;
};

export type GrupoEventosMes = {
  label: string;
  eventos: EventoComData[];
};

// Capitalize the first letter of the month label ("agosto de 2026" → "Agosto
// de 2026") — same rule the eventos/reunioes screens apply to month headers.
function capitalize(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function agruparEventosPorMes(
  eventos: EventoComData[]
): GrupoEventosMes[] {
  const grupos = new Map<string, EventoComData[]>();
  for (const evento of eventos) {
    const mes = evento.data_evento
      ? capitalize(
          format(new Date(`${evento.data_evento}T00:00:00`), "MMMM 'de' yyyy", {
            locale: ptBR,
          })
        )
      : "Sem data";
    const lista = grupos.get(mes) ?? [];
    lista.push(evento);
    grupos.set(mes, lista);
  }
  const ordensMes: Record<string, number> = {
    Janeiro: 0, Fevereiro: 1, "Março": 2, Abril: 3, Maio: 4, Junho: 5,
    Julho: 6, Agosto: 7, Setembro: 8, Outubro: 9, Novembro: 10, Dezembro: 11,
  };
  return [...grupos.entries()]
    .map(([label, eventosDoMes]) => ({ label, eventos: eventosDoMes }))
    .sort((a, b) => {
      if (a.label === "Sem data") return 1;
      if (b.label === "Sem data") return -1;
      const [mesA, anoA] = a.label.split(" ");
      const [mesB, anoB] = b.label.split(" ");
      if (anoA !== anoB) return Number(anoA) - Number(anoB);
      return (ordensMes[mesA] ?? 99) - (ordensMes[mesB] ?? 99);
    });
}
