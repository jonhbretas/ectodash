import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ completion: vi.fn(), createClient: vi.fn() }));
vi.mock("@/lib/ai/ai-client", () => ({ chatCompletion: mocks.completion, wrapUserContent: (texto: string) => texto }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/glossary-db", () => ({ listarTermosGlossario: async () => [] }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { analisarTranscricao, type AnalisarTranscricaoState } from "./analise-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.completion.mockReset();
  mocks.createClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "coordenador" } } }) },
    from: (tabela: string) => {
      const chain = {
        data: tabela === "eventos" ? [{ id: 17, titulo: "Escola de Paraambulatóriologia", data_evento: "2026-11-15", local: "Online", descricao: "Quatro módulos." }] : [],
        error: null,
        select: () => chain, order: () => chain, limit: () => chain, range: () => chain,
        maybeSingle: async () => ({ data: null, error: null }),
      };
      return chain;
    },
  });
});

describe("conferência de eventos no upload de ata pronta", () => {
  it("entrega a sugestão de mesclagem para revisão após a extração", async () => {
    mocks.completion.mockResolvedValueOnce(JSON.stringify({ analise: {
      ata: { titulo: "Reunião geral", participantes: [], pontos_principais: [], deliberacoes: [], resumo: "Divulgação aprovada." },
      eventos: [{ titulo: "Escola Paraambulatório", data: "2026-11-15", descricao: "Divulgar inscrições." }],
      demandas: [], atualizacoes: [], dips: [], pautas: [],
    } })).mockResolvedValueOnce(JSON.stringify({ correspondencias: [{ key: "0", eventoId: 17, confianca: "alta", justificativa: "Mesmo curso e data." }] }));
    const form = new FormData();
    form.set("texto", "Reunião geral: divulgar inscrições para a Escola Paraambulatório em 15/11/2026.");
    form.set("tipoFonte", "ata_pronta");
    const resultado = await analisarTranscricao({} as AnalisarTranscricaoState, form);
    expect(resultado.ok).toBe(true);
    expect(resultado.analise?.eventos[0].duplicado).toMatchObject({ id: 17, justificativa: "Mesmo curso e data." });
    expect(mocks.completion).toHaveBeenCalledTimes(2);
  });
});
