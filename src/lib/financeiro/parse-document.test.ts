import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { parseFinancialDocument } from "./parse-document";

// Gera um XLSX mínimo (ZIP + XML) para os fixtures de teste — o pacote
// xlsx/SheetJS foi removido do projeto (auditoria 0063/M3), então o
// fixture é montado aqui com fflate (dependência do read-excel-file).
type Cell = string | number;
function buildXlsx(sheets: { name: string; rows: Cell[][] }[]): Uint8Array {
  const esc = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const colName = (index: number) => {
    let name = "";
    let i = index;
    while (i >= 0) {
      name = String.fromCharCode(65 + (i % 26)) + name;
      i = Math.floor(i / 26) - 1;
    }
    return name;
  };
  const sheetXml = (rows: Cell[][]) => {
    const body = rows
      .map((row, r) => {
        const cells = row
          .map((cell, c) => {
            const ref = `${colName(c)}${r + 1}`;
            if (typeof cell === "number") {
              return `<c r="${ref}"><v>${cell}</v></c>`;
            }
            return `<c r="${ref}" t="inlineStr"><is><t>${esc(cell)}</t></is></c>`;
          })
          .join("");
        return `<row r="${r + 1}">${cells}</row>`;
      })
      .join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
  };

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
        )
        .join("")}</Types>`
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
        .map(
          (s, i) =>
            `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
        )
        .join("")}</sheets></workbook>`
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
        )
        .join("")}</Relationships>`
    ),
  };
  sheets.forEach((sheet, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(sheet.rows));
  });

  return zipSync(files, { level: 0 });
}

describe("financial document parser", () => {
  it("reads a CSV bank statement", async () => {
    const file = new File(["Data;Descrição;Valor\n01/02/2026;PIX recebido;1.234,56"], "extrato.csv", { type: "text/csv" });
    const result = await parseFinancialDocument(file);
    expect(result.rows[0]).toMatchObject({ date: "2026-02-01", inflow: 1234.56 });
  });
  it("reads every XLSX sheet", async () => {
    const bytes = buildXlsx([
      { name: "Janeiro", rows: [["Data", "Descrição", "Valor"], ["2026-01-01", "Tarifa", -10]] },
      { name: "Fevereiro", rows: [["Data", "Descrição", "Valor"], ["2026-02-01", "Resgate CDB", 100]] },
    ]);
    const result = await parseFinancialDocument(new File([bytes as unknown as ArrayBuffer], "extrato.xlsx"));
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.type)).toEqual(["TARIFA", "RESGATE"]);
  });
  it("reads OFX transactions", async () => {
    const text = `<OFX><STMTTRN><TRNAMT>-200.00<DTPOSTED>20260315<MEMO>Fornecedor</STMTTRN></OFX>`;
    const result = await parseFinancialDocument(new File([text], "bank.ofx"));
    expect(result.rows[0]).toMatchObject({ date: "2026-03-15", outflow: 200 });
  });
});
