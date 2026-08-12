// src/app/api/proep/google/callback/route.ts
// Recebe o callback do Google OAuth, troca o code por tokens e apresenta o
// refresh token para o operador copiar para as variáveis de ambiente.
// Auditoria 0063 (exfiltração de token + XSS refletido + CSRF):
//   1) o callback exige sessão de coordenador_geral (403 caso contrário);
//   2) valida o parâmetro `state` contra o cookie httpOnly setado pelo
//      connect (bloqueia OAuth CSRF / injeção de code alheio);
//   3) TODO o conteúdo interpolado no HTML é escapado (fim do XSS refletido
//      via ?error=... e via mensagens de erro da API);
//   4) a página de erro nunca ecoa o corpo bruto da resposta do Google
//      (que pode conter access_token);
//   5) o refresh token só é exibido para o coordenador autenticado.
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { requireCoordenadorGeral } from "@/lib/role-gates";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function GET(req: NextRequest) {
  try {
    await requireCoordenadorGeral();
  } catch {
    return new Response(
      htmlPage({
        title: "Acesso negado",
        content: `<p class="error">Somente o coordenador geral pode concluir a conexão com o Google.</p>`,
      }),
      { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  // Validação do state (OAuth CSRF): o cookie foi setado pelo connect com
  // httpOnly; sem cookie ou sem state → rejeita.
  const stateParam = req.nextUrl.searchParams.get("state");
  const stateCookie = req.cookies.get("proep_oauth_state")?.value;
  if (!stateParam || !stateCookie || !constantTimeEqual(stateParam, stateCookie)) {
    return new Response(
      htmlPage({
        title: "Sessão inválida",
        content: `<p class="error">Parâmetro de segurança ausente ou inválido. Refaça a conexão pelo painel.</p>`,
      }),
      { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (error) {
    return new Response(
      htmlPage({
        title: "Erro na autorização",
        content: `<p class="error">A autorização foi recusada pelo Google (${escapeHtml(error)}).</p>`,
      }),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (!code) {
    return new Response(
      htmlPage({
        title: "Código não encontrado",
        content: `<p class="error">Nenhum código de autorização recebido.</p>`,
      }),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const base = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;

  if (!clientId || !clientSecret) {
    return new Response(
      htmlPage({
        title: "Configuração incompleta",
        content: `<p class="error">GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não configurados no servidor.</p>`,
      }),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  let refreshToken: string;
  try {
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

    const tokenData = (await tokenResponse.json()) as {
      refresh_token?: string;
      access_token?: string;
    };

    if (!tokenResponse.ok || typeof tokenData.refresh_token !== "string") {
      // Nunca ecoar o corpo bruto (pode conter access_token) — mensagem
      // genérica + log no servidor.
      console.error("proep google callback: troca de code falhou", {
        status: tokenResponse.status,
        hasRefreshToken: typeof tokenData.refresh_token === "string",
      });
      return new Response(
        htmlPage({
          title: "Erro ao obter tokens",
          content: `<p class="error">Não foi possível trocar o código pelo refresh token. Tente novamente; se persistir, refaça a conexão e verifique os logs.</p>`,
        }),
        { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
    refreshToken = tokenData.refresh_token;
  } catch (e) {
    console.error("proep google callback: falha de rede na troca de code", e);
    return new Response(
      htmlPage({
        title: "Erro interno",
        content: `<p class="error">Falha ao contatar o Google. Tente novamente.</p>`,
      }),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Testes de acesso (apenas para exibir status na página).
  let driveTest = "❌ Falhou";
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    const accessToken = tokenData.access_token;
    if (tokenResponse.ok && accessToken) {
      const driveRes = await fetch(
        "https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id,name)",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (driveRes.ok) driveTest = "✅ Funcionando";
    }
  } catch {
    /* o teste é informativo; falha não aborta a página */
  }

  return new Response(
    htmlPage({
      title: "✅ Autorização concluída!",
      content: `
        <div class="success-box">
          <h2>Tokens obtidos com sucesso</h2>
          <p><strong>Drive:</strong> ${driveTest}</p>
        </div>

        <h2>1. Copie o Refresh Token</h2>
        <div class="token-box">
          <textarea id="token" readonly rows="2" onfocus="this.select()">${escapeHtml(refreshToken)}</textarea>
          <button onclick="copyToken()" class="btn">Copiar</button>
        </div>

        <h2>2. Adicione nas variáveis de ambiente</h2>
        <p>No <code>.env.local</code> do EctoDash ou no painel do Vercel (a secret do OAuth e o client id continuam como estão):</p>
        <pre>GOOGLE_REFRESH_TOKEN=${escapeHtml(refreshToken)}</pre>

        <h2>3. Teste a automação</h2>
        <p>Após salvar as variáveis, acesse <a href="/proep">/proep</a> e clique "Gerar" em um aluno.</p>

        <script>
          function copyToken() {
            const el = document.getElementById('token');
            el.select();
            navigator.clipboard.writeText(el.value).then(() => {
              const btn = document.querySelector('.btn');
              btn.textContent = 'Copiado!';
              setTimeout(() => btn.textContent = 'Copiar', 2000);
            });
          }
        </script>
      `,
    }),
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function htmlPage({ title, content }: { title: string; content: string }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — EctoDash PROEP</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; padding: 2rem; line-height: 1.6; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1.1rem; margin-top: 1.5rem; margin-bottom: 0.5rem; color: #334155; }
    .success-box { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 0.75rem; padding: 1rem; margin: 1rem 0; }
    .error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.75rem; padding: 1rem; color: #dc2626; }
    .token-box { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin: 0.5rem 0; }
    .token-box textarea { font-size: 0.75rem; word-break: break-all; flex: 1; background: #fff; padding: 0.5rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; resize: vertical; }
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
