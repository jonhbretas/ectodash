// src/app/api/contratos/[id]/pdf/route.ts
// Download do PDF de um contrato — renderizado sob demanda com pdfkit
// (mesmo padrão de /api/atas/[id]/pdf). A sessão + RLS protegem a leitura:
// fora da sessão → 401; usuário sem permissão sobre o contrato → 404.
import { createClient } from "@/lib/supabase/server";
import { carregarContrato, renderizarContratoPdf } from "@/lib/contratos/render";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  if (!Number.isFinite(id)) {
    return new Response("Contrato não encontrado", { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Não autenticado", { status: 401 });
  }

  let completo;
  try {
    completo = await carregarContrato(supabase, id);
  } catch {
    return new Response("Contrato não encontrado", { status: 404 });
  }

  const { buffer, filename } = await renderizarContratoPdf(completo);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
