// src/lib/assinafy.ts
// Cliente da API da Assinafy (api.assinafy.com.br/v1/docs) — assinatura
// eletrônica com validade jurídica (ICP-Brasil). Autenticação por X-Api-Key.
// Envelope de resposta: { status, message, data }.
//
// Env vars:
//   ASSINAFY_API_KEY        → chave de API (Painel Assinafy → API)
//   ASSINAFY_ACCOUNT_ID     → id do workspace/account (path param dos endpoints)
//   ASSINAFY_API_URL        → opcional; default https://api.assinafy.com.br
//                             (use https://sandbox.assinafy.com.br para testes)
//   ASSINAFY_NOTIFICATION_EMAIL → e-mail para avisos de webhook (opcional)

const ASSINAFY_BASE = process.env.ASSINAFY_API_URL?.trim() || "https://api.assinafy.com.br";

function apiKey(): string {
  return process.env.ASSINAFY_API_KEY?.trim() || "";
}

function accountId(): string {
  return process.env.ASSINAFY_ACCOUNT_ID?.trim() || "";
}

function notificationEmail(): string {
  return process.env.ASSINAFY_NOTIFICATION_EMAIL?.trim() || "";
}

function assertConfigurada() {
  if (!apiKey() || !accountId()) {
    throw new Error(
      "Assinafy não configurada. Defina ASSINAFY_API_KEY e ASSINAFY_ACCOUNT_ID no ambiente."
    );
  }
}

async function assinafyRequest(path: string, init: RequestInit = {}) {
  assertConfigurada();
  const response = await fetch(`${ASSINAFY_BASE}${path}`, {
    ...init,
    headers: {
      "X-Api-Key": apiKey(),
      ...(init.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      json?.message || json?.error || `Erro na API da Assinafy (HTTP ${response.status}).`;
    throw new Error(message);
  }
  return json as { status?: number; message?: string | null; data?: unknown };
}

export const ASSINAFY_WEBHOOK_EVENTS = [
  "signer_signed_document",
  "document_ready",
  "signer_rejected_document",
  "document_processing_failed",
] as const;

export type AssinafyDocument = {
  resource: "document";
  id: string;
  name: string;
  status: string;
  signing_url?: string;
  artifacts?: Record<string, string>;
};

/** Upload de um PDF como documento da conta. */
export async function assinafyUploadDocumento(buffer: Buffer, nome: string): Promise<AssinafyDocument> {
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), nome);
  const envelope = await assinafyRequest(`/v1/accounts/${accountId()}/documents`, {
    method: "POST",
    body: fd,
  });
  return envelope.data as AssinafyDocument;
}

export type AssinafySigner = {
  resource: "signer";
  id: string;
  full_name: string;
  email: string | null;
};

/** Cria um signatário no workspace (required: full_name). */
export async function assinafyCriarSignatario(
  fullName: string,
  email?: string | null,
  whatsappPhoneNumber?: string | null
): Promise<AssinafySigner> {
  const body: Record<string, unknown> = { full_name: fullName };
  if (email && email.trim()) body.email = email.trim();
  if (whatsappPhoneNumber && whatsappPhoneNumber.trim()) {
    body.whatsapp_phone_number = whatsappPhoneNumber.trim();
  }
  const envelope = await assinafyRequest(`/v1/accounts/${accountId()}/signers`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  return envelope.data as AssinafySigner;
}

export type AssinafyAssignment = {
  resource: "assignment";
  id: string;
  method: string;
  signing_urls?: Array<{ signer_id: string; url: string }>;
};

/** Cria a rodada de assinaturas (method "virtual" — sem campos no PDF). */
export async function assinafyCriarAssignment(
  documentId: string,
  signerIds: string[],
  message?: string
): Promise<AssinafyAssignment> {
  const body: Record<string, unknown> = {
    method: "virtual",
    signers: signerIds.map((id) => ({ id })),
  };
  if (message && message.trim()) body.message = message.trim();
  const envelope = await assinafyRequest(`/v1/documents/${documentId}/assignments`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  return envelope.data as AssinafyAssignment;
}

/** Baixa o artefato do documento (original | certificated | certificate-page | bundle). */
export async function assinafyBaixarDocumento(
  documentId: string,
  artifactName: "original" | "certificated" | "certificate-page" | "bundle" = "certificated"
): Promise<Buffer> {
  assertConfigurada();
  const response = await fetch(
    `${ASSINAFY_BASE}/v1/documents/${documentId}/download/${artifactName}`,
    { headers: { "X-Api-Key": apiKey() } }
  );
  if (!response.ok) {
    throw new Error(`Falha ao baixar o documento assinado (HTTP ${response.status}).`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/** Assina a subscription de webhook do workspace com os eventos de contrato. */
export async function assinafyConfigurarWebhook(
  url: string,
  email: string
): Promise<{ events: string[]; is_active: boolean; url: string }> {
  const envelope = await assinafyRequest(`/v1/accounts/${accountId()}/webhooks/subscriptions`, {
    method: "PUT",
    body: JSON.stringify({
      events: [...ASSINAFY_WEBHOOK_EVENTS],
      is_active: true,
      url,
      email,
    }),
    headers: { "Content-Type": "application/json" },
  });
  return envelope.data as { events: string[]; is_active: boolean; url: string };
}

/** Cria (ou atualiza) a subscription de webhook apontando para este sistema. */
export async function assinafyGarantirWebhook(siteUrl: string): Promise<{ url: string }> {
  const url = `${siteUrl}/api/contratos/webhook`;
  const email = notificationEmail() || "contato@ectolab.org";
  await assinafyConfigurarWebhook(url, email);
  return { url };
}
