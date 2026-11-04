import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  completarPais,
  encontrarDipExistente,
  salvarDipsDaAta,
  type DipExistente,
} from "./salvar-dips-da-ata";

const existentes: DipExistente[] = [
  { id: 1, localidade: "Foz do Iguaçu", pais: "Brasil", data_dip: "2026-08-21" },
  { id: 2, localidade: "Foz do Iguaçu", pais: "Brasil", data_dip: "2026-08-28" },
  { id: 3, localidade: "Curitiba", pais: "Brasil", data_dip: null },
];

describe("completarPais", () => {
  it("usa o cadastro quando a IA não informa o país", () => {
    expect(completarPais("curitiba", "", [{ localidade: "Curitiba", pais: "Brasil" }])).toBe("Brasil");
    expect(completarPais("Lisboa", "", [])).toBe("");
    expect(completarPais("Lisboa", " Portugal ", [])).toBe("Portugal");
  });
});

describe("encontrarDipExistente", () => {
  it("casa mesma localidade e data, ignorando acento e caixa", () => {
    expect(encontrarDipExistente({ localidade: "foz do iguacu", pais: "brasil", data: "2026-08-28" }, existentes)?.id).toBe(2);
  });
  it("não casa datas diferentes (DIPs são semanais)", () => {
    expect(encontrarDipExistente({ localidade: "Foz do Iguaçu", pais: "Brasil", data: "2026-09-04" }, existentes)).toBeNull();
  });
  it("menção sem data atualiza o registro mais recente", () => {
    expect(encontrarDipExistente({ localidade: "Foz do Iguaçu", pais: "", data: null }, existentes)?.id).toBe(2);
  });
  it("registro sem data recebe a data da menção", () => {
    expect(encontrarDipExistente({ localidade: "Curitiba", pais: "Brasil", data: "2026-08-21" }, existentes)?.id).toBe(3);
  });
});

function mockSupabase(opts: { rpcError?: { code: string; message: string } } = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: 1, error: opts.rpcError ?? null });
  const inserts: unknown[] = [];
  let nextId = 100;
  const from = vi.fn((table: string) => {
    if (table === "dips") {
      return {
        select: () => Promise.resolve({ data: existentes, error: null }),
        insert: (row: unknown) => {
          inserts.push(row);
          return { select: () => ({ single: () => Promise.resolve({ data: { id: nextId++ }, error: null }) }) };
        },
      };
    }
    return { select: () => Promise.resolve({ data: [{ localidade: "Curitiba", pais: "Brasil" }], error: null }) };
  });
  return { supabase: { rpc, from } as unknown as SupabaseClient, rpc, inserts };
}

describe("salvarDipsDaAta", () => {
  it("mescla duplicata via RPC aditiva em vez de inserir", async () => {
    const { supabase, rpc, inserts } = mockSupabase();
    const r = await salvarDipsDaAta(supabase, 10, [
      { localidade: "Foz do Iguaçu", pais: "Brasil", data: "2026-08-28", participantes: null, observacoes: "nova info" },
    ]);
    expect(r).toMatchObject({ salvos: 0, atualizados: 1, erros: [] });
    expect(inserts).toHaveLength(0);
    expect(rpc).toHaveBeenCalledWith("mesclar_dip_da_ata", expect.objectContaining({ p_dip_id: 2, p_participantes: null, p_observacoes: "nova info" }));
  });

  it("acusa falta de permissão em vez de contar como atualizado", async () => {
    const { supabase } = mockSupabase({ rpcError: { code: "42501", message: "x" } });
    const r = await salvarDipsDaAta(supabase, 10, [
      { localidade: "Foz do Iguaçu", pais: "Brasil", data: "2026-08-21", participantes: 5, observacoes: "", acao: "incrementar", dipId: 1 },
    ]);
    expect(r.atualizados).toBe(0);
    expect(r.erros[0]).toContain("sem permissão");
  });

  it("insere novo DIP completando o país e reporta quando falta país", async () => {
    const { supabase, inserts } = mockSupabase();
    const r = await salvarDipsDaAta(supabase, 10, [
      { localidade: "Curitiba ", pais: "", data: "2026-09-04", participantes: 21, observacoes: "", acao: "criar" },
      { localidade: "Lisboa", pais: "", data: "2026-09-04", participantes: 3, observacoes: "" },
    ]);
    expect(inserts).toEqual([expect.objectContaining({ localidade: "Curitiba", pais: "Brasil", ata_id: 10 })]);
    expect(r.salvos).toBe(1);
    expect(r.erros[0]).toContain("Lisboa");
  });
});
