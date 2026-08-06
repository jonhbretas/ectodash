// src/lib/google/forms.ts
// Google Forms operations: duplicate forms.

import { googleApiRequest } from "./oauth";

const FORMS_API = "https://forms.googleapis.com/v1";

/** Duplicate a Google Form using Drive copy + Forms API rename */
export async function duplicateForm(
  sourceFormId: string,
  newTitle: string,
  parentFolderId?: string,
): Promise<{ formId: string; responderUri: string }> {
  // 1. Copy via Drive API (with optional parent folder)
  const body: Record<string, unknown> = { name: newTitle };
  if (parentFolderId) body.parents = [parentFolderId];
  const copyResult = await googleApiRequest(
    `https://www.googleapis.com/drive/v3/files/${sourceFormId}/copy`,
    { method: "POST", body: JSON.stringify(body) },
  );
  const newFormId = copyResult.id as string;

  // 2. Update title via Forms API
  await googleApiRequest(`${FORMS_API}/forms/${newFormId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [{ updateFormInfo: { info: { title: newTitle }, updateMask: "title" } }],
    }),
  });

  // 3. Get responder URI
  const form = await googleApiRequest(`${FORMS_API}/forms/${newFormId}`);
  return { formId: newFormId, responderUri: form.responderUri || "" };
}
