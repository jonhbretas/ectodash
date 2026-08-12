// src/app/api/proep/materials/import-folder/route.ts
// Importa arquivos de uma pasta do Google Drive como materiais.
// GET  ?folder_url=... → lista os arquivos da pasta (sem gravar)
// POST { edition_id, category, items } → cria os materiais escolhidos
// A pasta deve estar acessível à conta da automação (ectolab@ectolab.org).
// Auditoria 0063: gate de acesso PROEP + erros genéricos no response.
import { NextRequest, NextResponse } from "next/server";
import { requireProep } from "@/lib/role-gates";
import { listFolderFiles, getFileMeta } from "@/lib/google/drive";

const FOLDER_URL_RE = /\/drive\/folders\/([^/?]+)/;
const FOLDER_ID_RE = /^[A-Za-z0-9_-]{10,}$/;

function fileTypeFromMime(mimeType: string): string | null {
  const map: Record<string, string> = {
    "application/vnd.google-apps.spreadsheet": "spreadsheet",
    "application/vnd.google-apps.form": "form",
    "application/vnd.google-apps.document": "doc",
    "application/vnd.google-apps.presentation": "slides",
    "application/pdf": "pdf",
    "application/vnd.google-apps.folder": "folder",
  };
  return map[mimeType] ?? "doc";
}

function folderIdFromInput(folderUrl: string): string | null {
  const match = folderUrl.match(FOLDER_URL_RE);
  const id = match ? match[1] : folderUrl.trim();
  return FOLDER_ID_RE.test(id) ? id : null;
}

export type ListedFile = {
  id: string;
  name: string;
  mimeType: string;
  fileType: string;
  webViewLink?: string;
};

async function guard() {
  try {
    const ctx = await requireProep();
    return ctx;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const gate = await guard();
    if (!gate) return NextResponse.json({ error: "Sem acesso ao módulo PROEP." }, { status: 403 });

    const folderUrl = req.nextUrl.searchParams.get("folder_url") || "";
    const folderId = folderIdFromInput(folderUrl);
    if (!folderId) {
      return NextResponse.json({ error: "Link de pasta inválido. Use o link de uma pasta do Google Drive (…/drive/folders/…)" }, { status: 400 });
    }

    // Confirma que a conta da automação enxerga a pasta (404 = sem acesso)
    try {
      await getFileMeta(folderId);
    } catch {
      return NextResponse.json({ error: "A conta ectolab@ectolab.org não tem acesso a esta pasta. Compartilhe a pasta com ectolab@ectolab.org (Editor) e tente de novo." }, { status: 403 });
    }

    let files;
    try {
      files = await listFolderFiles(folderId);
    } catch (e) {
      console.error("[proep import-folder GET] listFolderFiles", e);
      return NextResponse.json({ error: "Não foi possível acessar a pasta." }, { status: 500 });
    }

    const fileItems: ListedFile[] = files
      .filter((f) => f.mimeType !== "application/vnd.google-apps.folder")
      .map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        fileType: fileTypeFromMime(f.mimeType) ?? "doc",
        webViewLink: f.webViewLink,
      }));

    if (fileItems.length === 0) {
      return NextResponse.json({ error: "A pasta está vazia (ou só tem subpastas)" }, { status: 404 });
    }
    return NextResponse.json({ files: fileItems });
  } catch (e) {
    console.error("[proep import-folder GET]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await guard();
    if (!gate) return NextResponse.json({ error: "Sem acesso ao módulo PROEP." }, { status: 403 });
    const supabase = gate.supabase;

    const { category, items } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Nenhum arquivo selecionado" }, { status: 400 });
    }

    const created: Array<Record<string, unknown>> = [];
    let sortOrder = 0;
    for (const item of items) {
      const fileId = String(item.file_id || "").trim();
      const title = String(item.name || "").trim();
      if (!fileId || !title) continue;
      const { data, error } = await supabase
        .from("proep_materials")
        .insert({
          edition_id: null,
          category: category || "student",
          title,
          url: item.url || `https://drive.google.com/file/d/${fileId}/view`,
          file_id: fileId,
          file_type: item.file_type || "doc",
          is_template: Boolean(item.is_template),
          sort_order: sortOrder++,
        })
        .select()
        .single();
      if (error) {
        console.error("[proep import-folder POST]", error.message);
        return NextResponse.json({ error: `Erro ao salvar "${title}".` }, { status: 500 });
      }
      created.push(data);
    }

    if (created.length === 0) {
      return NextResponse.json({ error: "Nenhum arquivo válido para importar" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, imported: created }, { status: 201 });
  } catch (e: any) {
    console.error("[proep import-folder POST]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
