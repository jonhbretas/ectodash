// src/lib/woocommerce/parse-product.ts
// Parse product names to detect PROEP editions and events.
// Pattern: "PROEP ... - MONTH YEAR" or "PROEP ... - DD, DD e DD de MONTH de YYYY"

const MONTH_MAP: Record<string, number> = {
  janeiro: 0, fevereiro: 1, marco: 2, abril: 3,
  maio: 4, junho: 5, julho: 6, agosto: 7,
  setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

const MONTH_NAMES = Object.keys(MONTH_MAP);

export type ParsedProduct = {
  isProep: boolean;
  month: string | null;
  monthNum: number | null;
  year: number | null;
  label: string | null;
};

export function parseProductName(name: string): ParsedProduct {
  const lower = name.toLowerCase();
  const isProep = lower.includes("proep") || lower.includes("estimula");

  if (!isProep) {
    return { isProep: false, month: null, monthNum: null, year: null, label: null };
  }

  // Find month name (case-insensitive, accent-insensitive)
  let monthNum: number | null = null;
  let month: string | null = null;
  for (const m of MONTH_NAMES) {
    // Match with or without accents
    const pattern = m.normalize("NFD").replace(/[^a-z]/g, "");
    const regex = new RegExp(pattern, "i");
    const nameNormalized = name.normalize("NFD").replace(/[^\w\s]/g, "");
    if (regex.test(nameNormalized) || lower.includes(m)) {
      monthNum = MONTH_MAP[m];
      month = m.charAt(0).toUpperCase() + m.slice(1);
      break;
    }
  }

  // Find year (4-digit number)
  const yearMatch = name.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;

  // Build label
  let label: string | null = null;
  if (month && year) {
    label = `PROEP ${month} ${year}`;
  } else if (month) {
    label = `PROEP ${month}`;
  }

  return { isProep, month, monthNum, year, label };
}

export function matchProductToEvent(
  productName: string,
  events: Array<{ id: string; titulo: string; data_evento: string | null }>
): { id: string; titulo: string } | null {
  const parsed = parseProductName(productName);
  if (!parsed.isProep || !parsed.month || !parsed.year) return null;

  // Try to match by month/year in event title or date
  for (const event of events) {
    const eventTitle = event.titulo.toLowerCase();
    const hasMonth = eventTitle.includes(parsed.month.toLowerCase());
    
    if (hasMonth) {
      // Check year match
      if (parsed.year) {
        const eventDate = event.data_evento;
        if (eventDate) {
          const eventYear = new Date(eventDate).getFullYear();
          if (eventYear === parsed.year) {
            return { id: event.id, titulo: event.titulo };
          }
        }
        // Also check year in title
        if (eventTitle.includes(String(parsed.year))) {
          return { id: event.id, titulo: event.titulo };
        }
      }
    }
  }

  return null;
}
