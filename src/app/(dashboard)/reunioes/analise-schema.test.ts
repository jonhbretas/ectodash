import { describe, expect, it } from "vitest";
import { ataAnaliseEnvelopeSchema, ataAnaliseSchema } from "./analise-schema";

// Pure unit tests against the zod schema only — no live database, mirrors
// demanda-filter-schema.test.ts's style. The AI's response is untrusted
// external output, validated before the human review gate sees it.
describe("ataAnaliseSchema demandas", () => {
  const baseAta = {
    titulo: "Reunião geral",
    data: "2026-08-10",
    horario: "19:00",
    participantes: ["Ana"],
    pontos_principais: ["Ponto"],
    deliberacoes: ["Deliberação"],
    resumo: "Resumo",
  };

  it("aceita demanda com área, projeto e evento_texto (auto-seleção da revisão)", () => {
    const result = ataAnaliseSchema.parse({
      ata: baseAta,
      demandas: [
        {
          titulo: "Revisar orçamento",
          responsavel_texto: "Maria",
          prazo_texto: "sexta",
          prazo_sugerido: "2026-08-14",
          area_texto: "Financeiro",
          projeto_texto: "Projeto X",
          evento_texto: "Qualificação de Agosto",
        },
      ],
      eventos: [],
      atualizacoes: [],
      dips: [],
    });

    const demanda = result.demandas[0];
    expect(demanda.area_texto).toBe("Financeiro");
    expect(demanda.projeto_texto).toBe("Projeto X");
    expect(demanda.evento_texto).toBe("Qualificação de Agosto");
  });

  it('aceita demanda sem os campos novos (vazio ou ausente não quebra a análise)', () => {
    const result = ataAnaliseSchema.parse({
      ata: baseAta,
      demandas: [
        { titulo: "Enviar relatório", responsavel_texto: "João", prazo_texto: "" },
      ],
      eventos: [],
      atualizacoes: [],
      dips: [],
    });

    const demanda = result.demandas[0];
    expect(demanda.area_texto).toBeUndefined();
    expect(demanda.projeto_texto).toBeUndefined();
    expect(demanda.evento_texto).toBeUndefined();
  });

  it("rejeita área acima do tamanho máximo", () => {
    expect(() =>
      ataAnaliseSchema.parse({
        ata: baseAta,
        demandas: [
          {
            titulo: "X",
            responsavel_texto: "",
            prazo_texto: "",
            area_texto: "a".repeat(201),
          },
        ],
        eventos: [],
        atualizacoes: [],
        dips: [],
      })
    ).toThrow();
  });

  it("envelope JSON-mode continua exigindo a chave analise", () => {
    const ok = ataAnaliseEnvelopeSchema.safeParse({
      analise: {
        ata: baseAta,
        demandas: [],
        eventos: [],
        atualizacoes: [],
        dips: [],
      },
    });
    expect(ok.success).toBe(true);

    const semEnvelope = ataAnaliseEnvelopeSchema.safeParse({
      ata: baseAta,
      demandas: [],
      eventos: [],
      atualizacoes: [],
      dips: [],
    });
    expect(semEnvelope.success).toBe(false);
  });
});
