// Padronização de datas pt-BR: "ter, 08 set 2026 · 19h00"
// Nunca capitalizar dia/semana/mês — corrigido do padrão anterior
// "Terça-Feira, 08 De Setembro" -> errado (spec item 8).
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const WEEKDAY_ABBR = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatarReuniaoCurta(iso: string, horario: string | null): string {
  const d = new Date(`${iso}T00:00:00`);
  const wd = WEEKDAY_ABBR[d.getDay()];
  const day = String(d.getDate()).padStart(2, "0");
  const mon = MONTH_ABBR[d.getMonth()];
  const h = horario ? horario.slice(0, 5).replace(":", "h") : "19h00";
  return `${wd}, ${day} ${mon} · ${h}`;
}

export function formatarDataHoraReuniao(iso: string, horario: string | null): string {
  // Usado na faixa sticky e cards: "ter, 08 set 2026 · 19h00"
  const d = new Date(`${iso}T00:00:00`);
  const wd = WEEKDAY_ABBR[d.getDay()];
  const day = String(d.getDate()).padStart(2, "0");
  const mon = MONTH_ABBR[d.getMonth()];
  const year = d.getFullYear();
  const h = horario ? horario.slice(0, 5).replace(":", "h") : "19h00";
  return `${wd}, ${day} ${mon} ${year} · ${h}`;
}

export function formatarProximaLabel(date: Date, horario: string): string {
  // Ex: "ter, 08 set 2026 · 19h00" — date já em BRT
  const wd = WEEKDAY_ABBR[date.getDay()];
  const day = String(date.getDate()).padStart(2, "0");
  const mon = MONTH_ABBR[date.getMonth()];
  const year = date.getFullYear();
  const h = horario.replace(":", "h");
  return `${wd}, ${day} ${mon} ${year} · ${h}`;
}

export function monthKey(iso: string): string {
  return format(new Date(`${iso}T00:00:00`), "MM/yyyy", { locale: ptBR });
}

export function monthLabel(key: string): string {
  const [month, year] = key.split("/");
  const label = format(new Date(Number(year), Number(month) - 1, 1), "MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function countLines(value: string | null): number {
  if (!value) return 0;
  return value.split("\n").map((l) => l.trim()).filter(Boolean).length;
}

export const WEEKDAY_ABBR_LIST = WEEKDAY_ABBR;
export const MONTH_ABBR_LIST = MONTH_ABBR;
