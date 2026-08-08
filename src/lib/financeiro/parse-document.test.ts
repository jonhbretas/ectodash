import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseFinancialDocument } from "./parse-document";

describe("financial document parser", () => {
  it("reads a CSV bank statement", async () => {
    const file = new File(["Data;Descrição;Valor\n01/02/2026;PIX recebido;1.234,56"], "extrato.csv", { type: "text/csv" });
    const result = await parseFinancialDocument(file);
    expect(result.rows[0]).toMatchObject({ date: "2026-02-01", inflow: 1234.56 });
  });
  it("reads every XLSX sheet", async () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Data", "Descrição", "Valor"], ["2026-01-01", "Tarifa", -10]]), "Janeiro");
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Data", "Descrição", "Valor"], ["2026-02-01", "Resgate CDB", 100]]), "Fevereiro");
    const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" });
    const result = await parseFinancialDocument(new File([bytes], "extrato.xlsx"));
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.type)).toEqual(["TARIFA", "RESGATE"]);
  });
  it("reads OFX transactions", async () => {
    const text = `<OFX><STMTTRN><TRNAMT>-200.00<DTPOSTED>20260315<MEMO>Fornecedor</STMTTRN></OFX>`;
    const result = await parseFinancialDocument(new File([text], "bank.ofx"));
    expect(result.rows[0]).toMatchObject({ date: "2026-03-15", outflow: 200 });
  });
});
