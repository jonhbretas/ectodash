// Cliente: envia o anexo de uma pauta ao Google Drive.
// 1) o servidor abre uma sessão de upload resumável (iniciarUploadAnexo);
// 2) o navegador envia os bytes direto ao Google via XMLHttpRequest (progresso);
// 3) o servidor valida e vincula (finalizarAnexo).
// Se o envio direto falhar na rede (status 0 = CORS/offline) e o arquivo for
// pequeno, tenta o caminho alternativo pela server action (enviarAnexoDireto).
// Sem "use server": roda no navegador.
import {
  enviarAnexoDireto,
  finalizarAnexo,
  iniciarUploadAnexo,
} from "../pauta-anexo-actions";
import { ANEXO_DIRETO_MAX_BYTES, validarAnexo } from "@/lib/pautas/anexo";

export type ResultadoAnexo = { ok: boolean; message: string };

type RespostaXhr = { status: number; body: string };

function enviarBytes(
  url: string,
  file: File,
  mime: string,
  onProgresso?: (percentual: number) => void
): Promise<RespostaXhr> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", mime);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgresso) {
        onProgresso(Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
      }
    };
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => resolve({ status: 0, body: "" });
    xhr.onabort = () => resolve({ status: 0, body: "" });
    xhr.send(file);
  });
}

async function viaServidor(pautaId: number, file: File): Promise<ResultadoAnexo> {
  const fd = new FormData();
  fd.set("arquivo", file);
  const r = await enviarAnexoDireto(pautaId, fd);
  return r.ok ? { ok: true, message: "Anexo salvo." } : { ok: false, message: r.message };
}

export async function enviarAnexoPauta(
  pautaId: number,
  file: File,
  onProgresso?: (percentual: number) => void
): Promise<ResultadoAnexo> {
  const erro = validarAnexo({ nome: file.name, tamanho: file.size });
  if (erro) return { ok: false, message: erro };

  try {
    const sessao = await iniciarUploadAnexo(pautaId, { nome: file.name, tamanho: file.size });
    if (!sessao.ok) return { ok: false, message: sessao.message };

    onProgresso?.(0);
    const resp = await enviarBytes(sessao.uploadUrl, file, sessao.mime, onProgresso);

    if (resp.status === 0) {
      if (file.size <= ANEXO_DIRETO_MAX_BYTES) return await viaServidor(pautaId, file);
      return {
        ok: false,
        message: "Não foi possível enviar o arquivo. Verifique a conexão e tente de novo.",
      };
    }

    if (resp.status !== 200 && resp.status !== 201) {
      return { ok: false, message: "O Google Drive recusou o arquivo. Tente novamente." };
    }

    let driveId = "";
    try {
      driveId = String((JSON.parse(resp.body) as { id?: string }).id ?? "");
    } catch {
      driveId = "";
    }
    if (!driveId) return { ok: false, message: "Resposta inesperada do Google Drive." };

    onProgresso?.(100);
    const fim = await finalizarAnexo(pautaId, driveId, file.name);
    return fim.ok ? { ok: true, message: "Anexo salvo." } : { ok: false, message: fim.message };
  } catch (e) {
    console.error("enviarAnexoPauta failed", e);
    return { ok: false, message: "Não foi possível enviar o anexo agora." };
  }
}
