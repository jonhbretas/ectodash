// src/app/api/proep/google/connect/route.ts
// Inicia o fluxo OAuth do Google (Drive + Forms).
// Auditoria 0063: o fluxo agora exige sessão de coordenador_geral e usa
// parâmetro `state` (CSRF) persistido em cookie httpOnly — um terceiro não
// consegue iniciar o fluxo nem sequestrar o callback de outro usuário.
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireCoordenadorGeral } from "@/lib/role-gates";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/forms",
].join(" ");

export async function GET(req: NextRequest) {
  try {
    await requireCoordenadorGeral();
  } catch {
    return NextResponse.json(
      { error: "Somente o coordenador geral pode conectar o Google." },
      { status: 403 }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID não configurado." },
      { status: 500 }
    );
  }

  const state = randomBytes(24).toString("hex");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${base}/api/proep/google/callback`,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
  response.cookies.set("proep_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return response;
}
