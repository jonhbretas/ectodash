import { findOrCreateChildFolder } from "@/lib/google/drive";

const ROOT = process.env.FINANCEIRO_DRIVE_ROOT_ID || "1MTu30ZaMYb-x_8cNyAX22pOFCn97fZSb";

export const FINANCE_FOLDER_LABELS: Record<string, string> = {
  nota_fiscal: "01 - Notas fiscais",
  extrato: "02 - Extratos bancários",
  recebimentos: "03 - Recebimentos e plataformas",
  cartao: "04 - Cartões e faturas",
  pagamentos: "05 - Pagamentos e comprovantes",
  conciliacao: "06 - Conciliação e conferência",
  relatorios: "07 - Relatórios contábeis",
  outros: "08 - Outros",
};

const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export async function getFinancialDriveFolder(competencia: string, categoria: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) throw new Error("Competência inválida.");
  const [year, month] = competencia.split("-").map(Number);
  const yearFolder = await findOrCreateChildFolder(ROOT, String(year));
  const monthFolder = await findOrCreateChildFolder(yearFolder.id, `${String(month).padStart(2, "0")} - ${meses[month - 1]}`);
  const label = FINANCE_FOLDER_LABELS[categoria] ?? FINANCE_FOLDER_LABELS.outros;
  return findOrCreateChildFolder(monthFolder.id, label);
}
