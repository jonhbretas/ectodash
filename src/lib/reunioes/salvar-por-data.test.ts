import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { salvarReuniaoPorData } from "./salvar-por-data";

describe("identidade da reunião por dia", () => {
  it("encaminha horários diferentes à mesma operação atômica por data", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 104, error: null });
    const supabase = { rpc } as unknown as SupabaseClient;
    const campos = { titulo: "Reunião", data_reuniao: "2026-10-27", resumo: "Parte da ata" };
    expect(await salvarReuniaoPorData(supabase, { ...campos, horario: "19:00" })).toEqual({ id: 104 });
    expect(await salvarReuniaoPorData(supabase, { ...campos, horario: "18:56" })).toEqual({ id: 104 });
    expect(rpc).toHaveBeenLastCalledWith("salvar_reuniao_por_data", { p_dados: { ...campos, horario: "18:56" } });
  });

  it("não cria uma cópia como alternativa a uma mesclagem sem permissão", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(salvarReuniaoPorData({ rpc } as unknown as SupabaseClient, { titulo: "Ata", data_reuniao: "2026-10-27" })).rejects.toThrow("permissão");
    expect(rpc).toHaveBeenCalledOnce();
  });
});
