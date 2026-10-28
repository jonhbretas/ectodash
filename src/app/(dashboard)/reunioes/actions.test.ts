import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "autor" } } }) },
  rpc: mocks.rpc,
  from: () => ({ upsert: mocks.upsert }),
}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { criarAta } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: 104, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
});

describe("registro manual da ata", () => {
  it("mescla pelo dia e acrescenta participantes sem repetir os já vinculados", async () => {
    const form = new FormData();
    form.set("titulo", "Reunião geral");
    form.set("data_reuniao", "2026-10-27");
    form.set("resumo", "Informação complementar");
    form.append("voluntarioIds", "10");
    form.append("voluntarioIds", "10");
    expect((await criarAta({ ok: false, message: "" }, form)).ok).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("salvar_reuniao_por_data", { p_dados: expect.objectContaining({ data_reuniao: "2026-10-27", status: "realizada" }) });
    expect(mocks.upsert).toHaveBeenCalledWith([{ ata_id: 104, voluntario_id: 10 }], { onConflict: "ata_id,voluntario_id", ignoreDuplicates: true });
  });
});
