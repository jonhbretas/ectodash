// src/app/api/proep/provision/route.ts
// Automates Google Drive/Forms creation for a student:
// 1. Create folder in Drive
// 2. Clone spreadsheet template
// 3. Duplicate Google Form (Parapercepciograma)
// 4. Save links to database
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { copyDriveFile, setLinkSharing, createDriveFolder } from "@/lib/google/drive";
import { duplicateForm } from "@/lib/google/forms";

export async function POST(req: NextRequest) {
  try {
    const { student_id, edition_id } = await req.json();
    if (!student_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(student_id)) {
      return NextResponse.json({ error: "student_id deve ser um UUID válido" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: student, error: studentError } = await supabase
      .from("proep_students")
      .select("*")
      .eq("id", student_id)
      .single();

    if (studentError || !student) return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });

    const { data: templates } = await supabase
      .from("proep_materials")
      .select("*")
      .eq("is_template", true)
      .eq("edition_id", edition_id || student.edition_id);

    const results: Record<string, string> = {};

    // 1. Create folder
    try {
      const folder = await createDriveFolder(`PROEP - ${student.name}`);
      results.drive_folder_url = `https://drive.google.com/drive/folders/${folder.id}`;
    } catch (e: any) { results.drive_folder_error = e.message; }

    // 2. Clone spreadsheet
    const spreadsheetTemplate = templates?.find(t => t.file_type === "spreadsheet" && t.file_id);
    if (spreadsheetTemplate?.file_id) {
      try {
        const copy = await copyDriveFile(spreadsheetTemplate.file_id, `Planilha - ${student.name}`);
        await setLinkSharing(copy.id, "writer");
        results.planilha_url = `https://docs.google.com/spreadsheets/d/${copy.id}/edit`;
      } catch (e: any) { results.planilha_error = e.message; }
    }

    // 3. Duplicate form
    const formTemplate = templates?.find(t => t.file_type === "form" && t.file_id);
    if (formTemplate?.file_id) {
      try {
        const form = await duplicateForm(formTemplate.file_id, `Parapercepciograma - ${student.name}`);
        results.parapercepciograma_url = `https://docs.google.com/forms/d/${form.formId}/edit`;
        results.form_responder_url = form.responderUri;
      } catch (e: any) { results.form_error = e.message; }
    }

    // 4. Save links
    const updateFields: Record<string, string> = {};
    if (results.drive_folder_url) updateFields.drive_folder_url = results.drive_folder_url;
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
      errors: Object.fromEntries(Object.entries(results).filter(([k]) => k.endsWith("_error"))),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 });
  }
}
