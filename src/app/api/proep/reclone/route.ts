// src/app/api/proep/reclone/route.ts
// Re-clona os templates de material para um aluno usando a pasta que já
// existe (ou criando uma se não houver). Útil quando um clone falhou ou foi
// apagado: gera novamente sem duplicar a estrutura de pastas.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDriveFolder } from "@/lib/google/drive";
import { ensureEditionFolder } from "@/lib/proep/drive-folders";
import { cloneTemplatesIntoFolder } from "@/lib/proep/clone-templates";
import { studentFolderName } from "@/lib/proep/naming";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FOLDER_URL_RE = /\/drive\/folders\/([^/?]+)/;

export async function POST(req: NextRequest) {
  try {
    const { student_id } = await req.json();
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

    const editionFolder = await ensureEditionFolder(student.edition_id);

    // Usa a pasta existente do aluno; cria só se não houver.
    let folderId: string | null = null;
    const match = student.drive_folder_url?.match(FOLDER_URL_RE);
    if (match) folderId = match[1];

    if (!folderId) {
      try {
        const folder = await createDriveFolder(
          studentFolderName(editionFolder.label, student.name),
          editionFolder.folder.id,
        );
        folderId = folder.id;
      } catch (e: any) {
        return NextResponse.json({ error: `Erro ao criar pasta do aluno: ${e.message}` }, { status: 500 });
      }
    }

    const { links, errors } = await cloneTemplatesIntoFolder(
      supabase,
      student.edition_id,
      editionFolder.label,
      student.name,
      folderId,
    );

    const updateFields: Record<string, string> = {
      drive_folder_url: `https://drive.google.com/drive/folders/${folderId}`,
    };
    if (links.planilha_url) updateFields.planilha_url = links.planilha_url;
    if (links.parapercepciograma_url) updateFields.parapercepciograma_url = links.parapercepciograma_url;
    if (links.form_responder_url) updateFields.form_responder_url = links.form_responder_url;

    await supabase.from("proep_students").update({ ...updateFields, updated_at: new Date().toISOString() }).eq("id", student_id);

    return NextResponse.json({
      ok: true,
      student_id,
      links: updateFields,
      errors,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 });
  }
}
