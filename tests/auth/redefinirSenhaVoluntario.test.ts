import { beforeEach, describe, expect, it, vi } from "vitest";
import { redefinirSenhaVoluntario } from "@/app/(dashboard)/voluntarios/actions";

const getUser = vi.fn();
const singleRole = vi.fn();
const maybeSingleAlvo = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from: vi.fn((table: string) => {
      if (table !== "profiles") {
        return { select: vi.fn() };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: singleRole,
            maybeSingle: maybeSingleAlvo,
          })),
        })),
      };
    }),
  })),
}));

const updateUserById = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { updateUserById } },
  })),
}));

const sendNovaSenha = vi.fn();

vi.mock("@/lib/notifications/send-nova-senha", () => ({
  sendNovaSenha: (...args: unknown[]) => sendNovaSenha(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("redefinirSenhaVoluntario (coordenador geral)", () => {
  beforeEach(() => {
    getUser.mockReset();
    singleRole.mockReset();
    maybeSingleAlvo.mockReset();
    updateUserById.mockReset();
    sendNovaSenha.mockReset();
    getUser.mockResolvedValue({
      data: { user: { id: "coord-1", email: "coord@ectolab.org" } },
      error: null,
    });
    singleRole.mockResolvedValue({ data: { role: "coordenador_geral" }, error: null });
    maybeSingleAlvo.mockResolvedValue({
      data: {
        email: "ana@ectolab.org",
        full_name: "Ana Prado",
        voluntario_id: 42,
      },
      error: null,
    });
  });

  it("redefine a senha via admin API e envia a nova senha por e-mail", async () => {
    updateUserById.mockResolvedValueOnce({ error: null });
    sendNovaSenha.mockResolvedValueOnce({ error: null });

    const result = await redefinirSenhaVoluntario("profile-1", "NovaSenha123");

    expect(result.ok).toBe(true);
    expect(result.message).toContain("e-mail");
    expect(updateUserById).toHaveBeenCalledWith("profile-1", {
      password: "NovaSenha123",
    });
    expect(sendNovaSenha).toHaveBeenCalledWith({
      to: "ana@ectolab.org",
      nome: "Ana Prado",
      novaSenha: "NovaSenha123",
    });
  });

  it("bloqueia quem não é coordenador geral", async () => {
    singleRole.mockResolvedValue({ data: { role: "voluntario_comum" }, error: null });

    const result = await redefinirSenhaVoluntario("profile-1", "NovaSenha123");

    expect(result.ok).toBe(false);
    expect(result.message).toContain("coordenador geral");
    expect(updateUserById).not.toHaveBeenCalled();
    expect(sendNovaSenha).not.toHaveBeenCalled();
  });

  it("exige sessão", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await redefinirSenhaVoluntario("profile-1", "NovaSenha123");

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Sessão");
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("rejeita senha com menos de 8 caracteres antes de tocar a admin API", async () => {
    const result = await redefinirSenhaVoluntario("profile-1", "123");

    expect(result.ok).toBe(false);
    expect(updateUserById).not.toHaveBeenCalled();
    expect(sendNovaSenha).not.toHaveBeenCalled();
  });

  it("mantém a redefinição e avisa quando o e-mail falha", async () => {
    updateUserById.mockResolvedValueOnce({ error: null });
    sendNovaSenha.mockResolvedValueOnce({ error: "smtp down" });

    const result = await redefinirSenhaVoluntario("profile-1", "NovaSenha123");

    expect(result.ok).toBe(true);
    expect(result.message).toContain("não foi possível enviar o e-mail");
    expect(updateUserById).toHaveBeenCalledTimes(1);
  });

  it("reporta erro do updateUserById sem enviar e-mail", async () => {
    updateUserById.mockResolvedValueOnce({ error: { message: "boom" } });

    const result = await redefinirSenhaVoluntario("profile-1", "NovaSenha123");

    expect(result.ok).toBe(false);
    expect(sendNovaSenha).not.toHaveBeenCalled();
  });
});
