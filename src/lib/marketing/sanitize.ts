// src/lib/marketing/sanitize.ts
// Sanitização pura (sem I/O) da base de leads colada/importada:
// normaliza, valida, remove duplicados e separa inválidos com motivo.
// A checagem contra leads JÁ existentes no banco acontece na Server
// Action (importLeads), que reaproveita normalizeEmail/validateEmail.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Domínios com typo comum -> sugestão exibida na quarentena (não
// autocorrige: o operador decide se ajusta e reimporta).
const TYPO_DOMAINS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.com.br": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotamil.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahoo.com.br": "yahoo.com.br",
  "iclod.com": "icloud.com",
  "icloude.com": "icloud.com",
  "bol.com.br ": "bol.com.br",
  "uol.com.br ": "uol.com.br",
};

// Descartáveis conhecidos — entram na quarentena, nunca na base ativa.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "yopmail.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "trashmail.com",
  "fakeinbox.com",
  "getnada.com",
  "dispostable.com",
  "throwawaymail.com",
  "temp-mail.org",
  "mohmal.com",
]);

export interface ValidLead {
  email: string;
  nome: string | null;
}

export interface InvalidLead {
  raw: string;
  reason: string;
  suggestion?: string;
}

export interface SanitizeResult {
  valid: ValidLead[];
  invalid: InvalidLead[];
  duplicatesRemoved: number;
}

export type EmailCheck =
  | { ok: true }
  | { ok: false; reason: string; suggestion?: string };

/** Lowercase + trim. Ponto único de normalização (usado também no import). */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateEmail(email: string): EmailCheck {
  if (!email || email.length < 3) {
    return { ok: false, reason: "E-mail vazio ou curto demais." };
  }
  if (email.length > 254) {
    return { ok: false, reason: "E-mail com mais de 254 caracteres." };
  }
  if (/\s/.test(email)) {
    return { ok: false, reason: "E-mail contém espaço." };
  }
  const parts = email.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: "Formato inválido (falta @ ou domínio)." };
  }
  const [, domain] = parts;
  if (!domain.includes(".")) {
    return { ok: false, reason: "Domínio sem ponto (ex.: gmail.com)." };
  }
  if (email.includes("..")) {
    return { ok: false, reason: "E-mail com pontos duplicados." };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, reason: "Formato de e-mail inválido." };
  }
  const typoFix = TYPO_DOMAINS[domain];
  if (typoFix && typoFix !== domain) {
    return {
      ok: false,
      reason: `Possível erro de digitação no domínio ("${domain}").`,
      suggestion: `${parts[0]}@${typoFix}`,
    };
  }
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, reason: "E-mail descartável/temporário." };
  }
  return { ok: true };
}

function splitLine(line: string): { email: string; nome: string | null } {
  const trimmed = line.trim();
  // "Nome <email>"
  const angle = trimmed.match(/^(.*)<([^<>]+)>\s*$/);
  if (angle) {
    const nome = angle[1].trim().replace(/^["']|["']$/g, "");
    return { email: angle[2].trim(), nome: nome || null };
  }
  // "email,nome" | "email;nome" | "nome,email"
  const sep = trimmed.includes(";") ? ";" : trimmed.includes(",") ? "," : null;
  if (sep) {
    const [a, ...rest] = trimmed.split(sep).map((s) => s.trim());
    const b = rest.join(sep).trim();
    if (a.includes("@")) return { email: a, nome: b || null };
    if (b.includes("@")) return { email: b, nome: a || null };
    return { email: a, nome: b || null };
  }
  return { email: trimmed, nome: null };
}

/**
 * Sanitiza até 20.000 linhas coladas (uma por linha). Ignora linhas em
 * branco; dedup é case-insensitive pós-normalização.
 */
export const MAX_IMPORT_LINES = 20000;

export function sanitizeLeads(rawText: string): SanitizeResult {
  const lines = rawText.split(/\r?\n/);
  const valid: ValidLead[] = [];
  const invalid: InvalidLead[] = [];
  const seen = new Set<string>();
  let duplicatesRemoved = 0;

  const capped = lines.slice(0, MAX_IMPORT_LINES + 1);
  for (const line of capped.slice(0, MAX_IMPORT_LINES)) {
    if (!line.trim()) continue;
    const { email: rawEmail, nome } = splitLine(line);
    const email = normalizeEmail(rawEmail);
    if (seen.has(email)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(email);
    const check = validateEmail(email);
    if (!check.ok) {
      invalid.push({
        raw: line.trim(),
        reason: check.reason,
        suggestion: check.suggestion,
      });
      continue;
    }
    valid.push({ email, nome });
  }

  return { valid, invalid, duplicatesRemoved };
}
