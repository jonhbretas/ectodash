// src/app/api/proep/google/callback/route.ts
// Handles Google OAuth callback, exchanges code for tokens,
// and displays the refresh token for the user to copy.
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return new Response(htmlPage({
      title: "Erro na autorização",
      content: `<p class="error">Erro: ${error}</p>`,
    }), { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  if (!code) {
    return new Response(htmlPage({
      title: "Código não encontrado",
      content: `<p class="error">Nenhum código de autorização recebido.</p>`,
    }), { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const base = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;

  if (!clientId || !clientSecret) {
    return new Response(htmlPage({
      title: "Configuração incompleta",
      content: `<p class="error">GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não configurados no servidor.</p>`,
    }), { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${base}/api/proep/google/callback`,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.refresh_token) {
      return new Response(htmlPage({
        title: "Erro ao obter tokens",
        content: `<p class="error">Resposta: ${JSON.stringify(tokenData, null, 2)}</p>`,
      }), { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    const refreshToken = tokenData.refresh_token;
    const accessToken = tokenData.access_token;

    // Test: list Drive files to confirm access works
    let driveTest = "❌ Falhou";
    try {
      const driveRes = await fetch("https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id,name)", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (driveRes.ok) driveTest = "✅ Funcionando";
    } catch { /* ignore */ }

    // Test: list Forms to confirm access works
    let formsTest = "❌ Falhou";
    try {
      const formsRes = await fetch("https://forms.googleapis.com/v1/forms", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (formsRes.ok) formsTest = "✅ Funcionando";
    } catch { /* ignore */ }

    return new Response(htmlPage({
      title: "✅ Autorização concluída!",
      content: `
        <div class="success-box">
          <h2>Tokens obtidos com sucesso</h2>
          <p><strong>Drive:</strong> ${driveTest}</p>
          <p><strong>Forms:</strong> ${formsTest}</p>
        </div>

        <h2>1. Copie o Refresh Token</h2>
        <div class="token-box">
          <code id="token">${refreshToken}</code>
          <button onclick="copyToken()" class="btn">Copiar</button>
        </div>

        <h2>2. Adicione nas variáveis de ambiente</h2>
        <p>No <code>.env.local</code> do EctoDash ou no painel do Vercel:</p>
        <pre>GOOGLE_CLIENT_ID=${clientId}
GOOGLE_CLIENT_SECRET=xxx...
GOOGLE_REFRESH_TOKEN=${refreshToken}</pre>

        <h2>3. Teste a automação</h2>
        <p>Após salvar as variáveis, acesse <a href="/proep">/proep</a> e clique "Gerar" em um aluno.</p>

        <script>
          function copyToken() {
            navigator.clipboard.writeText('${refreshToken}');
            const btn = document.querySelector('.btn');
            btn.textContent = 'Copiado!';
            setTimeout(() => btn.textContent = 'Copiar', 2000);
          }
        </script>
      `,
    }), { headers: { "Content-Type": "text/html; charset=utf-8" } });

  } catch (e: any) {
    return new Response(htmlPage({
      title: "Erro interno",
      content: `<p class="error">${e.message || "Erro desconhecido"}</p>`,
    }), { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

function htmlPage({ title, content }: { title: string; content: string }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — EctoDash PROEP</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; padding: 2rem; line-height: 1.6; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1.1rem; margin-top: 1.5rem; margin-bottom: 0.5rem; color: #334155; }
    .subtitle { color: #64748b; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .success-box { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 0.75rem; padding: 1rem; margin: 1rem 0; }
    .error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.75rem; padding: 1rem; color: #dc2626; }
    .token-box { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin: 0.5rem 0; }
    .token-box code { font-size: 0.75rem; word-break: break-all; flex: 1; background: #fff; padding: 0.5rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; }
    .btn { background: #2195B9; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; font-weight: 600; font-size: 0.85rem; }
    .btn:hover { background: #1a7a96; }
    pre { background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 0.75rem; overflow-x: auto; font-size: 0.8rem; margin: 0.5rem 0; }
    code { font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; }
    a { color: #2195B9; }
  </style>
</head>
<body>
  <h1>PROEP — Google OAuth</h1>
  <p class="subtitle">Programa de Estimulação Parapsíquica Ectoplásmica</p>
  ${content}
</body>
</html>`;
}
