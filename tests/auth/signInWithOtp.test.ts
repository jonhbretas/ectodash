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

  // Test 1 (AUTH-01, revised 2026-08-04): shouldCreateUser is pinned to
  // true — volunteers self-register by the magic link and link their
  // account to their name in the institutional roster at /vincular
  // (migration 0017). D-02's invite-only mode was replaced by the
  // self-signup decision; new accounts start with vincular_pendente = true.
  it("passes shouldCreateUser: true to signInWithOtp", async () => {
    await requestMagicLink(
      initialState,
      formDataWith({ email: "voluntario@instituicao.org" })
    );

    expect(signInWithOtp).toHaveBeenCalledTimes(1);
    const [callArgs] = signInWithOtp.mock.calls[0];
    expect(callArgs.options.shouldCreateUser).toBe(true);
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
  "requestMagicLink integration (live Supabase project)",
  () => {
    it("creates an account for a new address (self-signup), with vincular_pendente set", async () => {
      const email = `ectodash-selfsignup-${Date.now()}@example.invalid`;

      const anon = createSupabaseClient(supabaseUrl!, anonKey!);
      await anon.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });

      const admin = createSupabaseClient(supabaseUrl!, serviceRoleKey!);
      const { data, error: profileError } = await admin
        .from("profiles")
        .select("id, vincular_pendente")
        .eq("email", email);

      expect(profileError).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]?.vincular_pendente).toBe(true);

      // Clean up the disposable self-signup account.
      if (data?.[0]?.id) {
        await admin.auth.admin.deleteUser(data[0].id);
      }
    });
  }
);

if (!canRunLive) {
  describe("requestMagicLink integration (live Supabase project)", () => {
    it.skip("SUPABASE_SERVICE_ROLE_KEY (or other required project env vars) not set — skipping live integration test", () => {
      // Intentionally empty: surfaces a visible skip message when
      // hosted-project credentials are unavailable.
    });
  });
}
