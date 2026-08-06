import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signIn } from "@/app/(auth)/login/actions";

const signInWithPassword = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithPassword },
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

describe("signIn", () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    signInWithPassword.mockResolvedValue({ error: null });
  });

  it("calls signInWithPassword with email and password", async () => {
    await signIn(
      initialState,
      formDataWith({ email: "user@example.com", password: "senha1234" })
    );

    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "senha1234",
    });
  });

  it("returns ok: true on successful login", async () => {
    signInWithPassword.mockResolvedValueOnce({ error: null });
    const result = await signIn(
      initialState,
      formDataWith({ email: "user@example.com", password: "senha1234" })
    );

    expect(result.ok).toBe(true);
  });

  it("returns ok: false with error message on invalid credentials", async () => {
    signInWithPassword.mockResolvedValueOnce({
      error: { message: "Invalid login credentials" },
    });
    const result = await signIn(
      initialState,
      formDataWith({ email: "user@example.com", password: "wrong" })
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("incorretos");
  });

  it("rejects invalid email before calling Supabase", async () => {
    const result = await signIn(
      initialState,
      formDataWith({ email: "not-an-email", password: "senha1234" })
    );

    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });

  it("rejects empty password before calling Supabase", async () => {
    const result = await signIn(
      initialState,
      formDataWith({ email: "user@example.com", password: "" })
    );

    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });
});
