// src/lib/marketing/ab.ts
// Apuração do teste A/B: agrega enviados/aberturas por variante e
// elege a vencedora por taxa de abertura (empate = primeira letra).
export interface VariantRow {
  variant: string;
  subject: string;
  sent: number;
  opened: number;
}

export interface VariantTally extends VariantRow {
  rate: number;
}

export function tallyVariants(
  subjects: string[],
  rows: { variant: string | null; status: string; opened_at: string | null }[]
): VariantTally[] {
  return subjects.map((subject, i) => {
    const variant = String.fromCharCode(65 + i);
    const mine = rows.filter((r) => r.variant === variant);
    const sent = mine.filter((r) => r.status === "sent").length;
    const opened = mine.filter((r) => r.opened_at !== null).length;
    return {
      variant,
      subject,
      sent,
      opened,
      rate: sent > 0 ? opened / sent : 0,
    };
  });
}

export function pickWinner(tally: VariantTally[]): VariantTally | null {
  let best: VariantTally | null = null;
  for (const t of tally) {
    if (t.sent === 0) continue;
    if (!best || t.rate > best.rate) best = t;
  }
  return best;
}

/** Letras de variante para N assuntos (A..J, máx. 10). */
export function variantLetters(n: number): string[] {
  return Array.from({ length: Math.max(0, Math.min(10, n)) }, (_, i) =>
    String.fromCharCode(65 + i)
  );
}
