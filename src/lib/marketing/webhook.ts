// src/lib/marketing/webhook.ts
// Verificação de assinatura Svix dos webhooks do Resend (sem dep nova):
// header "svix-signature" = "v1,<base64 HMAC-SHA256(secret, id.ts.body)>",
// onde secret = base64 da parte após "whsec_".
import { createHmac } from "node:crypto";

export function verifySvixSignature(
  whsec: string,
  svixId: string,
  svixTimestamp: string,
  rawBody: string,
  signatureHeader: string
): boolean {
  if (!whsec || !svixId || !svixTimestamp || !rawBody || !signatureHeader) {
    return false;
  }
  const secret = whsec.startsWith("whsec_") ? whsec.slice("whsec_".length) : whsec;
  let key: Buffer;
  try {
    key = Buffer.from(secret, "base64");
  } catch {
    return false;
  }
  const expected = createHmac("sha256", key)
    .update(`${svixId}.${svixTimestamp}.${rawBody}`)
    .digest("base64");

  const versions = signatureHeader.split(" ").map((p) => p.split(",")[1] ?? "");
  return versions.some((v) => v.length === expected.length && timingSafeEq(v, expected));
}

function timingSafeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i]! ^ bb[i]!;
  return diff === 0;
}
