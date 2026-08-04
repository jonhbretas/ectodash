// src/lib/meetings/index.ts
// Tactiq transcript bridge — the server-side equivalent of the Tactiq MCP
// connector: the MCP server is a thin wrapper over Tactiq's own REST API,
// and MCP is a local dev-tool protocol that cannot run inside the Vercel
// serverless runtime. Calling api.tactiq.io directly from a Server Action
// gives the deployed app the same capability ("pick a recorded meeting,
// extract demandas from its transcript") with no local infrastructure.
//
// Tactiq is the ONLY meeting provider (user decision, 2026-08-04) — no
// Fireflies/tl;dv adapters are kept.
//
// Every failure (missing key, API error, unknown meeting) surfaces as a
// clear, user-facing message — never a silent empty list.
import {
  listarReunioesTactiq,
  obterTranscricaoTactiq,
} from "./tactiq";

export type Meeting = {
  id: string;
  titulo: string;
  // ISO date (yyyy-MM-dd or full timestamp) — formatted at render time
  data: string;
};

export type MeetingsResult = {
  meetings: Meeting[];
  // Friendly error to show instead of the list (missing config, API
  // failure); null when the provider is not configured at all.
  error: string | null;
  configured: boolean;
};

export type TranscriptResult = {
  texto: string;
  titulo: string;
};

export async function listarReunioes(): Promise<MeetingsResult> {
  if (!process.env.TACTIQ_API_KEY) {
    return { meetings: [], error: null, configured: false };
  }

  try {
    const meetings = await listarReunioesTactiq();
    return { meetings, error: null, configured: true };
  } catch (err) {
    console.error("listarReunioes: Tactiq call failed", err);
    return {
      meetings: [],
      error:
        "Não foi possível buscar as reuniões gravadas agora. Verifique a chave de API do Tactiq e tente novamente.",
      configured: true,
    };
  }
}

export async function obterTranscricao(id: string): Promise<TranscriptResult> {
  if (!process.env.TACTIQ_API_KEY) {
    throw new Error("TACTIQ_API_KEY não configurada no servidor");
  }
  return obterTranscricaoTactiq(id);
}
