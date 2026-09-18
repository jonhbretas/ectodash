// src/lib/marketing/webhook.test.ts
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySvixSignature } from "./webhook";

const SECRET = `whsec_${Buffer.from("test-secret-1234567890").toString("base64")}`;

function sign(id: string, ts: string, body: string): string {
  const raw = Buffer.from(SECRET.slice("whsec_".length), "base64");
  const sig = createHmac("sha256", raw).update(`${id}.${ts}.${body}`).digest("base64");
  return `v1,${sig}`;
}

describe("verifySvixSignature", () => {
  it("aceita assinatura válida", () => {
    const body = '{"type":"email.opened"}';
    expect(verifySvixSignature(SECRET, "id-1", "1710000000", body, sign("id-1", "1710000000", body))).toBe(true);
  });

  it("rejeita corpo adulterado e header vazio", () => {
    const body = '{"type":"email.opened"}';
    const good = sign("id-1", "1710000000", body);
    expect(verifySvixSignature(SECRET, "id-1", "1710000000", '{"type":"x"}', good)).toBe(false);
    expect(verifySvixSignature(SECRET, "id-1", "1710000000", body, "")).toBe(false);
  });
});
