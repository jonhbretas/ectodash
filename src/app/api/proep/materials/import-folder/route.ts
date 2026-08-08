// src/app/api/proep/materials/import-folder/route.ts
// Importa todos os arquivos de uma pasta do Google Drive como materiais
// (is_template=true). A pasta deve estar acessível à conta da automação
// (ectolab@ectolab.org).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listFolderFiles } from "@/lib/google/drive";

const FOLDER_URL_RE = /\/drive\/folders\/([^/?]+)/;
const FOLDER_ID_RE = /^[A-Za-z0-9_-]{10,}$/;

function fileTypeFromMime(mimeType: string): string | null {
  const map: Record<string, string> = {
    "application/vnd.google-apps.spreadsheet": "spreadsheet",
    "application/vnd.google-apps.form": "form",
    "application/vnd.google-apps.document": "doc",
    "application/pdf": "pdf",
    "application/vnd.google-apps.folder": "folder",
  };
  return map[mimeType] ?? "doc";
}

export async function POST(req: NextRequest) {
  try {
    const { edition_id, category, folder_url } = await req.json();
    if (!folder_url) return NextResponse.json({ error: "Informe o link da pasta do Drive" }, { status: 400 });

    const match = folder_url.match(FOLDER_URL_RE);
    const folderId = match ? match[1] : folder_url.trim();
    if (!FOLDER_ID_RE.test(folderId)) {
      return NextResponse.json({ error: "Link de pasta inválido. Use o link de uma pasta do Google Drive (…/drive/folders/…)" }, { status: 400 });
    }

    let files;
    try {
      files = await listFolderFiles(folderId);
    } catch (e: any) {
      return NextResponse.json({ error: `Não foi possível acessar a pasta (a conta ectolab precisa de acesso): ${e.message}` }, { status: 500 });
    }

    const fileItems = files.filter((f) => f.mimeType !== "application/vnd.google-apps.folder");

    if (fileItems.length === 0) {
      return NextResponse.json({ error: "A pasta está vazia (ou só tem subpastas)" }, { status: 404 });
    }

    const supabase = await createClient();
    const created: Array<Record<string, unknown>> = [];
    for (const file of fileItems) {
      const fileType = fileTypeFromMime(file.mimeType);
      const { data, error } = await supabase
        .from("proep_materials")
        .insert({
          edition_id: edition_id || null,
          category: category || "student",
          title: file.name,
          url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
          file_id: file.id,
          file_type: fileType,
          is_template: true,
          sort_order: created.length,
        })
        .select()
        .single();
      if (error) {
        return NextResponse.json({ error: `Erro ao salvar "${file.name}": ${error.message}` }, { status: 500 });
      }
      created.push(data);
    }

    return NextResponse.json({ ok: true, imported: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 });
  }
}
