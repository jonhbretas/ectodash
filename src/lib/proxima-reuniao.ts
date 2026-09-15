// src/lib/proxima-reuniao.ts
// Weekly meeting cadence: reuniões acontecem toda terça-feira às 19:00. This
// helper resolves "a próxima reunião" — today if it's a Tuesday and still
// before 19:00, otherwise the upcoming Tuesday — used to anchor the
// pauta list on the Reuniões hub. A pauta pedida na terça-feira a partir das
// 19:00 fica para a próxima reunião (a reunião já começou, pedidos após o
// início valem para a terça seguinte).
//
// Regra de negócio (confirmada): pedidos de pauta só valem para a reunião de
// hoje se feitos até o início da reunião (terça 19:00). Após 19:00, valem
// automaticamente para a próxima terça-feira.
//
// Timezone: usa Intl.DateTimeFormat com America/Sao_Paulo (BRT = UTC-3) para
// calcular a data local correta, evitando bugs com UTC em serverless.

export const HORARIO_REUNIAO = "19:00";

// Terça-feira, 19:00 — pautas criadas a partir desse horário só entram na
// reunião da terça-feira seguinte.
const CORTE_PAUTA_MINUTOS = 19 * 60;

const BRT_TZ = "America/Sao_Paulo";

/** Retorna a data atual em BRT (sem horário, só YYYY-MM-DD como Date). */
function hojeBRT(agora: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(agora)
    .reduce(
      (acc, p) => {
        if (p.type === "year") acc.year = Number(p.value);
        if (p.type === "month") acc.month = Number(p.value);
        if (p.type === "day") acc.day = Number(p.value);
        return acc;
      },
      { year: 0, month: 0, day: 0 }
    );

  return new Date(parts.year, parts.month - 1, parts.day);
}

/** Retorna os minutos desde meia-noite em BRT. */
function minutosBRT(agora: Date = new Date()): number {
  const str = new Intl.DateTimeFormat("en-GB", {
    timeZone: BRT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(agora);
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Calcula a próxima terça-feira considerando timezone BRT.
 * Retorna HOJE se for terça e antes das 19:00, senão a próxima terça.
 */
export function proximaTerca(agora?: Date): Date {
  const hoje = hojeBRT(agora);
  const dia = hoje.getDay(); // 0 = domingo … 6 = sábado
  const terca = 2;
  let diff = (terca - dia + 7) % 7;
  if (diff === 0) {
    // É terça — verificar se já passou do corte
    if (minutosBRT(agora) >= CORTE_PAUTA_MINUTOS) {
      diff = 7;
    }
  }
  const resultado = new Date(hoje);
  resultado.setDate(resultado.getDate() + diff);
  return resultado;
}

/**
 * Retorna a data da terça-feira anterior (para referência de reunião passada).
 */
export function tercaAnterior(agora?: Date): Date {
  const hoje = hojeBRT(agora);
  const dia = hoje.getDay();
  const terca = 2;
  let diff = (dia - terca + 7) % 7;
  if (diff === 0) {
    // É terça — se antes do corte, a última reunião foi a anterior
    if (minutosBRT(agora) < CORTE_PAUTA_MINUTOS) {
      diff = 7;
    }
  }
  if (diff === 0) return new Date(hoje); // é terça no horário normal
  const resultado = new Date(hoje);
  resultado.setDate(resultado.getDate() - diff);
  return resultado;
}

/** Formata Date como YYYY-MM-DD (data local BRT já calculada). */
export function formatarDataISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Texto curto da regra de corte — reutilizado nos formulários. */
export const REGRA_CORTE_PAUTA =
  "Pedidos até terça 19h valem para a reunião de hoje; após 19h valem automaticamente para a próxima terça.";
