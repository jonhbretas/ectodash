import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  update: vi.fn(),
  maybeSingle: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/google/drive", () => ({ trashDriveFile: vi.fn() }));
import { marcarPautaDiscutida } from "./pauta-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.maybeSingle.mockResolvedValue({ data: { id: 12 }, error: null });
  mocks.createClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "autor" } } }) },
    from: () => ({ update: mocks.update }),
  });
  mocks.update.mockReturnValue({ eq: () => ({ select: () => ({ maybeSingle: mocks.maybeSingle }) }) });
});

describe("marcar pauta discutida", () => {
  it("grava status e reunião juntos e atualiza a listagem de pautas", async () => {
    expect(await marcarPautaDiscutida(12, 34)).toEqual({ ok: true });
    expect(mocks.update).toHaveBeenCalledWith({ status: "discutida", ata_discutida_id: 34 });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/reunioes/pautas");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/reunioes/34");
  });

  it("não informa sucesso quando RLS impede a atualização ou a pauta não existe", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await marcarPautaDiscutida(12, 34)).toMatchObject({ ok: false, message: expect.stringContaining("permissão") });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
