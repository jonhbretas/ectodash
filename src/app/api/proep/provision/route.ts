// src/app/api/proep/provision/route.ts
// Automates Google Drive/Forms creation for a student:
// 1. Ensure central PROEP folder + edition (turma) folder exist
// 2. Create the student's folder INSIDE the edition folder
// 3. Clone templates (spreadsheet/form) INTO the student folder
// 4. Save links to database
// Auditoria 0063: gate de acesso PROEP + erros genéricos no response.
import { NextRequest, NextResponse } from "next/server";
import { requireProep } from "@/lib/role-gates";
import { createDriveFolder } from "@/lib/google/drive";
import { ensureEditionFolder } from "@/lib/proep/drive-folders";
import { cloneTemplatesIntoFolder } from "@/lib/proep/clone-templates";
import { studentFolderName } from "@/lib/proep/naming";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    let gate;
    try {
      gate = await requireProep();
    } catch {
      return NextResponse.json({ error: "Sem acesso ao módulo PROEP." }, { status: 403 });
    }
    const supabase = gate.supabase;

    const { student_id, edition_id } = await req.json();
    if (!student_id || !UUID_RE.test(student_id)) {
      return NextResponse.json({ error: "student_id deve ser um UUID válido" }, { status: 400 });
    }

    const { data: student, error: studentError } = await supabase
      .from("proep_students")
      .select("*")
      .eq("id", student_id)
      .single();

    if (studentError || !student) return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });

    const targetEdition = Number(edition_id) || student.edition_id;

    // 0. Garante pasta central + pasta da turma
    let editionFolder;
    try {
      editionFolder = await ensureEditionFolder(targetEdition);
    } catch (e) {
      console.error("[proep provision] ensureEditionFolder", e);
      return NextResponse.json({ error: "Não foi possível preparar a pasta da turma." }, { status: 500 });
    }

    // 1. Pasta do aluno DENTRO da pasta da turma
    const studentFolderTitle = studentFolderName(editionFolder.label, student.name);
    let studentFolder;
    try {
      studentFolder = await createDriveFolder(studentFolderTitle, editionFolder.folder.id);
    } catch (e) {
      console.error("[proep provision] createDriveFolder", e);
      return NextResponse.json({ error: "Erro ao criar pasta do aluno." }, { status: 500 });
    }

    // 2. Clona os templates na pasta do aluno (compartilhamento restrito ao
    //    e-mail do aluno — nunca "qualquer pessoa com link", auditoria 0063)
    const { links, materials, errors } = await cloneTemplatesIntoFolder(
      supabase,
      targetEdition,
      editionFolder.label,
      student.name,
      studentFolder.id,
      typeof student.email === "string" ? student.email : null,
    );

    // 2b. Registra cada material clonado (link individual por template)
    if (materials.length > 0) {
      await supabase.from("proep_student_materials").insert(
        materials.map((m) => ({ student_id: student_id, material_id: m.material_id, drive_url: m.drive_url })),
      );
    }

    // 3. Save links
    const updateFields: Record<string, string> = {
      drive_folder_url: `https://drive.google.com/drive/folders/${studentFolder.id}`,
    };
    if (links.planilha_url) updateFields.planilha_url = links.planilha_url;
    if (links.parapercepciograma_url) updateFields.parapercepciograma_url = links.parapercepciograma_url;
    if (links.form_responder_url) updateFields.form_responder_url = links.form_responder_url;

    const { error: updateError } = await supabase
      .from("proep_students")
      .update({ ...updateFields, updated_at: new Date().toISOString() })
      .eq("id", student_id);

    if (updateError) {
      console.error("[proep provision] update student", updateError.message);
      return NextResponse.json({ error: "Não foi possível salvar os links do aluno." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      student_id,
      links: updateFields,
      errors,
    });
  } catch (e: any) {
    console.error("[proep provision]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
