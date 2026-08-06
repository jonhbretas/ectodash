// src/lib/proep/naming.ts
// Convenções de nome para pastas e arquivos do PROEP no Google Drive.
//
// Exemplo (data do evento = ago/2026, aluno = Fulano de Tal):
//   pasta da turma  -> PROEP AGO 26
//   pasta do aluno  -> PROEP AGO 26 - Fulano de Tal
//   planilha        -> PROEP AGO 26 - Fulano de Tal - Planilha
//   formulário      -> PROEP AGO 26 - Fulano de Tal - Parapercepciograma

const MONTHS_PT = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

/** "PROEP AGO 26" a partir da data de início do evento. */
export function editionShortLabel(startDate: string | null): string {
  if (!startDate) return "PROEP";
  const d = new Date(`${startDate}T00:00:00`);
  if (isNaN(d.getTime())) return "PROEP";
  const month = MONTHS_PT[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return `PROEP ${month} ${year}`;
}

/** Pasta do aluno dentro da pasta da turma. */
export function studentFolderName(label: string, studentName: string): string {
  return `${label} - ${studentName}`;
}

/** Planilha clonada para o aluno. */
export function studentSpreadsheetName(label: string, studentName: string): string {
  return `${label} - ${studentName} - Planilha`;
}

/** Formulário clonado para o aluno. */
export function studentFormName(label: string, studentName: string): string {
  return `${label} - ${studentName} - Parapercepciograma`;
}
