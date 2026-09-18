// scripts/import-ramper-leads.ts
// Importação one-off da base Ramper (CSV exportado em 18/09/2026, já
// sanitizado por C:\Users\HP\AppData\Local\Temp\opencode\ramper_clean.py:
// sem "sem-consetimento", sem opt-out, sem @exemplo.com).
// Uso: node --env-file=.env.local --experimental-strip-types scripts/import-ramper-leads.ts [arquivo] [source]
// Lê SUPABASE_URL/SERVICE_ROLE do ambiente (.env.local, nunca commitado).
// Nunca reativa lead existente (qualquer status) — mesma regra da UI.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CHUNK = 500;

const file = process.argv[2] ?? "C:\\Users\\HP\\AppData\\Local\\Temp\\opencode\\leads_limpos.txt";
const source = (process.argv[3] ?? "ramper-csv-18-09-2026").slice(0, 100);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}

function parseLine(line: string): { email: string; nome: string | null } | null {
  const t = line.trim();
  if (!t) return null;
  const m = t.match(/^(.*)<([^<>]+)>\s*$/);
  if (m) {
    const nome = m[1].trim().replace(/^["']|["']$/g, "");
    return { email: m[2].trim().toLowerCase(), nome: nome || null };
  }
  return { email: t.toLowerCase(), nome: null };
}

const supabase = createClient(url, key);
const lines = readFileSync(file, "utf-8").split(/\r?\n/);

// Dedup no arquivo + validação final
const seen = new Set<string>();
const valid: { email: string; nome: string | null }[] = [];
let invalid = 0, dupes = 0;
for (const line of lines) {
  const p = parseLine(line);
  if (!p) continue;
  if (!EMAIL_RE.test(p.email) || p.email.length > 254) { invalid++; continue; }
  if (seen.has(p.email)) { dupes++; continue; }
  seen.add(p.email);
  valid.push(p);
}

let imported = 0, skipped = 0;
for (let i = 0; i < valid.length; i += CHUNK) {
  const slice = valid.slice(i, i + CHUNK);
  const emails = slice.map((v) => v.email);
  const { data: existing, error: selErr } = await supabase
    .from("marketing_leads")
    .select("email")
    .in("email", emails);
  if (selErr) {
    console.error(`Lote ${i}: falha ao consultar existentes:`, selErr.message);
    process.exit(1);
  }
  const existingSet = new Set((existing ?? []).map((r) => r.email as string));
  const fresh = slice.filter((v) => !existingSet.has(v.email));
  skipped += slice.length - fresh.length;
  if (fresh.length === 0) continue;
  const { error: insErr } = await supabase.from("marketing_leads").insert(
    fresh.map((v) => ({ email: v.email, nome: v.nome, status: "active", source }))
  );
  if (insErr) {
    console.error(`Lote ${i}: falha ao inserir:`, insErr.message);
    process.exit(1);
  }
  imported += fresh.length;
  console.log(`Lote ${i + slice.length}/${valid.length}: +${fresh.length} novos`);
}

console.log(`OK — importados: ${imported}, já existiam: ${skipped}, inválidos: ${invalid}, dupes no arquivo: ${dupes}`);
