// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime";
import type { NextRouter } from "next/router";
import Sidebar from "./sidebar";
import AccountFloatingMenu from "./account-floating-menu";

vi.mock("next/navigation", () => ({
  usePathname: () => "/demandas",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("./quick-search", () => ({ default: () => null }));
vi.mock("./sign-out-button", () => ({ default: () => null }));

// Exercise the real Next Link component. The router is the boundary stub,
// so a plain anchor regression fails instead of passing through a fake Link.
const router: NextRouter = {
  basePath: "", pathname: "/demandas", route: "/demandas", asPath: "/demandas", query: {},
  push: vi.fn(async () => true), replace: vi.fn(async () => true),
  prefetch: vi.fn(async () => {}), reload: vi.fn(), back: vi.fn(), forward: vi.fn(),
  beforePopState: vi.fn(), isFallback: false, isReady: true, isPreview: false, isLocaleDomain: false,
  events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
};

function renderSidebar() {
  return render(<RouterContext.Provider value={router}>
    <Sidebar acesso={{ role: "coordenador_geral", cargos: [] }} />
  </RouterContext.Provider>);
}

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
afterEach(cleanup);

describe("navegação do menu", () => {
  it("usa o roteador interno ao trocar de tela", async () => {
    renderSidebar();
    await userEvent.click(screen.getByRole("link", { name: "Atas de reunião" }));
    expect(router.push).toHaveBeenCalledWith("/reunioes", "/reunioes", expect.any(Object));
    expect(screen.getByRole("navigation", { name: "Menu principal" })).toBeTruthy();
  });

  it("preserva os parâmetros dos links de navegação", async () => {
    renderSidebar();
    await userEvent.click(screen.getByRole("link", { name: "Demandas da Coordenação" }));
    expect(router.push).toHaveBeenCalledWith("/demandas?coordenacao=1", "/demandas?coordenacao=1", expect.any(Object));
  });

  it("navega pelos cabeçalhos dos grupos sem recarregar o documento", async () => {
    renderSidebar();
    await userEvent.click(screen.getByRole("link", { name: "DIP" }));
    expect(router.push).toHaveBeenCalledWith("/dips", "/dips", expect.any(Object));
  });

  it("fecha o menu móvel após iniciar a navegação interna", async () => {
    renderSidebar();
    await userEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const menus = screen.getAllByRole("navigation", { name: "Menu principal" });
    await userEvent.click(within(menus[1]).getByRole("link", { name: "Atas de reunião" }));
    expect(router.push).toHaveBeenCalledWith("/reunioes", "/reunioes", expect.any(Object));
    expect(screen.queryByRole("button", { name: "Fechar menu" })).toBeNull();
  });

  it("fecha o menu da conta ao navegar para o perfil", async () => {
    render(<RouterContext.Provider value={router}>
      <AccountFloatingMenu isCoordenador={false} viewAsOptions={[]} />
    </RouterContext.Provider>);
    await userEvent.click(screen.getByText("Minha conta"));
    const link = screen.getByRole("link", { name: "Meu perfil" });
    const menu = link.closest("details")!;
    expect(menu.open).toBe(true);
    await userEvent.click(link);
    expect(router.push).toHaveBeenCalledWith("/perfil", "/perfil", expect.any(Object));
    expect(menu.open).toBe(false);
  });
});
