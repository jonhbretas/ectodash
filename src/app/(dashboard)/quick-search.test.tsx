// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import QuickSearch from "./quick-search";

const mocks = vi.hoisted(() => ({
  requests: [] as Array<{
    signal: AbortSignal;
    resolve: (value: { data: unknown[]; error?: { message: string } }) => void;
  }>,
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => {
      const query = {
        select: () => query,
        ilike: () => query,
        or: () => query,
        order: () => query,
        limit: () => query,
        abortSignal: (signal: AbortSignal) => new Promise((resolve) => {
          mocks.requests.push({ signal, resolve });
        }),
      };
      return query;
    },
  }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  mocks.requests.length = 0;
  mocks.push.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function buscar(value: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Busca rápida" }), { target: { value } });
  await act(() => vi.advanceTimersByTimeAsync(200));
}

describe("busca rápida", () => {
  it("aguarda a digitação e cancela todas as consultas anteriores ao trocar o termo", async () => {
    render(<QuickSearch />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ab" } });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "abc" } });
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(mocks.requests).toHaveLength(5);
    const anteriores = [...mocks.requests];
    await buscar("abcd");
    expect(anteriores.every((request) => request.signal.aborted)).toBe(true);
    expect(mocks.requests.slice(5).every((request) => !request.signal.aborted)).toBe(true);
  });

  it("ignora respostas antigas que chegam depois da busca atual", async () => {
    render(<QuickSearch />);
    await buscar("antigo");
    const anteriores = [...mocks.requests];
    await buscar("novo");
    await act(async () => {
      mocks.requests.slice(5).forEach((request, index) => request.resolve({
        data: index === 0 ? [{ id: 2, titulo: "Resultado atual", prazo: null }] : [],
      }));
    });
    expect(screen.getByText("Resultado atual")).toBeTruthy();
    await act(async () => {
      anteriores.forEach((request, index) => request.resolve({
        data: index === 0 ? [{ id: 1, titulo: "Resultado antigo", prazo: null }] : [],
      }));
    });
    expect(screen.queryByText("Resultado antigo")).toBeNull();
    expect(screen.getByText("Resultado atual")).toBeTruthy();
  });

  it("cancela consultas ao limpar o campo e ao desmontar", async () => {
    const view = render(<QuickSearch />);
    await buscar("evento");
    await buscar("");
    expect(mocks.requests.every((request) => request.signal.aborted)).toBe(true);
    await buscar("projeto");
    view.unmount();
    expect(mocks.requests.every((request) => request.signal.aborted)).toBe(true);
  });

  it("exibe falha de consulta em vez de apresentar ausência de resultados", async () => {
    render(<QuickSearch />);
    await buscar("evento");
    await act(async () => {
      mocks.requests.forEach((request) => request.resolve({ data: [], error: { message: "offline" } }));
    });
    expect(screen.getByText(/Não foi possível buscar agora/)).toBeTruthy();
    expect(screen.queryByText(/Nenhum resultado/)).toBeNull();
  });
});
