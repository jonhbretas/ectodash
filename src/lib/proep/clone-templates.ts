// src/lib/proep/clone-templates.ts
// Clona os templates de material (is_template=true) da turma para a pasta do
// aluno no Google Drive. Usado pelo "Gerar" (provision) e pelo "Reclonar".
// Cada template vira uma cópia com o nome do aluno; o primeiro template de
// cada tipo legado (spreadsheet/form) também atualiza os campos clássicos.
import { createClient } from "@/lib/supabase/server";
import { copyDriveFile, setLinkSharing, shareWithEmail } from "@/lib/google/drive";
import { duplicateForm } from "@/lib/google/forms";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ClonedMaterial = {
  material_id: string;
  title: string;
  drive_url: string;
};

export type CloneResults = {
  links: Record<string, string>;
  materials: ClonedMaterial[];
  errors: Record<string, string>;
};

function cloneFileName(editionLabel: string, studentName: string, title: string): string {
  return `${editionLabel} - ${studentName} - ${title}`;
}

function driveFileUrl(mimeType: string | null, fileId: string): string {
  if (mimeType === "spreadsheet") return `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
  if (mimeType === "form") return `https://docs.google.com/forms/d/${fileId}/edit`;
  if (mimeType === "doc") return `https://docs.google.com/document/d/${fileId}/edit`;
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export async function cloneTemplatesIntoFolder(
  supabase: Supabase,
  editionId: number,
  editionLabel: string,
  studentName: string,
  studentFolderId: string,
): Promise<CloneResults> {
  const links: Record<string, string> = {};
  const materials: ClonedMaterial[] = [];
  const errors: Record<string, string> = {};

  const { data: allTemplates } = await supabase
    .from("proep_materials")
    .select("*")
    .eq("is_template", true);
  const templates = (allTemplates ?? []).filter((t) => t.edition_id === editionId);

  // Campos legados: primeira planilha e primeiro formulário (compatibilidade
  // com os chips Planilha/Parapercepciograma e com o compartilhamento por
  // e-mail para professores).
  const legacySpreadsheet = templates.find((t) => t.file_type === "spreadsheet" && t.file_id);
  const legacyForm = templates.find((t) => t.file_type === "form" && t.file_id);

  for (const template of templates) {
    if (!template.file_id) continue;
    const fileType = template.file_type || "doc";
    const newName = cloneFileName(editionLabel, studentName, template.title);

    try {
      let driveUrl: string;
      if (fileType === "form") {
        const form = await duplicateForm(template.file_id, newName, studentFolderId);
        driveUrl = form.responderUri || driveFileUrl("form", form.formId);

        const { data: teachers } = await supabase
          .from("proep_students")
          .select("email")
          .eq("edition_id", editionId)
          .neq("role", "participant");
        const emails = [...new Set((teachers ?? []).map((t) => t.email).filter(Boolean))] as string[];
        for (const email of emails) {
          try { await shareWithEmail(form.formId, email, "writer"); } catch { /* um e-mail não aborta os demais */ }
        }

        if (legacyForm?.id === template.id) {
          links.parapercepciograma_url = `https://docs.google.com/forms/d/${form.formId}/edit`;
          links.form_responder_url = form.responderUri;
        }
      } else {
        const copy = await copyDriveFile(template.file_id, newName, studentFolderId);
        if (fileType === "spreadsheet") await setLinkSharing(copy.id, "writer");
        else await setLinkSharing(copy.id, "reader");
        driveUrl = driveFileUrl(fileType, copy.id);

        if (legacySpreadsheet?.id === template.id) {
          links.planilha_url = driveUrl;
        }
      }

      materials.push({ material_id: template.id, title: template.title, drive_url: driveUrl });
    } catch (e: any) {
      errors[template.title || template.id] = e.message;
    }
  }

  return { links, materials, errors };
}
