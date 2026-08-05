// src/lib/ai/match-responsavel.ts
// Pure, deterministic responsável-name matcher (08-RESEARCH.md Pattern 2).
// Never returns a fabricated id: only a real profile.id already present in
// the `profiles` array passed in, or null when no confident match exists.
// Substring match against the display name (full_name) AND the email
// local-part — no fuzzy/edit-distance matching (Don't Hand-Roll) — a wrong
// or missing match is always corrected by the mandatory human review step
// (Wave 2), never silently trusted. With fictitious-name seeding in place
// (seed-voluntarios.ts), transcript names like "Ana" match "Ana Beatriz
// Souza" directly.

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    // Strip combining diacritical marks (e.g. "María" -> "maria").
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function matchResponsavel(
  responsavelTexto: string,
  profiles: { id: string; email: string; full_name?: string | null }[]
): string | null {
  const needle = normalize(responsavelTexto);
  if (!needle) return null;

  for (const profile of profiles) {
    const haystacks = [normalize(profile.email.split("@")[0])];
    if (profile.full_name) haystacks.push(normalize(profile.full_name));

    // Substring match handles "Ana" matching "ana.souza@..." /
    // "ana beatriz souza" and the full name matching the same, in either
    // direction.
    for (const haystack of haystacks) {
      if (haystack.includes(needle) || needle.includes(haystack)) {
        return profile.id;
      }
    }
  }

  return null; // No confident match — the review UI leaves the responsável
  // field empty and required, never auto-selecting a wrong guess.
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

export function matchResponsavelRoster(
  responsavelTexto: string,
  profiles: { id: string; email: string; full_name?: string | null }[],
  roster: RosterVoluntario[]
): { profileId: string | null; rosterId: number | null } {
  const needle = normalize(responsavelTexto);
  if (!needle) return { profileId: null, rosterId: null };

  for (const entry of roster) {
    const haystack = normalize(entry.nome);
    if (haystack.includes(needle) || needle.includes(haystack)) {
      return { profileId: entry.profileId, rosterId: entry.id };
    }
  }

  // No roster hit — fall back to the account-based matcher (full_name /
  // email local-part). A person found only here has no roster row yet.
  return {
    profileId: matchResponsavel(responsavelTexto, profiles),
    rosterId: null,
  };
}
