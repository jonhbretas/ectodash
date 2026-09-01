// src/lib/proxima-reuniao.ts
// Weekly meeting cadence: reuniões acontecem toda terça-feira às 19:00. This
// helper resolves "a próxima reunião" — today if it's a Tuesday and still
// before the cutoff, otherwise the upcoming Tuesday — used to anchor the
// pauta list on the Reuniões hub. A pauta pedida na terça-feira a partir das
// 18:55 fica para a próxima reunião (já em cima do horário, ninguém vai
// preparar/discutir o assunto agora).
//
// Timezone: usa Intl.DateTimeFormat com America/Sao_Paulo (BRT = UTC-3) para
// calcular a data local correta, evitando bugs com UTC em serverless.

export const HORARIO_REUNIAO = "19:00";

// Terça-feira, 18:55 — pautas criadas a partir desse horário só entram na
// reunião da terça-feira seguinte.
const CORTE_PAUTA_MINUTOS = 18 * 60 + 55;

const BRT_TZ = "America/Sao_Paulo";

/** Retorna a data atual em BRT (sem horário, só YYYY-MM-DD como Date). */
function hojeBRT(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
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
function minutosBRT(): number {
  const str = new Intl.DateTimeFormat("en-GB", {
    timeZone: BRT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Calcula a próxima terça-feira considerando timezone BRT.
 * Retorna HOJE se for terça e antes das 18:55, senão a próxima terça.
 */
export function proximaTerca(): Date {
  const hoje = hojeBRT();
  const dia = hoje.getDay(); // 0 = domingo … 6 = sábado
  const terca = 2;
  let diff = (terca - dia + 7) % 7;
  if (diff === 0) {
    // É terça — verificar se já passou do corte
    if (minutosBRT() >= CORTE_PAUTA_MINUTOS) {
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
export function tercaAnterior(): Date {
  const hoje = hojeBRT();
  const dia = hoje.getDay();
  const terca = 2;
  let diff = (dia - terca + 7) % 7;
  if (diff === 0) {
    // É terça — se antes do corte, a última reunião foi a anterior
    if (minutosBRT() < CORTE_PAUTA_MINUTOS) {
      diff = 7;
    }
  }
  if (diff === 0) return new Date(hoje); // é terça no horário normal
  const resultado = new Date(hoje);
  resultado.setDate(resultado.getDate() - diff);
  return resultado;
}
