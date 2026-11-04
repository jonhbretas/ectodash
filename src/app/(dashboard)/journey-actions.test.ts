import { beforeEach, describe, expect, it, vi } from "vitest";
import { registrarExploracao } from "./journey-actions";

const mocks = vi.hoisted(() => ({
  revalidate: vi.fn(), upsert: vi.fn(),
  getUser: vi.fn(), from: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: mocks.getUser },
  from: mocks.from,
}) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mocks.from.mockReturnValue({ upsert: mocks.upsert });
  mocks.upsert.mockResolvedValue({ error: null });
});

describe("registro de exploração", () => {
  it("registra visitas sem invalidar a navegação nem os destinos pré-carregados", async () => {
    expect(await registrarExploracao("sistema:perfil", false)).toEqual({ success: true });
    expect(mocks.upsert).toHaveBeenCalledExactlyOnceWith(
      { profile_id: "user-1", etapa_id: "sistema:perfil" },
      { onConflict: "profile_id,etapa_id", ignoreDuplicates: true }
    );
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("continua atualizando o progresso após confirmação explícita", async () => {
    expect(await registrarExploracao("docente:livro")).toEqual({ success: true });
    expect(mocks.revalidate.mock.calls).toEqual([["/"], ["/trilha"]]);
  });

  it("exige sessão válida mesmo para visitas automáticas", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect(await registrarExploracao("sistema:perfil", false)).toHaveProperty("error");
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("não confirma progresso quando a gravação falha", async () => {
    mocks.upsert.mockResolvedValue({ error: { message: "offline" } });
    expect(await registrarExploracao("docente:livro")).toHaveProperty("error");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
