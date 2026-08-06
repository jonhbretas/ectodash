// src/app/api/proep/provision/route.ts
// Automates Google Drive/Forms creation for a student:
// 1. Ensure central PROEP folder + edition (turma) folder exist
// 2. Create the student's folder INSIDE the edition folder
// 3. Clone spreadsheet template INTO the student folder
// 4. Duplicate Google Form INTO the student folder
//    - Spreadsheet: anyone with link can edit (as before)
//    - Form: NO public edit — teachers (roles M1/M2/P1/P2) get edit by email;
//      students can only respond via the responder link
// 5. Save links to database
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { copyDriveFile, setLinkSharing, createDriveFolder, shareWithEmail } from "@/lib/google/drive";
import { duplicateForm } from "@/lib/google/forms";
import { ensureEditionFolder } from "@/lib/proep/drive-folders";
import { studentFolderName, studentSpreadsheetName, studentFormName } from "@/lib/proep/naming";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const { student_id, edition_id } = await req.json();
    if (!student_id || !UUID_RE.test(student_id)) {
      return NextResponse.json({ error: "student_id deve ser um UUID válido" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: student, error: studentError } = await supabase
      .from("proep_students")
      .select("*")
      .eq("id", student_id)
      .single();

    if (studentError || !student) return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });

    const targetEdition = Number(edition_id) || student.edition_id;

    // 0. Garante pasta central + pasta da turma (PROEP AGO 26)
    let editionFolder;
    try {
      editionFolder = await ensureEditionFolder(targetEdition);
    } catch (e: any) {
      return NextResponse.json({ error: `Não foi possível preparar a pasta da turma: ${e.message}` }, { status: 500 });
    }

    // 1. Pasta do aluno DENTRO da pasta da turma
    const studentFolderTitle = studentFolderName(editionFolder.label, student.name);
    let studentFolder;
    try {
      studentFolder = await createDriveFolder(studentFolderTitle, editionFolder.folder.id);
    } catch (e: any) {
      return NextResponse.json({ error: `Erro ao criar pasta do aluno: ${e.message}` }, { status: 500 });
    }

    const results: Record<string, string> = {};
    const { data: allTemplates } = await supabase
      .from("proep_materials")
      .select("*")
      .eq("is_template", true);
    const templates = (allTemplates ?? []).filter((t) => t.edition_id === targetEdition);

    // 2. Clone spreadsheet INTO the student folder (link = editor)
    const spreadsheetTemplate = templates?.find(t => t.file_type === "spreadsheet" && t.file_id);
    if (spreadsheetTemplate?.file_id) {
      try {
        const copy = await copyDriveFile(
          spreadsheetTemplate.file_id,
          studentSpreadsheetName(editionFolder.label, student.name),
          studentFolder.id,
        );
        await setLinkSharing(copy.id, "writer");
        results.planilha_url = `https://docs.google.com/spreadsheets/d/${copy.id}/edit`;
      } catch (e: any) { results.planilha_error = e.message; }
    }

    // 3. Duplicate form INTO the student folder.
    //    Sem permissão pública: professores (M1/M2/P1/P2) ganham edição por
    //    e-mail; alunos apenas respondem pelo link do formulário.
    const formTemplate = templates?.find(t => t.file_type === "form" && t.file_id);
    if (formTemplate?.file_id) {
      try {
        const form = await duplicateForm(
          formTemplate.file_id,
          studentFormName(editionFolder.label, student.name),
          studentFolder.id,
        );
        results.parapercepciograma_url = `https://docs.google.com/forms/d/${form.formId}/edit`;
        results.form_responder_url = form.responderUri;

        const { data: teachers } = await supabase
          .from("proep_students")
          .select("email")
          .eq("edition_id", targetEdition)
          .neq("role", "participant");
        const emails = [...new Set((teachers ?? []).map((t) => t.email).filter(Boolean))] as string[];
        for (const email of emails) {
          try {
            await shareWithEmail(form.formId, email, "writer");
          } catch (e: any) { /* falha em um e-mail não aborta os demais */ }
        }
      } catch (e: any) { results.form_error = e.message; }
    }

    // 4. Save links
    const updateFields: Record<string, string> = {};
    updateFields.drive_folder_url = `https://drive.google.com/drive/folders/${studentFolder.id}`;
    if (results.planilha_url) updateFields.planilha_url = results.planilha_url;
    if (results.parapercepciograma_url) updateFields.parapercepciograma_url = results.parapercepciograma_url;
    if (results.form_responder_url) updateFields.form_responder_url = results.form_responder_url;

    if (Object.keys(updateFields).length > 0) {
      await supabase.from("proep_students").update({ ...updateFields, updated_at: new Date().toISOString() }).eq("id", student_id);
    }

    return NextResponse.json({
      ok: true,
      student_id,
      links: updateFields,
      edition_folder_url: editionFolder.folder.url,
      errors: Object.fromEntries(Object.entries(results).filter(([k]) => k.endsWith("_error"))),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 });
  }
}
