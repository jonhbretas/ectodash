// src/lib/meetings/tactiq.ts
// Tactiq provider — REST API (api.tactiq.io/v2), Bearer token auth via
// TACTIQ_API_KEY. Query shapes follow Tactiq's public API docs; parsing is
// defensive (unknown/renamed fields degrade to an error message, never a
// crash). SERVER-ONLY: imported only from src/lib/meetings and the extrair
// Server Action.
import type { Meeting } from "./index";

const API_URL = "https://api.tactiq.io/v2";

function apiKey(): string {
  const key = process.env.TACTIQ_API_KEY;
  if (!key) {
    throw new Error("TACTIQ_API_KEY não configurada no servidor");
  }
  return key;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Tactiq API retornou status ${response.status}`);
  }
  return (await response.json()) as T;
}

type TactiqMeeting = {
  id: string;
  title?: string | null;
  started_at?: string | null;
};

type TactiqSegment = {
  text?: string | null;
  speaker_id?: string | null;
};

export async function listarReunioesTactiq(): Promise<Meeting[]> {
  const data = await getJson<{ items?: TactiqMeeting[] | null }>(
    "/transcripts?page=1&page_size=20"
  );

  return (data.items ?? []).map((meeting) => ({
    id: meeting.id,
    titulo: meeting.title?.trim() || "Reunião sem título",
    data: meeting.started_at ?? "",
  }));
}

export async function obterTranscricaoTactiq(id: string): Promise<{
  texto: string;
  titulo: string;
}> {
  const data = await getJson<{
    title?: string | null;
    started_at?: string | null;
    transcript?: TactiqSegment[] | null;
    summary?: { short?: string | null } | null;
  }>(`/transcripts/${encodeURIComponent(id)}`);

  // Prefer the segment transcript; fall back to the provider's own short
  // summary when segments are absent (some Tactiq plans store summaries
  // without full transcripts).
  const segments = data.transcript ?? [];
  const texto = segments
    .map((segment) => segment.text?.trim())
    .filter(Boolean)
    .join("\n");

  const finalTexto = texto || data.summary?.short?.trim() || "";

  if (!finalTexto) {
    throw new Error("Essa reunião não tem transcrição disponível no Tactiq.");
  }

  return { texto: finalTexto, titulo: data.title?.trim() || "Reunião sem título" };
}
