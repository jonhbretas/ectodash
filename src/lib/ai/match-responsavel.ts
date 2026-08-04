// src/lib/ai/match-responsavel.ts
// Pure, deterministic responsável-name matcher (08-RESEARCH.md Pattern 2).
// Never returns a fabricated id: only a real profile.id already present in
// the `profiles` array passed in, or null when no confident match exists.
// Substring match against the email local-part only — no fuzzy/edit-distance
// matching (Don't Hand-Roll) — a wrong or missing match is always corrected
// by the mandatory human review step (Wave 2), never silently trusted.

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    // Strip combining diacritical marks (e.g. "María" -> "maria").
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export function matchResponsavel(
  responsavelTexto: string,
  profiles: { id: string; email: string }[]
): string | null {
  const needle = normalize(responsavelTexto);
  if (!needle) return null;

  for (const profile of profiles) {
    const localPart = normalize(profile.email.split("@")[0]);
    // Substring match handles "Maria" matching "maria.silva@..." and
    // "maria.silva" matching the same, in either direction.
    if (localPart.includes(needle) || needle.includes(localPart)) {
      return profile.id;
    }
  }

  return null; // No confident match — the review UI leaves the responsável
  // field empty and required, never auto-selecting a wrong guess.
}
