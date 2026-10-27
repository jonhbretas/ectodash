import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ completion: vi.fn(), gate: vi.fn(), write: vi.fn() }));
vi.mock("@/lib/ai/ai-client", () => ({ chatCompletion: mocks.completion }));
vi.mock("@/lib/role-gates", () => ({ requireAnaliseComIA: mocks.gate }));
vi.mock("@/lib/glossary-db", () => ({ listarTermosGlossario: async () => [] }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { analisarComIA, type AnalisarState } from "./actions";

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
  mocks.gate.mockResolvedValue({ supabase: {
    from: (table: string) => {
      const chain = {
        data: table === "dips" ? [knownDip] : [], error: null,
        select: () => chain, eq: () => chain, not: () => chain,
        insert: mocks.write, upsert: mocks.write, update: mocks.write,
      };
      return chain;
    },
  } });
});
afterEach(() => vi.restoreAllMocks());

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
