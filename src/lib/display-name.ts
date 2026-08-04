// Display-name helper — profiles have no name column beyond full_name
// (added in migration 0008); every label in the app falls back from the
// name to the email local display. Single source so the fallback never
// drifts across screens.
export function displayName(profile: {
  full_name?: string | null;
  email?: string | null;
}): string {
  const name = profile.full_name?.trim();
  if (name) return name;
  const email = profile.email?.trim();
  if (email) return email;
  return "Voluntário";
}
