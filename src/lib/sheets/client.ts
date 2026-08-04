// src/lib/sheets/client.ts
// Google Sheets service-account auth factory — the server-side credential
// bridge for Phase 9's cron sync (09-RESEARCH.md Architecture Item 2).
//
// Deliberately mirrors src/lib/supabase/admin.ts's factory shape: built
// only inside src/app/api/cron/ (the one trusted, non-user-triggered entry
// point this project has), never imported from src/app/(dashboard)/ or
// src/app/(auth)/.
//
// Credential storage: the service-account JSON key is downloaded once by a
// human, base64-encoded as a single line, and stored as the server-only
// GOOGLE_SERVICE_ACCOUNT_JSON env var (Vercel Production + .env.local).
// base64 wrapping sidesteps Vercel's known unreliability with literal
// newlines pasted into plain-text env fields (09-RESEARCH.md's verified
// finding) — the private key inside the JSON is a multi-line PEM string.
// The env var name holds the ENCODED payload; the decoded value is a JSON
// string, never a file on disk (serverless has no persistent FS anyway).
import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";

type ServiceAccountCreds = { client_email: string; private_key: string };

// Decoded once per client creation — JSON.parse of a base64-decoded
// payload; any malformed/undecodable value throws immediately with an
// actionable message (a failed parse must surface as a failed sync run,
// never as a silent empty ingest).
function credentials(): ServiceAccountCreds {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
  const raw = Buffer.from(encoded, "base64").toString("utf-8");
  const parsed = JSON.parse(raw) as {
    client_email?: string;
    private_key?: string;
  };
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON não contém client_email/private_key válidos"
    );
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

export function createSheetsClient() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error(
      "Falta variável de ambiente: GOOGLE_SERVICE_ACCOUNT_JSON (service account base64)"
    );
  }

  const { client_email, private_key } = credentials();

  // The JWT client lazily exchanges credentials for a token on the first
  // actual request — constructing it never hits the network.
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return {
    client: google.sheets({ version: "v4", auth }) as sheets_v4.Sheets,
  };
}
