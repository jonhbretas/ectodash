import { describe, expect, it } from "vitest";
import PDFDocument from "pdfkit";
import { parseFinancialDocument } from "./parse-document";

async function pdf(pages: string[][]): Promise<File> {
  const doc = new PDFDocument({ autoFirstPage: false });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  for (const lines of pages) {
    doc.addPage();
    for (const line of lines) doc.fontSize(10).text(line);
  }
  doc.end();
  return new File([new Uint8Array(await done)], "extrato.pdf", { type: "application/pdf" });
}

describe("financial PDF extraction (real PDFs)", () => {
  it("reads single spaced statements across pages and preserves page provenance", async () => {
    const result = await parseFinancialDocument(await pdf([
      ["Data Historico Valor Saldo", "01/11/2026 PIX recebido 1.234,56 C 2.000,00 C", "02/11/2026 Tarifa 12,50 D 1.987,50 C"],
      ["Data Historico Valor Saldo", "03/11/2026 Fornecedor 100,00 D 1.887,50 C", "03/11/2026 Saldo final 1.887,50 C"],
    ]));
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toMatchObject({ date: "2026-11-01", inflow: 1234.56, sheet: "PDF · página 1" });
    expect(result.rows[1]).toMatchObject({ outflow: 12.5, type: "TARIFA" });
    expect(result.rows[2]).toMatchObject({ outflow: 100, sheet: "PDF · página 2" });
    expect(result.warnings).toEqual([]);
  });

  it("warns about unreadable pages even when another page was extracted", async () => {
    const result = await parseFinancialDocument(await pdf([
      ["Data Historico Valor", "01/11/2026 PIX 100,00 C"], [],
    ]));
    expect(result.rows).toHaveLength(1);
    expect(result.warnings.some((warning) => warning.includes("página 2") && warning.includes("OCR"))).toBe(true);
  });

  it("does not invent movements from an invoice or malformed PDF", async () => {
    const invoice = await parseFinancialDocument(await pdf([["Nota fiscal", "Total R$ 1.000,00", "Vencimento 01/11/2026"]]));
    expect(invoice.rows).toEqual([]);
    expect(invoice.warnings.length).toBeGreaterThan(0);
    const malformed = await parseFinancialDocument(new File(["invalid"], "broken.pdf"));
    expect(malformed.rows).toEqual([]);
    expect(malformed.warnings.length).toBeGreaterThan(0);
  });

  it("keeps invalid dated statement lines for review", async () => {
    const result = await parseFinancialDocument(await pdf([["Data Historico Valor", "31/02/2026 PIX 100,00 C", "01/11/2026 Fornecedor ilegivel"]]));
    expect(result.rows).toEqual([]);
    expect(result.warnings.filter((warning) => warning.includes("Linha"))).toHaveLength(2);
  });
});
