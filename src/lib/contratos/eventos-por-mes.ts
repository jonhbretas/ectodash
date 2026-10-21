// src/lib/contratos/eventos-por-mes.ts
// Agrupa eventos por mês/ano (em ordem cronológica) para os <select> de
// evento do módulo de contratos — vira um <optgroup> por mês.

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export type EventoComData = {
  id: number;
  titulo: string;
  data_evento?: string | null;
};

export type GrupoMes<T extends EventoComData> = {
  chave: string;
  label: string;
  eventos: T[];
};

/** "2026-10-20" → "20/10" (sem ano: o ano já está no grupo). */
export function diaMes(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export function agruparEventosPorMes<T extends EventoComData>(
  eventos: T[]
): GrupoMes<T>[] {
  const ordenados = [...eventos].sort((a, b) => {
    const da = a.data_evento?.slice(0, 10) ?? "";
    const db = b.data_evento?.slice(0, 10) ?? "";
    if (da !== db) {
      if (!da) return 1;
      if (!db) return -1;
      return da < db ? -1 : 1;
    }
    return a.titulo.localeCompare(b.titulo, "pt-BR");
  });

  const grupos: GrupoMes<T>[] = [];
  for (const evento of ordenados) {
    const iso = evento.data_evento?.slice(0, 10);
    const chave = iso ? iso.slice(0, 7) : "sem-data";
    const label = iso
      ? `${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`
      : "Sem data";
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.chave === chave) {
      ultimo.eventos.push(evento);
    } else {
      grupos.push({ chave, label, eventos: [evento] });
    }
  }
  return grupos;
}
