// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SuggestionReviewList, { type Suggestion } from "./suggestion-review-list";

// This project's vitest.config.ts does not set `globals: true`, so
// @testing-library/react's own auto-cleanup (which registers itself via a
// global afterEach hook) never fires — without this explicit call, each
// test's rendered tree stays mounted into the next test's jsdom document,
// producing false "multiple elements found" failures across tests, not
// within any single one.
afterEach(() => {
  cleanup();
});

// createDemanda is mocked at the module boundary — this test suite proves
// SuggestionReviewList's OWN behavior (per-card state, gating, FormData
// shape passed to createDemanda) without touching Supabase/RLS, which
// plan 04's own tests already cover. Mirrors this repo's existing
// vi.mock() convention for an external/boundary dependency
// (08-01-SUMMARY.md's @google/genai mock precedent).
const mockCreateDemanda = vi.fn();
vi.mock("../actions", () => ({
  createDemanda: (...args: unknown[]) => mockCreateDemanda(...args),
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const voluntarios = [
  { id: 1, nome: "Maria Silva", temConta: true },
  { id: 2, nome: "João Souza", temConta: false },
];

function makeSuggestions(count: number): Suggestion[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `s${i + 1}`,
    titulo: `Tarefa ${i + 1}`,
    responsavelId:
      i === 0 ? String(voluntarios[0].id) : null, // first suggestion matched, rest unmatched
    responsavelTexto: i === 0 ? "Maria" : "Nome Desconhecido",
    prazoTexto: "próxima sexta",
    prazoSugerido: null,
  }));
}

beforeEach(() => {
  mockCreateDemanda.mockReset();
  mockPush.mockReset();
});

// The footer progress text ("{X} de {N} revisadas") is rendered from a JSX
// expression, splitting it across multiple text nodes inside the same <p> —
// getByText's default string matcher only matches a single node's own text,
// so this reads the paragraph's normalized textContent directly instead.
function getFooterProgressText(): string {
  const paragraph = screen.getByText(/revisadas/i);
  return (paragraph.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("SuggestionReviewList", () => {
  it("renders exactly one card per suggestion, headed 'Sugestão N de M'", () => {
    render(
      <SuggestionReviewList suggestions={makeSuggestions(3)} voluntarios={voluntarios} />
    );

    expect(screen.getByText("Sugestão 1 de 3")).toBeTruthy();
    expect(screen.getByText("Sugestão 2 de 3")).toBeTruthy();
    expect(screen.getByText("Sugestão 3 de 3")).toBeTruthy();
  });

  it("disables Confirmar when responsável is unmatched, enables it once a responsável is picked", async () => {
    const user = userEvent.setup();
    const suggestions: Suggestion[] = [
      {
        key: "s1",
        titulo: "Enviar relatório",
        responsavelId: null,
        responsavelTexto: "Alguém",
        prazoTexto: "sexta",
        prazoSugerido: null,
      },
    ];
    render(<SuggestionReviewList suggestions={suggestions} voluntarios={voluntarios} />);

    expect(screen.getByText(/não encontrou esse perfil cadastrado/i)).toBeTruthy();
    const confirmarButton = screen.getByRole("button", { name: "Confirmar" });
    expect(confirmarButton).toHaveProperty("disabled", true);

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);
    const option = await screen.findByText("Maria Silva");
    await user.click(option);

    expect(confirmarButton).toHaveProperty("disabled", false);
  });

  it("Rejeitar makes zero calls to createDemanda, shows 'Sugestão rejeitada' with a working Desfazer, and leaves other cards unaffected", async () => {
    const user = userEvent.setup();
    render(
      <SuggestionReviewList suggestions={makeSuggestions(2)} voluntarios={voluntarios} />
    );

    const cards = screen.getAllByText(/Sugestão \d de 2/);
    expect(cards).toHaveLength(2);

    const rejeitarButtons = screen.getAllByRole("button", { name: "Rejeitar" });
    await user.click(rejeitarButtons[1]);

    expect(mockCreateDemanda).not.toHaveBeenCalled();
    expect(screen.getByText("Sugestão rejeitada")).toBeTruthy();

    // Card 1 (matched, still pending) is unaffected — its título input is
    // still rendered and editable.
    expect(screen.getByDisplayValue("Tarefa 1")).toBeTruthy();

    const desfazer = screen.getByText("Desfazer");
    await user.click(desfazer);

    expect(screen.queryByText("Sugestão rejeitada")).toBeNull();
    // Restored card 2's título is still "Tarefa 2" (state preserved).
    expect(screen.getByDisplayValue("Tarefa 2")).toBeTruthy();
  });

  it("Confirmar calls createDemanda once with the card's CURRENT edited field values, then shows 'Criada'", async () => {
    const user = userEvent.setup();
    mockCreateDemanda.mockResolvedValue({ ok: true, message: "Demanda criada." });

    const suggestions: Suggestion[] = [
      {
        key: "s1",
        titulo: "Título original da IA",
        responsavelId: String(voluntarios[0].id),
        responsavelTexto: "Maria",
        prazoTexto: "sexta",
        prazoSugerido: null,
      },
    ];
    render(<SuggestionReviewList suggestions={suggestions} voluntarios={voluntarios} />);

    const tituloInput = screen.getByDisplayValue("Título original da IA");
    await user.clear(tituloInput);
    await user.type(tituloInput, "Título editado pelo humano");

    const prazoInput = screen.getByLabelText("Prazo *") as HTMLInputElement;
    await user.type(prazoInput, "2026-09-01");

    const confirmarButton = screen.getByRole("button", { name: "Confirmar" });
    await user.click(confirmarButton);

    expect(mockCreateDemanda).toHaveBeenCalledTimes(1);
    const [, formData] = mockCreateDemanda.mock.calls[0] as [unknown, FormData];
    expect(formData.get("titulo")).toBe("Título editado pelo humano");
    expect(formData.get("responsavelIds")).toBe(String(voluntarios[0].id));
    expect(formData.get("prazo")).toBe("2026-09-01");

    expect(await screen.findByText("Criada")).toBeTruthy();
  });

  it("a FAILED Confirmar leaves the card editable (not Criada) and shows the failure message", async () => {
    const user = userEvent.setup();
    mockCreateDemanda.mockResolvedValue({ ok: false, message: "" });

    const suggestions: Suggestion[] = [
      {
        key: "s1",
        titulo: "Tarefa",
        responsavelId: String(voluntarios[0].id),
        responsavelTexto: "Maria",
        prazoTexto: "sexta",
        prazoSugerido: null,
      },
    ];
    render(<SuggestionReviewList suggestions={suggestions} voluntarios={voluntarios} />);

    const prazoInput = screen.getByLabelText("Prazo *");
    await user.type(prazoInput, "2026-09-01");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(
      await screen.findByText(
        "Não foi possível criar essa demanda agora. Tente novamente."
      )
    ).toBeTruthy();
    expect(screen.queryByText("Criada")).toBeNull();
    // Card remains editable — título input still present.
    expect(screen.getByDisplayValue("Tarefa")).toBeTruthy();
  });

  it("footer count updates as cards resolve; Concluir revisão is disabled until all cards are resolved", async () => {
    const user = userEvent.setup();
    render(
      <SuggestionReviewList suggestions={makeSuggestions(2)} voluntarios={voluntarios} />
    );

    expect(getFooterProgressText()).toBe("0 de 2 revisadas");
    const concluirButton = screen.getByRole("button", { name: "Concluir revisão" });
    expect(concluirButton).toHaveProperty("disabled", true);

    const rejeitarButtons = screen.getAllByRole("button", { name: "Rejeitar" });
    await user.click(rejeitarButtons[0]);
    expect(getFooterProgressText()).toBe("1 de 2 revisadas");
    expect(concluirButton).toHaveProperty("disabled", true);

    await user.click(rejeitarButtons[1]);
    expect(getFooterProgressText()).toBe("2 de 2 revisadas");
    expect(concluirButton).toHaveProperty("disabled", false);

    await user.click(concluirButton);
    expect(mockPush).toHaveBeenCalledWith("/");
  });
});
