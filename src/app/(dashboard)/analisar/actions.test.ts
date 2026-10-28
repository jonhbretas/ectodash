import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ completion: vi.fn(), gate: vi.fn(), write: vi.fn(), rpc: vi.fn(), eventos: [] as Array<{ id: number; titulo: string; data_evento: string; local: string | null; descricao: string | null }> }));
vi.mock("@/lib/ai/ai-client", () => ({ chatCompletion: mocks.completion, wrapUserContent: (texto: string) => texto }));
vi.mock("@/lib/role-gates", () => ({ requireAnaliseComIA: mocks.gate }));
vi.mock("@/lib/glossary-db", () => ({ listarTermosGlossario: async () => [] }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { analisarComIA, salvarTudoDaAnalise, type AnalisarState } from "./actions";

const source = "Na sexta-feira foram registrados doze participantes na dinâmica e o relatório será revisado na próxima reunião.";
const knownDip = { id: 7, localidade: "Curitiba", pais: "Brasil", data_dip: "2026-10-23" };

function payload(dip: Record<string, unknown>) {
  return JSON.stringify({
    tipo: "transcricao_reuniao", titulo: "Relatório de DIP", resumo: "Discussão dos resultados da dinâmica.",
    ata: { titulo: "Reunião geral", participantes: [], pontos_principais: ["Resultados da DIP"], deliberacoes: [], resumo: "Resultados discutidos." },
    demandas: [], eventos: [], pautas: [], atualizacoes: [], incertos: [],
    dips: [
      { participantes: 12, data: "2026-10-23", evidencia: source, ...dip },
      { localidade: "Curitiba", pais: "Brasil", participantes: 12, data: "2026-10-23", evidencia: source },
    ],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.completion.mockReset();
  mocks.rpc.mockReset().mockResolvedValue({ data: 104, error: null });
  mocks.eventos = [];
  mocks.gate.mockResolvedValue({ supabase: {
    rpc: mocks.rpc,
    from: (table: string) => {
      const chain = {
        data: table === "dips" ? [knownDip] : table === "eventos" ? mocks.eventos : [], error: null,
        select: () => chain, eq: () => chain, not: () => chain, order: () => chain, range: () => chain,
        insert: mocks.write, upsert: mocks.write, update: mocks.write,
      };
      return chain;
    },
  } });
});

describe("conferência de eventos ao subir ata", () => {
  it("executa a comparação após extrair a ata e oferece mesclagem sem escrever antes da revisão", async () => {
    mocks.eventos = [{ id: 12, titulo: "Escola de Paraambulatóriologia", data_evento: "2026-11-15", local: "Online", descricao: "Inscrições abertas." }];
    const extraido = JSON.parse(payload({ localidade: "Curitiba", pais: "Brasil" }));
    extraido.eventos = [{ titulo: "Escola Paraambulatório", data: "2026-11-15", descricao: "Divulgação aprovada.", evidencia: source }];
    mocks.completion.mockResolvedValueOnce(JSON.stringify(extraido)).mockImplementationOnce(async (_system: string, conteudo: string) => {
      const chave = conteudo.match(/"key":"([^"]+)"/)?.[1];
      return JSON.stringify({ correspondencias: [{ key: chave, eventoId: 12, confianca: "alta", justificativa: "Mesma edição e data." }] });
    });
    const form = new FormData();
    form.set("texto", source);
    const result = await analisarComIA({} as AnalisarState, form);
    expect(result.ok).toBe(true);
    expect(mocks.completion).toHaveBeenCalledTimes(2);
    const evento = result.eventos![0];
    expect(result.duplicados.eventos[evento.key]).toMatchObject({ id: 12, justificativa: "Mesma edição e data." });
    expect(mocks.write).not.toHaveBeenCalled();
  });
});
afterEach(() => vi.restoreAllMocks());

describe("ata da mesma data na análise unificada", () => {
  it("usa a mesclagem por data em vez de inserir outra ata", async () => {
    const ata = { titulo: "Ata de reunião", data: "2026-10-27", horario: "18:56", resumo: "Nova informação", participantes: "", pontos_principais: "", deliberacoes: "" };
    const resultado = await salvarTudoDaAnalise({ ata });
    expect(resultado).toMatchObject({ ok: true, ataId: 104 });
    expect(mocks.rpc).toHaveBeenCalledWith("salvar_reuniao_por_data", { p_dados: expect.objectContaining({ data_reuniao: "2026-10-27", horario: "18:56", status: "realizada" }) });
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it("interrompe os demais salvamentos se a ata existente não puder ser mesclada", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    const resultado = await salvarTudoDaAnalise({ ata: { titulo: "Ata", data: "2026-10-27", horario: "18:56", resumo: "", participantes: "", pontos_principais: "", deliberacoes: "" }, eventos: [{ titulo: "Curso", data: "2026-11-01", local: null, descricao: null }] });
    expect(resultado.ok).toBe(false);
    expect(mocks.write).not.toHaveBeenCalled();
  });
});

async function analyze(dip: Record<string, unknown>) {
  mocks.completion.mockResolvedValue(payload(dip));
  const form = new FormData();
  form.set("texto", source);
  return analisarComIA({} as AnalisarState, form);
}

describe("DIPs incompletos na análise de IA", () => {
  it.each([{}, { localidade: null, pais: null }, { localidade: "  ", pais: "" }])(
    "preserva ata e DIP para revisão quando a localização vem incompleta: %j", async (dip) => {
      const result = await analyze(dip);
      expect(result.ok).toBe(true);
      expect(result.ata?.titulo).toBe("Reunião geral");
      expect(result.dips).toHaveLength(2);
      expect(result.dips?.[0]).toMatchObject({ localidade: "", pais: "", participantes: "12" });
      expect(mocks.write).not.toHaveBeenCalled();
    }
  );

  it("preserva o país explícito e continua identificando DIP já cadastrado para mesclagem", async () => {
    const result = await analyze({ localidade: "Lisboa", pais: "Portugal" });
    expect(result.ok).toBe(true);
    expect(result.dips?.[0]).toMatchObject({ localidade: "Lisboa", pais: "Portugal" });
    const curitiba = result.dips![1];
    expect(curitiba.pais).toBe("Brasil");
    expect(result.duplicados.dips[curitiba.key]).toMatchObject({ id: 7, localidade: "Curitiba" });
  });

  it("não inventa país para uma localidade conhecida", async () => {
    const result = await analyze({ localidade: "Lisboa" });
    expect(result.ok).toBe(true);
    expect(result.dips?.[0]).toMatchObject({ localidade: "Lisboa", pais: "" });
  });

  it("continua rejeitando tipos incompatíveis", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await analyze({ localidade: 123 });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("dips.0.localidade");
    expect(mocks.write).not.toHaveBeenCalled();
  });
});
