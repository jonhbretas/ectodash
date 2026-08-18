// src/lib/proxima-reuniao.ts
// Weekly meeting cadence: reuniões acontecem toda terça-feira. This helper
// resolves "a próxima reunião" — today if it's a Tuesday, otherwise the
// upcoming Tuesday — used to anchor the pauta list on the Reuniões hub.
// Pure date math, no timezone pitfalls (local day-of-week only).

export function proximaTerca(hoje: Date = new Date()): Date {
  const dia = hoje.getDay(); // 0 = domingo … 6 = sábado
  const terca = 2;
  const diff = (terca - dia + 7) % 7;
  const data = new Date(hoje);
  data.setHours(0, 0, 0, 0);
  data.setDate(data.getDate() + diff);
  return data;
}
