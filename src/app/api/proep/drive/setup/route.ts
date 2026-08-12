// src/app/api/proep/drive/setup/route.ts
// Estrutura de pastas do PROEP no Google Drive.
//   GET  /api/proep/drive/setup                 → status atual (sem criar nada)
//   POST /api/proep/drive/setup                 → garante a pasta central
//   POST /api/proep/drive/setup {edition_id}    → garante central + pasta da turma
// Retorna links para abertura fácil no Drive.
// Auditoria 0063: gate de acesso PROEP (POST cria pastas no Drive
// institucional) + erros genéricos no response.
import { NextRequest, NextResponse } from "next/server";
import { requireProep } from "@/lib/role-gates";
import { ensureCentralFolder, getCentralFolder, ensureEditionFolder, getEditionFolder } from "@/lib/proep/drive-folders";

export async function GET() {
  let gate;
  try {
    gate = await requireProep();
  } catch {
    return NextResponse.json({ error: "Sem acesso ao módulo PROEP." }, { status: 403 });
  }
  const central = await getCentralFolder();
  return NextResponse.json({ central_folder_url: central?.url ?? null });
}

export async function POST(req: NextRequest) {
  try {
    let gate;
    try {
      gate = await requireProep();
    } catch {
      return NextResponse.json({ error: "Sem acesso ao módulo PROEP." }, { status: 403 });
    }

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
  } catch (e) {
    console.error("[proep drive/setup POST]", e);
    return NextResponse.json({ error: "Erro ao preparar as pastas." }, { status: 500 });
  }
}
