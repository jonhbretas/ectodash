// src/lib/google/oauth.ts
// Google OAuth2 helper for Drive + Forms API access.
// Uses refresh token stored in env vars (single-user flow).

const TOKEN_URL = "https://oauth2.googleapis.com/token";

function clientId() { return process.env.GOOGLE_CLIENT_ID?.trim() || ""; }
function clientSecret() { return process.env.GOOGLE_CLIENT_SECRET?.trim() || ""; }

export async function getGoogleAccessToken(): Promise<string> {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim() || "";
  if (!refreshToken) throw new Error("Google Drive não conectado. Configure GOOGLE_REFRESH_TOKEN.");
  if (!clientId() || !clientSecret()) throw new Error("Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = await response.json();
  if (!response.ok || !json.access_token) throw new Error("Não foi possível renovar o acesso ao Google.");
  return json.access_token as string;
}

export async function googleApiRequest(path: string, init: RequestInit = {}) {
  const token = await getGoogleAccessToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error?.message || "Erro na API do Google.");
  return json;
}
