import { describe, expect, it } from "vitest";
import { isGroupActive, isNavItemActive, navEntries, type NavGroup } from "./nav-items";

describe("seleção de demandas no menu", () => {
  it.each([
    ["/demandas", "", true, false],
    ["/demandas", "area=Pesquisa", true, false],
    ["/demandas", "coordenacao=1", false, true],
    ["/demandas", "view=kanban&coordenacao=1&status=pendente", false, true],
    ["/demandas/nova", "coordenacao=1", false, true],
    ["/demandas/nova", "", true, false],
    ["/demandas", "coordenacao=0", true, false],
    ["/demandas-outras", "coordenacao=1", false, false],
  ])("%s?%s ativa somente a seção correta", (pathname, query, normal, coordenacao) => {
    const params = new URLSearchParams(query);
    expect(isNavItemActive("/demandas", pathname, params)).toBe(normal);
    expect(isNavItemActive("/demandas?coordenacao=1", pathname, params)).toBe(coordenacao);
    const group = navEntries.find((entry) => entry.label === "Gestão Operacional") as NavGroup;
    expect(isGroupActive(group, pathname, params)).toBe(normal);
  });

  it("mantém a seleção de reuniões e pedidos de pauta separada", () => {
    const params = new URLSearchParams("tab=pautas&status=aberto");
    expect(isNavItemActive("/reunioes", "/reunioes", params)).toBe(false);
    expect(isNavItemActive("/reunioes?tab=pautas", "/reunioes", params)).toBe(true);
  });
});
