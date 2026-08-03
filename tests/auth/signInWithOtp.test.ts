import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requestMagicLink } from "@/app/(auth)/login/actions";

// .env.local is git-ignored and holds real project credentials. Load it here
// so the live integration case (5) below can run locally with `npm test`
// without extra setup. In CI (or any environment where the file is absent)
// this is a silent no-op — the suite falls back to real process env vars and
// skips visibly if they are missing.
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not found — rely on real environment variables (e.g. CI secrets).
}

const signInWithOtp = vi.fn();

// Hoisted above the imports above by Vitest's mock transform, regardless of
// its textual position in this file.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithOtp },
  })),
}));

type LoginState = { message: string; ok: boolean };

const initialState: LoginState = { ok: false, message: "" };

function formDataWith(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("requestMagicLink", () => {
  const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    signInWithOtp.mockReset();
    signInWithOtp.mockResolvedValue({ error: null });
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL;
  });

  // Test 1 (AUTH-01, D-02): shouldCreateUser is pinned to false.
  it("passes shouldCreateUser: false to signInWithOtp", async () => {
    await requestMagicLink(
      initialState,
      formDataWith({ email: "voluntario@instituicao.org" })
    );

    expect(signInWithOtp).toHaveBeenCalledTimes(1);
    const [callArgs] = signInWithOtp.mock.calls[0];
    expect(callArgs.options.shouldCreateUser).toBe(false);
  });

  // Test 2: emailRedirectTo is built only from NEXT_PUBLIC_SITE_URL — a
  // caller-supplied redirectTo/next field in the form is ignored (closes the
  // open-redirect path).
  it("builds emailRedirectTo from NEXT_PUBLIC_SITE_URL only, ignoring caller-supplied redirect fields", async () => {
    await requestMagicLink(
      initialState,
      formDataWith({
        email: "voluntario@instituicao.org",
        redirectTo: "https://evil.example.com/",
        next: "https://evil.example.com/",
      })
    );

    const [callArgs] = signInWithOtp.mock.calls[0];
    expect(callArgs.options.emailRedirectTo).toBe(
      "http://localhost:3000/auth/callback"
    );
  });

  // Test 3: identical returned message whether the Supabase call errors or
  // not — closes the enumeration path.
  it("returns the identical message whether signInWithOtp errors or not", async () => {
    signInWithOtp.mockResolvedValueOnce({ error: null });
    const successResult = await requestMagicLink(
      initialState,
      formDataWith({ email: "voluntario@instituicao.org" })
    );

    signInWithOtp.mockResolvedValueOnce({
      error: { message: "some internal error" },
    });
    const errorResult = await requestMagicLink(
      initialState,
      formDataWith({ email: "voluntario@instituicao.org" })
    );

    expect(successResult).toEqual(errorResult);
    expect(successResult.ok).toBe(true);
  });

  // Test 4: a syntactically invalid address is rejected before Supabase is
  // ever called.
  it("rejects a syntactically invalid address before calling Supabase", async () => {
    const result = await requestMagicLink(
      initialState,
      formDataWith({ email: "not-an-email" })
    );

    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });
});

// Test 5 (integration, live project): a never-invited address must create no
// account, proving D-02 against the real system rather than only against a
// mock. This case talks to the real Supabase project directly (not through
// the mocked "@/lib/supabase/server" module above) and is skipped visibly
// when the service-role key isn't available.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRunLive = Boolean(supabaseUrl && anonKey && serviceRoleKey);

describe.skipIf(!canRunLive)(
  "requestMagicLink integration (live Supabase project, D-02)",
  () => {
    it("creates no account for a never-invited address", async () => {
      const email = `ectodash-never-invited-${Date.now()}@example.invalid`;

      const anon = createSupabaseClient(supabaseUrl!, anonKey!);
      // No assertion on the call's error here: with shouldCreateUser: false
      // and self-signup disabled Dashboard-wide, Supabase may reject this
      // outright (e.g. "Signups not allowed for otp") rather than resolving
      // silently — either shape is consistent with D-02. What actually
      // matters, and is asserted below, is that no account/profile row gets
      // created for a never-invited address either way.
      await anon.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });

      const admin = createSupabaseClient(supabaseUrl!, serviceRoleKey!);
      const { data, error: profileError } = await admin
        .from("profiles")
        .select("id")
        .eq("email", email);

      expect(profileError).toBeNull();
      expect(data).toHaveLength(0);
    });
  }
);

if (!canRunLive) {
  describe("requestMagicLink integration (live Supabase project, D-02)", () => {
    it.skip("SUPABASE_SERVICE_ROLE_KEY (or other required project env vars) not set — skipping live integration test", () => {
      // Intentionally empty: surfaces a visible skip message when
      // hosted-project credentials are unavailable.
    });
  });
}
