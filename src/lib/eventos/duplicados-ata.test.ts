import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/ai/ai-client", () => ({ chatCompletion: vi.fn(), wrapUserContent: (texto: string) => texto }));
import { chatCompletion } from "@/lib/ai/ai-client";
import { detectarEventosDuplicadosNaAta, mesclarInformacoesEvento, type EventoDaAta } from "./duplicados-ata";

const existente = { id: 7, titulo: "Escola de Paraambulatóriologia", data_evento: "2026-11-15", local: "Online", descricao: "Quatro módulos. Inscrição R$ 400." };
const novo: EventoDaAta = { key: "extraido", titulo: "Escola Paraambulatório", data: "2026-11-15", local: null, descricao: "Divulgar o segundo lote." };
beforeEach(() => { vi.mocked(chatCompletion).mockReset(); });

describe("conferência automática de eventos da ata", () => {
  it("consulta a IA para nomes diferentes e retorna o evento cadastrado com justificativa", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify({ correspondencias: [{ key: novo.key, eventoId: 7, confianca: "alta", justificativa: "Mesma escola, edição e data." }] }));
    const resultado = await detectarEventosDuplicadosNaAta([novo], [existente]);
    expect(resultado.duplicados.extraido).toMatchObject({ id: 7, data: "2026-11-15", justificativa: "Mesma escola, edição e data." });
    expect(chatCompletion).toHaveBeenCalledOnce();
    expect(resultado.aviso).toBeNull();
  });

  it("detecta nomes e datas idênticos sem depender da API", async () => {
    const resultado = await detectarEventosDuplicadosNaAta([{ ...novo, titulo: "ESCOLA DE PARAAMBULATORIOLOGIA" }], [existente]);
    expect(resultado.duplicados.extraido.id).toBe(7);
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it("não aceita IDs inventados, outras chaves ou eventos fora dos candidatos", async () => {
    vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify({ correspondencias: [
      { key: novo.key, eventoId: 999, confianca: "alta", justificativa: "Inventado." },
      { key: "outra-chave", eventoId: 7, confianca: "alta", justificativa: "Outra chave." },
      { key: novo.key, eventoId: 8, confianca: "alta", justificativa: "Outro ano." },
    ] }));
    const resultado = await detectarEventosDuplicadosNaAta([novo], [existente, { ...existente, id: 8, data_evento: "2025-11-15" }]);
    expect(resultado.duplicados).toEqual({});
  });

  it("não considera outra edição de outro ano pelo nome sozinho", async () => {
    const resultado = await detectarEventosDuplicadosNaAta([novo], [{ ...existente, data_evento: "2025-11-15" }]);
    expect(resultado.duplicados).toEqual({});
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it("respeita a resposta de que cursos recorrentes não são o mesmo evento", async () => {
    vi.mocked(chatCompletion).mockResolvedValue('{"correspondencias":[]}');
    const resultado = await detectarEventosDuplicadosNaAta([novo], [{ ...existente, data_evento: "2026-11-22" }]);
    expect(resultado.duplicados).toEqual({});
  });

  it("confere locais diferentes com IA antes de sugerir a mesclagem, mesmo com nome e data iguais", async () => {
    vi.mocked(chatCompletion).mockResolvedValue('{"correspondencias":[]}');
    const resultado = await detectarEventosDuplicadosNaAta([{ ...novo, titulo: existente.titulo, local: "Curitiba" }], [existente]);
    expect(chatCompletion).toHaveBeenCalledOnce();
    expect(resultado.duplicados).toEqual({});
  });

  it("preserva as correspondências exatas quando a API fica indisponível para outros nomes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(chatCompletion).mockRejectedValue(new Error("Serviço indisponível"));
    const resultado = await detectarEventosDuplicadosNaAta([novo, { ...novo, key: "exato", titulo: existente.titulo }], [existente]);
    expect(resultado.duplicados.exato.id).toBe(7);
    expect(resultado.duplicados.extraido).toBeUndefined();
    expect(resultado.aviso).toContain("incompleta");
    vi.mocked(console.error).mockRestore();
  });

  it.each(["resposta inválida", '{"correspondencias":[{"eventoId":"7"}]}'])("mantém análise utilizável e avisa se o formato falhar: %s", async (resposta) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(chatCompletion).mockResolvedValue(resposta);
    const resultado = await detectarEventosDuplicadosNaAta([novo], [existente]);
    expect(resultado.duplicados).toEqual({});
    expect(resultado.aviso).toContain("incompleta");
    vi.restoreAllMocks();
  });
});

describe("informações de várias atas no mesmo card", () => {
  it("mantém o nome oficial, a descrição completa e o local quando a nova ata não o informa", () => {
    const campos = mesclarInformacoesEvento(existente, novo, "Reunião 28/10/2026");
    expect(campos.titulo).toBe(existente.titulo);
    expect(campos.local).toBe("Online");
    expect(campos.descricao).toContain(existente.descricao);
    expect(campos.descricao).toContain(novo.descricao);
    expect(campos.descricao).toContain("Reunião 28/10/2026");
    expect(campos.descricao).toContain("Nome citado: Escola Paraambulatório");
  });

  it("registra data e local anteriores quando a revisão aprova uma mudança", () => {
    const campos = mesclarInformacoesEvento(existente, { ...novo, data: "2026-11-16", local: "Foz" }, "Ata de revisão");
    expect(campos.data_evento).toBe("2026-11-16");
    expect(campos.local).toBe("Foz");
    expect(campos.descricao).toContain("Data anterior: 2026-11-15");
    expect(campos.descricao).toContain("Local anterior: Online");
  });

  it("não repete informações já acumuladas em uma segunda importação", () => {
    const campos = mesclarInformacoesEvento(existente, novo, "Ata A");
    const novamente = mesclarInformacoesEvento({ id: 7, ...campos }, novo, "Ata B");
    expect(novamente.descricao).toBe(campos.descricao);
  });
});
