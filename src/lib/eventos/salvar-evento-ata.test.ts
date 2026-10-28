import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("@/lib/ai/ai-client", () => ({ chatCompletion: vi.fn(), wrapUserContent: (texto: string) => texto }));
import { listarEventosParaConferencia, salvarEventoDaAta } from "./salvar-evento-ata";

type Registro = { id: number; titulo: string; data_evento: string; local: string | null; descricao: string | null; updated_at: string };
const evento: Registro = { id: 7, titulo: "Escola Paraambulatório", data_evento: "2026-11-15", local: "Online", descricao: "Lote inicial R$ 400.", updated_at: "versao-1" };
const novo = { titulo: evento.titulo, data: evento.data_evento, local: null, descricao: "Lote final R$ 600." };

function bancoMemoria(iniciais: Registro[], bloquearUpdate = false) {
  const registros = iniciais.map((r) => ({ ...r }));
  let versao = 1;
  const from = vi.fn(() => {
    const filtros: Array<[string, unknown]> = [];
    let campos: Record<string, unknown> | undefined;
    let inserido: Record<string, unknown> | undefined;
    const executar = () => {
      if (inserido) {
        const registro = { id: 99, ...inserido, updated_at: `versao-${++versao}` } as Registro;
        registros.push(registro);
        return [registro];
      }
      const encontrados = registros.filter((r) => filtros.every(([chave, valor]) => r[chave as keyof Registro] === valor));
      if (!campos) return encontrados;
      if (bloquearUpdate) return [];
      encontrados.forEach((r) => Object.assign(r, campos, { updated_at: `versao-${++versao}` }));
      return encontrados;
    };
    const chain = {
      select: () => chain,
      eq: (campo: string, valor: unknown) => { filtros.push([campo, valor]); return chain; },
      update: (valor: Record<string, unknown>) => { campos = valor; return chain; },
      insert: (valor: Record<string, unknown>) => { inserido = valor; return chain; },
      single: async () => ({ data: executar()[0] ?? null, error: null }),
      maybeSingle: async () => ({ data: executar()[0] ?? null, error: null }),
      then: (resolve: (value: unknown) => void) => resolve({ data: executar(), error: null }),
    };
    return chain;
  });
  return { supabase: { from } as unknown as SupabaseClient, registros };
}

describe("salvamento de eventos vindos de atas", () => {
  it("duas atas atualizam o mesmo ID e preservam todas as informações", async () => {
    const banco = bancoMemoria([evento]);
    expect(await salvarEventoDaAta(banco.supabase, novo, { eventoId: 7, fonte: "Ata A" })).toEqual({ id: 7, atualizado: true });
    await salvarEventoDaAta(banco.supabase, { ...novo, descricao: "Divulgação aprovada." }, { eventoId: 7, fonte: "Ata B" });
    expect(banco.registros).toHaveLength(1);
    expect(banco.registros[0].descricao).toContain("Lote inicial R$ 400.");
    expect(banco.registros[0].descricao).toContain("Lote final R$ 600.");
    expect(banco.registros[0].descricao).toContain("Divulgação aprovada.");
  });

  it("reconfere duplicados exatos ao salvar, inclusive duas menções no mesmo lote", async () => {
    const banco = bancoMemoria([]);
    const criado = await salvarEventoDaAta(banco.supabase, novo, { fonte: "Ata A" });
    const mesclado = await salvarEventoDaAta(banco.supabase, novo, { fonte: "Ata A" });
    expect(criado.atualizado).toBe(false);
    expect(mesclado).toEqual({ id: criado.id, atualizado: true });
    expect(banco.registros).toHaveLength(1);
  });

  it("mantém a escolha de criar separado quando o operador identifica outra edição", async () => {
    const banco = bancoMemoria([evento]);
    await salvarEventoDaAta(banco.supabase, novo, { criarMesmoAssim: true, fonte: "Ata" });
    expect(banco.registros).toHaveLength(2);
  });

  it("não cria outra cópia se o evento a mesclar sumiu ou está sem acesso", async () => {
    const banco = bancoMemoria([]);
    await expect(salvarEventoDaAta(banco.supabase, novo, { eventoId: 7, fonte: "Ata" })).rejects.toThrow("sem acesso");
    expect(banco.registros).toHaveLength(0);
  });

  it("não considera sucesso uma atualização bloqueada por RLS ou por concorrência", async () => {
    const banco = bancoMemoria([evento], true);
    await expect(salvarEventoDaAta(banco.supabase, novo, { eventoId: 7, fonte: "Ata" })).rejects.toThrow("alterado por outra pessoa");
    expect(banco.registros[0].descricao).toBe(evento.descricao);
  });

  it("consulta páginas além do limite padrão da API", async () => {
    const primeira = Array.from({ length: 500 }, (_, id) => ({ ...evento, id }));
    const range = vi.fn().mockResolvedValueOnce({ data: primeira, error: null }).mockResolvedValueOnce({ data: [{ ...evento, id: 501 }], error: null });
    const supabase = { from: () => ({ select: () => ({ order: () => ({ range }) }) }) } as unknown as SupabaseClient;
    const resultado = await listarEventosParaConferencia(supabase);
    expect(resultado.data).toHaveLength(501);
    expect(range).toHaveBeenLastCalledWith(500, 999);
  });
});
