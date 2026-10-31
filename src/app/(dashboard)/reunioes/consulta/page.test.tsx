// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const { getUser, range, consulta } = vi.hoisted(() => ({ getUser: vi.fn(), range: vi.fn(), consulta: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser },
  from: () => ({ select: () => ({ order: () => ({ order: () => ({ range }) }) }) }),
}) }));
vi.mock("../../page-container", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("./consulta-atas", () => ({ default: (props: unknown) => { consulta(props); return <div>Resultados</div>; } }));
import ConsultaAtasPage from "./page";

beforeEach(() => { vi.clearAllMocks(); getUser.mockResolvedValue({ data: { user: { id: "usuario" } } }); });
afterEach(cleanup);

it("não consulta dados sem sessão", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  expect(await ConsultaAtasPage()).toBeNull();
  expect(range).not.toHaveBeenCalled();
});

it("carrega todas as páginas acessíveis antes de disponibilizar a busca", async () => {
  range.mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null })
    .mockResolvedValueOnce({ data: [{ id: 501 }], error: null });
  render(await ConsultaAtasPage());
  expect(range.mock.calls).toEqual([[0, 499], [500, 999]]);
  expect(consulta.mock.calls[0][0].atas).toHaveLength(501);
});

it("exibe erro em vez de apresentar resultados incompletos", async () => {
  range.mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null })
    .mockResolvedValueOnce({ data: null, error: { message: "falha" } });
  render(await ConsultaAtasPage());
  expect(screen.getByRole("alert").textContent).toContain("Não foi possível carregar");
  expect(consulta).not.toHaveBeenCalled();
});
