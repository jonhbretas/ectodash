import { createClient } from "@/lib/supabase/server";
import { fetchDrivePreview } from "@/lib/google/drive-preview";

export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
    return new Response("Pauta inválida.", { status: 400, headers: privateHeaders });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Entre para visualizar o anexo.", { status: 401, headers: privateHeaders });

  // O arquivo é resolvido pela pauta e pela RLS da sessão; nunca por um ID
  // arbitrário fornecido pelo navegador. Nenhuma credencial chega ao cliente.
  const { data: pauta, error } = await supabase.from("pautas").select("anexo_drive_id").eq("id", Number(id)).maybeSingle();
  if (error) return new Response("Não foi possível consultar o anexo.", { status: 503, headers: privateHeaders });
  if (!pauta?.anexo_drive_id) return new Response("Anexo não encontrado.", { status: 404, headers: privateHeaders });

  try {
    const preview = await fetchDrivePreview(pauta.anexo_drive_id);
    return new Response(preview.body, { headers: { ...privateHeaders, "Content-Type": preview.headers.get("content-type")! } });
  } catch {
    return new Response("Prévia indisponível. Abra o arquivo no Drive.", { status: 502, headers: privateHeaders });
  }
}
