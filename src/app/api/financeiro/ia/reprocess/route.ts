import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFinanceiro } from "@/lib/role-gates";
import { getGoogleAccessToken } from "@/lib/google/oauth";
import { POST as importFiles } from "../../import/route";

export const maxDuration = 180;
export async function POST(request: Request) {
  let ctx;
  try { ctx = await requireFinanceiro(); } catch { return NextResponse.json({ error: "Sem acesso ao financeiro." }, { status: 403 }); }
  const body = z.object({ importId: z.uuid() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  const { data: source, error } = await ctx.supabase.from("finance_imports").select("id,file_name,file_sha256,mime_type,file_size,storage_path,metadata").eq("id", body.data.importId).single();
  if (error || !source?.storage_path) return NextResponse.json({ error: "Arquivo de origem não encontrado." }, { status: 404 });
  if (Number(source.file_size) > 3 * 1024 * 1024) return NextResponse.json({ error: "Divida este arquivo em documentos de até 3 MB antes de usar a IA." }, { status: 400 });
  try {
    const token = await getGoogleAccessToken();
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(source.storage_path)}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível recuperar o arquivo original do Drive.");
    if (Number(response.headers.get("content-length") ?? 0) > 3 * 1024 * 1024) throw new Error("O original excede o limite de 3 MB.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 3 * 1024 * 1024 || createHash("sha256").update(bytes).digest("hex") !== source.file_sha256) throw new Error("O arquivo original foi alterado. Envie a nova versão para conferência.");
    const form = new FormData(); form.set("files", new File([bytes], source.file_name, { type: source.mime_type }));
    form.set("mode", "ia"); form.set("reprocessId", source.id); form.set("competencia", source.metadata.competencia); form.set("categoria", source.metadata.categoria || "outros");
    return importFiles(new Request("http://internal/financeiro/import", { method: "POST", body: form }));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao recuperar o documento." }, { status: 503 }); }
}
