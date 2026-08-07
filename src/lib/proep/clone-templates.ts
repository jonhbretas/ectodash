// src/lib/proep/clone-templates.ts
// Clona os templates de material (is_template=true) da turma para a pasta do
// aluno no Google Drive. Usado pelo "Gerar" (provision) e pelo "Reclonar".
import { createClient } from "@/lib/supabase/server";
import { copyDriveFile, setLinkSharing, shareWithEmail } from "@/lib/google/drive";
import { duplicateForm } from "@/lib/google/forms";
import { studentSpreadsheetName, studentFormName } from "./naming";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type CloneResults = {
  links: Record<string, string>;
  errors: Record<string, string>;
};

export async function cloneTemplatesIntoFolder(
  supabase: Supabase,
  editionId: number,
  editionLabel: string,
  studentName: string,
  studentFolderId: string,
): Promise<CloneResults> {
  const links: Record<string, string> = {};
  const errors: Record<string, string> = {};

  const { data: allTemplates } = await supabase
    .from("proep_materials")
    .select("*")
    .eq("is_template", true);
  const templates = (allTemplates ?? []).filter((t) => t.edition_id === editionId);

  // 1. Planilha template (primeira) clonada para a pasta do aluno
  const spreadsheetTemplate = templates?.find((t) => t.file_type === "spreadsheet" && t.file_id);
  if (spreadsheetTemplate?.file_id) {
    try {
      const copy = await copyDriveFile(
        spreadsheetTemplate.file_id,
        studentSpreadsheetName(editionLabel, studentName),
        studentFolderId,
      );
      await setLinkSharing(copy.id, "writer");
      links.planilha_url = `https://docs.google.com/spreadsheets/d/${copy.id}/edit`;
    } catch (e: any) { errors.planilha_error = e.message; }
  }

  // 2. Formulário template (primeiro) duplicado para a pasta do aluno.
  //    Sem permissão pública: professores (M1/M2/P1/P2) ganham edição por
  //    e-mail; alunos apenas respondem pelo link do formulário.
  const formTemplate = templates?.find((t) => t.file_type === "form" && t.file_id);
  if (formTemplate?.file_id) {
    try {
      const form = await duplicateForm(
        formTemplate.file_id,
        studentFormName(editionLabel, studentName),
        studentFolderId,
      );
      links.parapercepciograma_url = `https://docs.google.com/forms/d/${form.formId}/edit`;
      links.form_responder_url = form.responderUri;

      const { data: teachers } = await supabase
        .from("proep_students")
        .select("email")
        .eq("edition_id", editionId)
        .neq("role", "participant");
      const emails = [...new Set((teachers ?? []).map((t) => t.email).filter(Boolean))] as string[];
      for (const email of emails) {
        try {
          await shareWithEmail(form.formId, email, "writer");
        } catch { /* falha em um e-mail não aborta os demais */ }
      }
    } catch (e: any) { errors.form_error = e.message; }
  }

  return { links, errors };
}
