// src/app/api/proep/google/connect/route.ts
// Initiates Google OAuth flow for Drive + Forms access.
import { NextResponse } from "next/server";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/forms",
].join(" ");

export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  if (!clientId) {
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID não configurado." }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${base}/api/proep/google/callback`,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
