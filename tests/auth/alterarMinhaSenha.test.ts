import { beforeEach, describe, expect, it, vi } from "vitest";
import { alterarMinhaSenha } from "@/app/(dashboard)/voluntarios/actions";

const getUser = vi.fn();
const signInWithPassword = vi.fn();
const updateUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser, signInWithPassword, updateUser },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

type State = { message: string; ok: boolean };
const initialState: State = { ok: false, message: "" };

function formDataWith(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("alterarMinhaSenha (self-service)", () => {
  beforeEach(() => {
    getUser.mockReset();
    signInWithPassword.mockReset();
    updateUser.mockReset();
    getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "ana@ectolab.org" } },
      error: null,
    });
  });

  it("troca a senha após confirmar a senha atual", async () => {
    signInWithPassword.mockResolvedValueOnce({ error: null });
    updateUser.mockResolvedValueOnce({ error: null });

    const result = await alterarMinhaSenha(
      initialState,
      formDataWith({
        senhaAtual: "Antiga123",
        novaSenha: "NovaSenha123",
        confirmacao: "NovaSenha123",
      })
    );

    expect(result.ok).toBe(true);
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "ana@ectolab.org",
      password: "Antiga123",
    });
    expect(updateUser).toHaveBeenCalledWith({ password: "NovaSenha123" });
  });

  it("rejeita senha atual incorreta e não chama updateUser", async () => {
    signInWithPassword.mockResolvedValueOnce({
      error: { message: "Invalid login credentials" },
    });

    const result = await alterarMinhaSenha(
      initialState,
      formDataWith({
        senhaAtual: "Errada123",
        novaSenha: "NovaSenha123",
        confirmacao: "NovaSenha123",
      })
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("incorreta");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejeita senhas que não conferem antes de tocar a auth", async () => {
    const result = await alterarMinhaSenha(
      initialState,
      formDataWith({
        senhaAtual: "Antiga123",
        novaSenha: "NovaSenha123",
        confirmacao: "Diferente1",
      })
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("não conferem");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("rejeita senha nova com menos de 8 caracteres", async () => {
    const result = await alterarMinhaSenha(
      initialState,
      formDataWith({
        senhaAtual: "Antiga123",
        novaSenha: "curta",
        confirmacao: "curta",
      })
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("8 caracteres");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("rejeita sessão ausente", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await alterarMinhaSenha(
      initialState,
      formDataWith({
        senhaAtual: "Antiga123",
        novaSenha: "NovaSenha123",
        confirmacao: "NovaSenha123",
      })
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Sessão");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
