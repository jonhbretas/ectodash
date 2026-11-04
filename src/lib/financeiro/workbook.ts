import readXlsxFile from "read-excel-file/node";
import { unzipSync, zipSync } from "fflate";

export async function readFinancialWorkbook(data: Buffer) {
  try { return await readXlsxFile(data); }
  catch (error) {
    // Some Cielo exports use ZIP64 local headers that unzipper rejects.
    // Read the authoritative central directory and rebuild standard headers.
    let total = 0, count = 0;
    const entries = unzipSync(data, { filter: (entry) => {
      total += entry.originalSize; count++;
      if (entry.originalSize > 20 * 1024 * 1024 || total > 60 * 1024 * 1024 || count > 2000) throw new Error("Planilha expandida excede os limites de leitura.");
      return true;
    } });
    if (!entries["[Content_Types].xml"] || !entries["xl/workbook.xml"]) throw error;
    return readXlsxFile(Buffer.from(zipSync(entries, { level: 0 })));
  }
}
