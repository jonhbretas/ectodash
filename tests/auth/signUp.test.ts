import { beforeEach, describe, expect, it, vi } from "vitest";
import { signUp } from "@/app/(auth)/cadastro/actions";

const signUpAuth = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signUp: signUpAuth },
  })),
}));

let maybeSingleResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};

const adminFrom = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn(async () => maybeSingleResult),
    }),
  }),
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: adminFrom })),
}));

type CadastroState = { message: string; ok: boolean };

const initialState: CadastroState = { ok: false, message: "" };

function formDataWith(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("signUp", () => {
  beforeEach(() => {
    maybeSingleResult = { data: null, error: null };
    signUpAuth.mockReset();
  });

  it("returns ok and calls auth.signUp for a new, valid email", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    signUpAuth.mockResolvedValueOnce({ error: null });

    const result = await signUp(
      initialState,
      formDataWith({
        email: "novo@ecolab.org",
        password: "Senha123",
        confirmPassword: "Senha123",
      })
    );

    expect(result.ok).toBe(true);
    expect(signUpAuth).toHaveBeenCalledWith({
      email: "novo@ecolab.org",
      password: "Senha123",
      options: {
        emailRedirectTo: "http://localhost:3000/auth/confirm",
      },
    });
  });

  it("rejects a duplicate email without calling auth.signUp", async () => {
    maybeSingleResult = {
      data: { id: "00000000-0000-0000-0000-000000000000" },
      error: null,
    };

    const result = await signUp(
      initialState,
      formDataWith({
        email: "ja-existe@ecolab.org",
        password: "Senha123",
        confirmPassword: "Senha123",
      })
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("já está cadastrado");
    expect(signUpAuth).not.toHaveBeenCalled();
  });

  it("rejects a password mismatch before contacting Supabase", async () => {
    const result = await signUp(
      initialState,
      formDataWith({
        email: "novo@ecolab.org",
        password: "Senha123",
        confirmPassword: "Outra123",
      })
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("não conferem");
    expect(signUpAuth).not.toHaveBeenCalled();
  });

  it("rejects an invalid email before contacting Supabase", async () => {
    const result = await signUp(
      initialState,
      formDataWith({
        email: "not-an-email",
        password: "Senha123",
        confirmPassword: "Senha123",
      })
    );

    expect(result.ok).toBe(false);
    expect(signUpAuth).not.toHaveBeenCalled();
  });

  it("maps auth.signUp errors to a generic message", async () => {
    signUpAuth.mockResolvedValueOnce({
      error: { message: "over_email_send_rate_limit" },
    });

    const result = await signUp(
      initialState,
      formDataWith({
        email: "novo@ecolab.org",
        password: "Senha123",
        confirmPassword: "Senha123",
      })
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Erro ao criar conta");
  });
});
