// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import FinanceAIPanel from "./panel";
import type { MonthlyAIReport } from "@/lib/financeiro/ai-report";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const metrics = { count: 1, cashIn: 100, cashOut: 20, balance: 80, operatingIn: 100, operatingOut: 20, result: 80, billed: 100, outstanding: 0 };
const report: MonthlyAIReport = { competencia: "2026-11", analysisYear: 2026, generatedAt: "2026-11-04T15:00:00Z", monthly: metrics, annual: metrics, months: [{ month: "2026-11", hasData: true, metrics }], blockers: [], warnings: [], notes: [], reconciled: 1, narrative: { summary: "Resumo financeiro", monthlyAnalysis: ["Dados do mês"], annualAnalysis: ["Dados do ano"], recommendations: [] }, imports: 1 };
const props = { month: "2026-11", currentYear: 2026, configured: true, initialReport: { id: "report", report }, closed: false, exceptions: [], imports: [] };
describe("financial AI user flow", () => {
  it("requires document completeness before confirming closing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, closed: true }))); vi.stubGlobal("fetch", fetchMock);
    render(<FinanceAIPanel {...props}/>);
    const button = screen.getByRole("button", { name: "Confirmar e fechar 2026-11" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /Enviei e conferi todos/ }));
    fireEvent.click(button);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ action: "close", documentsComplete: true, reportId: "report", competencia: "2026-11" });
    await waitFor(() => expect(screen.getByText(/Competência 2026-11 fechada/)).toBeTruthy());
  });
  it("does not allow closing when report blockers remain", () => {
    render(<FinanceAIPanel {...props} initialReport={{ id: "report", report: { ...report, blockers: ["Nota ilegível"] } }}/>);
    fireEvent.click(screen.getByRole("checkbox", { name: /Enviei e conferi todos/ }));
    expect((screen.getByRole("button", { name: "Confirmar e fechar 2026-11" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Nota ilegível")).toBeTruthy();
  });
  it("shows current-year coverage and an explicit AI configuration requirement", () => {
    render(<FinanceAIPanel {...props} configured={false}/>);
    expect(screen.getByRole("heading", { name: "Ano vigente · 2026" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("chave OpenAI");
    expect(screen.getByRole("button", { name: "Ler arquivos e processar o mês" }).matches(":disabled")).toBe(true);
  });
});
