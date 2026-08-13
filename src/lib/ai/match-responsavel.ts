// src/lib/ai/match-responsavel.ts
// Pure, deterministic responsável-name matcher (08-RESEARCH.md Pattern 2).
// Never returns a fabricated id: only a real profile.id already present in
// the `profiles` array passed in, or null when no confident match exists.
//
// Scoring rules (in priority order) — all normalized (accents/case):
//   1. exact full-name match
//   2. first token + last token match (multi-token on both sides), e.g.
//      "Almir dos Santos Pereira" -> "Almir Pereira"
//   3. whole mention inside the roster name (min length 5), e.g.
//      "Jaqueline" -> "Jaqueline Barcellos"
//   4. whole roster name inside the mention (min length 5), e.g.
//      "Mariana Cabral Schveitzer" -> "Mariana Cabral"
// When more than one candidate ties for the top score the match is
// ambiguous and rejected (null) — a wrong or missing match is always
// corrected by the mandatory human review step, never silently trusted.
// This rejects the substring false positives of the old matcher ("Ara"
// matching "Eliane Amarante" or any "Maria...").

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    // Strip combining diacritical marks (e.g. "María" -> "maria").
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

type RosterEntry = {
  id: number;
  nome: string;
  profileId: string | null;
};

function tokensOf(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

export function matchResponsavel(
  responsavelTexto: string,
  profiles: { id: string; email: string; full_name?: string | null }[]
): string | null {
  const needle = normalize(responsavelTexto);
  if (!needle) return null;

  const candidates: string[] = [];
  for (const profile of profiles) {
    const haystacks = [normalize(profile.email.split("@")[0])];
    if (profile.full_name) haystacks.push(normalize(profile.full_name));

    for (const haystack of haystacks) {
      if (!haystack) continue;
      if (haystack === needle) {
        candidates.push(profile.id);
        break;
      }
      if (haystack.includes(needle) || needle.includes(haystack)) {
        candidates.push(profile.id);
        break;
      }
    }
  }

  return candidates.length === 1 ? candidates[0] : null;
}

// The institutional roster (public.voluntarios) is the source of truth for
// volunteer NAMES — most roster rows have no linked auth account (profiles),
// so matching against profiles alone misses everyone without an account
// (or with an empty full_name). This matcher checks the roster first and
// resolves the linked profile id when the roster volunteer has an account.
export type RosterVoluntario = {
  id: number;
  nome: string;
  profileId: string | null; // linked auth account, if any
};

function matchRoster(needle: string, roster: RosterEntry[]): RosterEntry | null {
  const needleTokens = tokensOf(needle);
  if (needleTokens.length === 0) return null;

  let best: RosterEntry | null = null;
  let bestScore = 0;
  let ties = false;

  for (const entry of roster) {
    const haystack = normalize(entry.nome);
    const hayTokens = tokensOf(haystack);
    if (hayTokens.length === 0) continue;

    let score = 0;
    if (haystack === needle) {
      score = 5;
    } else if (
      needleTokens.length >= 2 &&
      hayTokens.length >= 2 &&
      hayTokens[0] === needleTokens[0] &&
      hayTokens[hayTokens.length - 1] === needleTokens[needleTokens.length - 1]
    ) {
      score = 4;
    } else if (needle.length >= 5 && haystack.includes(needle)) {
      score = 3;
    } else if (haystack.length >= 5 && needle.includes(haystack)) {
      score = 2;
    }

    if (score === 0) continue;
    if (score > bestScore) {
      best = entry;
      bestScore = score;
      ties = false;
    } else if (score === bestScore) {
      // Two distinct roster rows tie at the top — ambiguous, no link.
      // Short needles (below MIN_TOKEN_LENGTH) like "Ana" or "Ara" match
      // several names by containment and land here; the human picks.
      if (entry.id !== best!.id) ties = true;
    }
  }

  return ties ? null : best;
}

export function matchResponsavelRoster(
  responsavelTexto: string,
  profiles: { id: string; email: string; full_name?: string | null }[],
  roster: RosterVoluntario[]
): { profileId: string | null; rosterId: number | null } {
  const needle = normalize(responsavelTexto);
  if (!needle) return { profileId: null, rosterId: null };

  const matched = matchRoster(needle, roster as RosterEntry[]);
  if (matched) {
    return { profileId: matched.profileId, rosterId: matched.id };
  }

  // No confident roster hit — fall back to the account-based matcher
  // (full_name / email local-part). A person found only here has no roster
  // row yet (or the roster match was ambiguous and the account is unique).
  return {
    profileId: matchResponsavel(responsavelTexto, profiles),
    rosterId: null,
  };
}
