"use server";

// Anexo opcional de pauta no Google Drive (D-02).
// Caminho principal: o servidor abre uma sessão de upload resumável (com o
// Origin do navegador) e o navegador envia os bytes direto ao Google; depois
// finalizarAnexo valida e vincula. Fallback (<= 2,5 MB): enviarAnexoDireto
// recebe o arquivo pela server action.
//
// SEGURANÇA (T-g5r-05): finalizarAnexo recebe um id de arquivo vindo do
// navegador. Antes de compartilhar publicamente (setLinkSharing) confirmamos
// via Drive que o arquivo está DENTRO da subpasta esperada de Pautas — isso
// impede alguém de tornar público um arquivo qualquer da instituição
// (contratos com dados pessoais) apenas informando o id dele.
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  createResumableUploadSession,
  getDriveFileDetails,
  setLinkSharing,
  trashDriveFile,
  uploadDriveFile,
} from "@/lib/google/drive";
import { ensurePautaSubfolder } from "@/lib/pautas/drive-folders";
import { sanitizarNome } from "@/lib/contratos/drive-folders";
import {
  ANEXO_DIRETO_MAX_BYTES,
  ANEXO_MAX_BYTES,
  extensaoDoAnexo,
  mimeDoAnexo,
  validarAnexo,
} from "@/lib/pautas/anexo";
import { formatarDataISO, proximaTerca } from "@/lib/proxima-reuniao";

type Falha = { ok: false; message: string };
type PautaAutorizada = {
  id: number;
  criado_por: string;
  reuniao_selecionada_id: number | null;
  stand_by: boolean;
  anexo_drive_id: string | null;
};
type FolderRef = { id: string; url: string };

const MSG_SEM_DRIVE = "Anexos indisponíveis no momento (Google Drive não conectado).";
const DRIVE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;

function mensagemDeErro(e: unknown, padrao: string): string {
  const texto = e instanceof Error ? e.message : "";
  if (/não conectado|GOOGLE_(REFRESH_TOKEN|CLIENT)|Configure GOOGLE/i.test(texto)) {
    return MSG_SEM_DRIVE;
  }
  return padrao;
}

async function carregarPautaAutorizada(
  pautaId: number
): Promise<{ ok: true; pauta: PautaAutorizada } | Falha> {
  const id = Number(pautaId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, message: "Pauta inválida." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada. Faça login novamente." };

  const { data: pauta } = await supabase
    .from("pautas")
    .select("id, criado_por, reuniao_selecionada_id, stand_by, anexo_drive_id")
    .eq("id", id)
    .maybeSingle();
  if (!pauta) return { ok: false, message: "Pauta não encontrada." };

  if (pauta.criado_por !== user.id) {
    const { data: perfil } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (perfil?.role !== "coordenador_geral") {
      return { ok: false, message: "Você não pode alterar o anexo desta pauta." };
    }
  }

  return {
    ok: true,
    pauta: {
      id: pauta.id as number,
      criado_por: String(pauta.criado_por),
      reuniao_selecionada_id: (pauta.reuniao_selecionada_id as number | null) ?? null,
      stand_by: Boolean(pauta.stand_by),
      anexo_drive_id: (pauta.anexo_drive_id as string | null) ?? null,
    },
  };
}

/** Subpasta do Drive: "Em espera", data da reunião escolhida ou próxima terça. */
async function pastaEsperada(pauta: PautaAutorizada): Promise<FolderRef> {
  let nome: string;
  if (pauta.stand_by) {
    nome = "Em espera";
  } else {
    let data: string | null = null;
    if (pauta.reuniao_selecionada_id) {
      const supabase = await createClient();
      const { data: reuniao } = await supabase
        .from("reunioes")
        .select("data_reuniao")
        .eq("id", pauta.reuniao_selecionada_id)
        .maybeSingle();
      data = reuniao?.data_reuniao ? String(reuniao.data_reuniao).slice(0, 10) : null;
    }
    nome = data ?? formatarDataISO(proximaTerca());
  }
  return ensurePautaSubfolder(nome);
}

function nomeArquivoDrive(pautaId: number, nomeOriginal: string): string {
  const ext = extensaoDoAnexo(nomeOriginal);
  const base = ext ? nomeOriginal.slice(0, nomeOriginal.length - ext.length - 1) : nomeOriginal;
  return `${pautaId} - ${sanitizarNome(base)}.${ext}`;
}

async function vincularAnexo(
  pauta: PautaAutorizada,
  fileId: string,
  nomeOriginal: string,
  pasta: FolderRef
): Promise<{ ok: true } | Falha> {
  const detalhes = await getDriveFileDetails(fileId);
  const tamanho = Number(detalhes.size ?? 0);
  const naPasta = Array.isArray(detalhes.parents) && detalhes.parents.includes(pasta.id);

  if (!naPasta || detalhes.trashed || tamanho > ANEXO_MAX_BYTES) {
    // Só descartamos o arquivo se ele está na pasta esperada (foi criado por
    // este fluxo); nunca mexemos em arquivo de outra pasta.
    if (naPasta) await trashDriveFile(fileId).catch(() => undefined);
    return { ok: false, message: "Não foi possível validar o arquivo enviado." };
  }

  await setLinkSharing(fileId, "reader");

  if (pauta.anexo_drive_id && pauta.anexo_drive_id !== fileId) {
    await trashDriveFile(pauta.anexo_drive_id).catch(() => undefined);
  }

  const url = detalhes.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
  const supabase = await createClient();
  const { error } = await supabase
    .from("pautas")
    .update({
      anexo_drive_id: fileId,
      anexo_url: url,
      anexo_nome: nomeOriginal.trim().slice(0, 200),
    })
    .eq("id", pauta.id);
  if (error) {
    console.error("vincularAnexo: update failed", error);
    return { ok: false, message: "O arquivo foi enviado, mas não foi possível vinculá-lo à pauta." };
  }

  revalidatePath("/reunioes");
  return { ok: true };
}

async function origemDaRequisicao(): Promise<string | null> {
  const h = await headers();
  const candidatos = [
    h.get("origin"),
    h.get("host")
      ? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`
      : null,
  ];
  for (const c of candidatos) {
    if (!c) continue;
    try {
      const u = new URL(c);
      if (u.protocol === "http:" || u.protocol === "https:") return u.origin;
    } catch {
      // tenta o próximo candidato
    }
  }
  return null;
}

export async function iniciarUploadAnexo(
  pautaId: number,
  arquivo: { nome: string; tamanho: number }
): Promise<{ ok: true; uploadUrl: string; mime: string } | Falha> {
  try {
    const auth = await carregarPautaAutorizada(pautaId);
    if (!auth.ok) return auth;

    const nome = String(arquivo?.nome ?? "");
    const tamanho = Number(arquivo?.tamanho);
    const erro = validarAnexo({ nome, tamanho });
    if (erro) return { ok: false, message: erro };
    const mime = mimeDoAnexo(nome);
    if (!mime) return { ok: false, message: "Tipo de arquivo não permitido." };

    const origin = await origemDaRequisicao();
    if (!origin) return { ok: false, message: "Não foi possível identificar a origem do envio." };

    const pasta = await pastaEsperada(auth.pauta);
    const uploadUrl = await createResumableUploadSession({
      parentFolderId: pasta.id,
      fileName: nomeArquivoDrive(auth.pauta.id, nome),
      mimeType: mime,
      size: tamanho,
      origin,
    });
    return { ok: true, uploadUrl, mime };
  } catch (e) {
    console.error("iniciarUploadAnexo failed", e);
    return { ok: false, message: mensagemDeErro(e, "Não foi possível iniciar o envio do anexo.") };
  }
}

export async function finalizarAnexo(
  pautaId: number,
  driveFileId: string,
  nomeOriginal: string
): Promise<{ ok: true } | Falha> {
  try {
    const auth = await carregarPautaAutorizada(pautaId);
    if (!auth.ok) return auth;
    if (!DRIVE_ID_RE.test(String(driveFileId ?? ""))) {
      return { ok: false, message: "Arquivo inválido." };
    }
    const pasta = await pastaEsperada(auth.pauta);
    return await vincularAnexo(auth.pauta, driveFileId, String(nomeOriginal ?? "anexo"), pasta);
  } catch (e) {
    console.error("finalizarAnexo failed", e);
    return { ok: false, message: mensagemDeErro(e, "Não foi possível salvar o anexo.") };
  }
}

export async function enviarAnexoDireto(
  pautaId: number,
  formData: FormData
): Promise<{ ok: true } | Falha> {
  try {
    const auth = await carregarPautaAutorizada(pautaId);
    if (!auth.ok) return auth;

    const arquivo = formData.get("arquivo");
    if (!(arquivo instanceof File)) return { ok: false, message: "Escolha um arquivo para anexar." };

    const erro = validarAnexo({ nome: arquivo.name, tamanho: arquivo.size });
    if (erro) return { ok: false, message: erro };
    if (arquivo.size > ANEXO_DIRETO_MAX_BYTES) {
      return { ok: false, message: "Este arquivo é grande demais para o envio alternativo (máx. 2,5 MB)." };
    }
    const mime = mimeDoAnexo(arquivo.name);
    if (!mime) return { ok: false, message: "Tipo de arquivo não permitido." };

    const pasta = await pastaEsperada(auth.pauta);
    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const criado = await uploadDriveFile(pasta.id, nomeArquivoDrive(auth.pauta.id, arquivo.name), buffer, mime);
    return await vincularAnexo(auth.pauta, criado.id, arquivo.name, pasta);
  } catch (e) {
    console.error("enviarAnexoDireto failed", e);
    return { ok: false, message: mensagemDeErro(e, "Não foi possível enviar o anexo.") };
  }
}

export async function removerAnexo(pautaId: number): Promise<{ ok: boolean; message?: string }> {
  try {
    const auth = await carregarPautaAutorizada(pautaId);
    if (!auth.ok) return auth;

    if (auth.pauta.anexo_drive_id) {
      await trashDriveFile(auth.pauta.anexo_drive_id).catch((e) =>
        console.error("removerAnexo: trash failed", e)
      );
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("pautas")
      .update({ anexo_drive_id: null, anexo_url: null, anexo_nome: null })
      .eq("id", auth.pauta.id);
    if (error) {
      console.error("removerAnexo: update failed", error);
      return { ok: false, message: "Não foi possível remover o anexo." };
    }

    revalidatePath("/reunioes");
    return { ok: true };
  } catch (e) {
    console.error("removerAnexo failed", e);
    return { ok: false, message: "Não foi possível remover o anexo." };
  }
}
