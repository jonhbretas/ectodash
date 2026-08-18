// src/lib/proxima-reuniao.ts
// Weekly meeting cadence: reuniões acontecem toda terça-feira às 19:00. This
// helper resolves "a próxima reunião" — today if it's a Tuesday and still
// before the cutoff, otherwise the upcoming Tuesday — used to anchor the
// pauta list on the Reuniões hub. A pauta pedida na terça-feira a partir das
// 18:50 fica para a próxima reunião (já em cima do horário, ninguém vai
// preparar/discutir o assunto agora). Pure date math, no timezone pitfalls.

export const HORARIO_REUNIAO = "19:00";

// Terça-feira, 18:50 — pautas criadas a partir desse horário só entram na
// reunião da terça-feira seguinte.
const CORTE_PAUTA_MINUTOS = 18 * 60 + 50;

export function proximaTerca(hoje: Date = new Date()): Date {
  const dia = hoje.getDay(); // 0 = domingo … 6 = sábado
  const terca = 2;
  let diff = (terca - dia + 7) % 7;
  if (diff === 0) {
    const minutosHoje = hoje.getHours() * 60 + hoje.getMinutes();
    if (minutosHoje >= CORTE_PAUTA_MINUTOS) {
      diff = 7;
    }
  }
  const data = new Date(hoje);
  data.setHours(0, 0, 0, 0);
  data.setDate(data.getDate() + diff);
  return data;
}
