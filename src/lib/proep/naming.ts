// src/lib/proep/naming.ts
// Convenções de nome para pastas e arquivos do PROEP no Google Drive.
//
// Exemplo (data do evento = 26/ago/2026, aluno = Fulano de Tal):
//   pasta da turma  -> PROEP 26 AGO
//   pasta do aluno  -> PROEP 26 AGO - Fulano de Tal
//   planilha        -> PROEP 26 AGO - Fulano de Tal - Planilha
//   formulario      -> PROEP 26 AGO - Fulano de Tal - Parapercepciograma

const MONTHS_PT = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

/** "PROEP 26 AGO" a partir da data de inicio do evento. */
export function editionShortLabel(startDate: string | null): string {
  if (!startDate) return "PROEP";
  const d = new Date(`${startDate}T00:00:00`);
  if (isNaN(d.getTime())) return "PROEP";
  const day = String(d.getDate());
  const month = MONTHS_PT[d.getMonth()];
  return `PROEP ${day} ${month}`;
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
