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

  it("aceita demanda com área, projeto, evento e etiqueta_texto (auto-seleção da revisão)", () => {
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
          etiqueta_texto: "Orçamento",
        },
      ],
      eventos: [],
      atualizacoes: [],
      dips: [],
      pautas: [],
    });

    const demanda = result.demandas[0];
    expect(demanda.area_texto).toBe("Financeiro");
    expect(demanda.projeto_texto).toBe("Projeto X");
    expect(demanda.evento_texto).toBe("Qualificação de Agosto");
    expect(demanda.etiqueta_texto).toBe("Orçamento");
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
      pautas: [],
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
        pautas: [],
      })
    ).toThrow();
  });

  it("aceita pautas adiadas para a próxima reunião", () => {
    const result = ataAnaliseSchema.parse({
      ata: baseAta,
      demandas: [],
      eventos: [],
      atualizacoes: [],
      dips: [],
      pautas: [
        { titulo: "Revisar metas do trimestre", contexto: "Ficou para a próxima reunião" },
        { titulo: "Definir data da próxima DIP" },
      ],
    });

    expect(result.pautas).toHaveLength(2);
    expect(result.pautas[0].titulo).toBe("Revisar metas do trimestre");
    expect(result.pautas[0].contexto).toBe("Ficou para a próxima reunião");
    expect(result.pautas[1].contexto).toBeUndefined();
  });

  it("aceita ata sem resumo e DIP sem país para revisão humana", () => {
    const result = ataAnaliseSchema.parse({
      ata: { ...baseAta, resumo: "" },
      demandas: [],
      eventos: [],
      atualizacoes: [],
      dips: [
        {
          localidade: "Lisboa",
          pais: "",
          data: "2026-10-09",
          participantes: 12,
          observacoes: "",
        },
        {
          localidade: "",
          pais: "",
          data: "2026-10-09",
          participantes: 12,
          observacoes: "",
        },
      ],
      pautas: [],
    });

    expect(result.ata.resumo).toBe("");
    expect(result.dips[0].pais).toBe("");
    expect(result.dips[1].localidade).toBe("");
  });

  it("aceita localização ausente ou nula sem descartar as outras partes da análise", () => {
    const result = ataAnaliseSchema.parse({
      ata: baseAta, demandas: [], eventos: [], atualizacoes: [], pautas: [],
      dips: [{ participantes: 12 }, { localidade: null, pais: null }, { localidade: "  Lisboa  ", pais: "  Portugal  " }],
    });
    expect(result.ata.titulo).toBe(baseAta.titulo);
    expect(result.dips[0]).toMatchObject({ localidade: "", pais: "", participantes: 12 });
    expect(result.dips[1]).toMatchObject({ localidade: "", pais: "" });
    expect(result.dips[2]).toMatchObject({ localidade: "Lisboa", pais: "Portugal" });
  });

  it.each([{ localidade: 123 }, { pais: false }, { localidade: "a".repeat(201) }, { pais: "a".repeat(101) }])(
    "mantém a validação de tipo e tamanho da localização: %j", (dip) => {
      expect(ataAnaliseSchema.safeParse({
        ata: baseAta, demandas: [], eventos: [], atualizacoes: [], pautas: [], dips: [dip],
      }).success).toBe(false);
    }
  );

  it("envelope JSON-mode continua exigindo a chave analise", () => {
    const ok = ataAnaliseEnvelopeSchema.safeParse({
      analise: {
        ata: baseAta,
        demandas: [],
        eventos: [],
        atualizacoes: [],
        dips: [],
        pautas: [],
      },
    });
    expect(ok.success).toBe(true);

    const semEnvelope = ataAnaliseEnvelopeSchema.safeParse({
      ata: baseAta,
      demandas: [],
      eventos: [],
      atualizacoes: [],
      dips: [],
      pautas: [],
    });
    expect(semEnvelope.success).toBe(false);
  });
});
