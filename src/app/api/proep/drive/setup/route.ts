// src/app/api/proep/drive/setup/route.ts
// Estrutura de pastas do PROEP no Google Drive.
//   GET  /api/proep/drive/setup                 → status atual (sem criar nada)
//   POST /api/proep/drive/setup                 → garante a pasta central
//   POST /api/proep/drive/setup {edition_id}    → garante central + pasta da turma
// Retorna links para abertura fácil no Drive.
import { NextRequest, NextResponse } from "next/server";
import { ensureCentralFolder, getCentralFolder, ensureEditionFolder, getEditionFolder } from "@/lib/proep/drive-folders";

export async function GET() {
  const central = await getCentralFolder();
  return NextResponse.json({ central_folder_url: central?.url ?? null });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const editionId = body.edition_id ? Number(body.edition_id) : null;

    const central = await ensureCentralFolder();
    if (!editionId || isNaN(editionId)) {
      return NextResponse.json({ ok: true, central_folder_url: central.url });
    }

    const edition = await ensureEditionFolder(editionId);
    return NextResponse.json({
      ok: true,
      central_folder_url: central.url,
      edition_folder_url: edition.folder.url,
      edition_label: edition.label,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro ao preparar pastas" }, { status: 500 });
  }
}
