// src/lib/contratos/formulario.ts
// Núcleo do formulário público de contrato (painel.ectolab.org/contrato/<token>).
// SERVER-ONLY. Recebe um client service-role (a página é pública, sem sessão)
// e concentra TODAS as travas contra contrato duplicado e gasto de cota:
//
//   1. formulário ativo, dentro do prazo e abaixo do limite de respostas;
//   2. dados validados (CPF pelos dígitos, e-mail, nascimento, campos que o
//      modelo usa);
//   3. limite de envios por origem (ip_hash) por hora;
//   4. resposta anterior com o mesmo CPF ou e-mail no formulário → não cria
//      outra (oferece reenviar o e-mail de assinatura, que não gasta cota);
//   5. contrato já existente do mesmo modelo/evento e CPF (criado por outro
//      caminho) → reaproveita se ainda não foi enviado; se já foi, não duplica;
//   6. índices únicos no banco seguram o duplo clique simultâneo;
//   7. cota mensal checada antes de enviar; sem cota, a resposta fica
//      aguardando aprovação em vez de falhar.

import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALUNO_CAMPOS,
  chaveDocumento,
  dataParaIso,
  formatarCpf,
  mascararEmail,
  normalizarNome,
  validarAluno,
  type AlunoContrato,
} from "./aluno";
import { saldoCota } from "./cota";
import { enviarContratoParaAssinatura } from "./assinatura";
import type { EventoContratoRow } from "./render";
import { assinafyReenviarSolicitacao } from "@/lib/assinafy";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://painel.ectolab.org";
const MAX_RESPOSTAS_POR_IP_HORA = 5;
const REENVIO_INTERVALO_MIN = 30;

export const MSG_EMAIL_DE_OUTRA_PESSOA =
  "Este e-mail já foi usado por outra pessoa neste formulário. Cada aluno precisa preencher o próprio formulário, com o próprio e-mail — casais e familiares: cada um faz o seu.";

export function gerarTokenFormulario(): string {
  return randomBytes(18).toString("base64url");
}

export function linkFormulario(token: string): string {
  return `${SITE_URL}/contrato/${token}`;
}

export function hashOrigem(ip: string): string {
  const sal = process.env.ASSINAFY_WEBHOOK_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHash("sha256").update(`${sal}:${ip}`).digest("hex").slice(0, 32);
}

/** Campos pedidos no formulário: os básicos sempre (identificam o aluno e
 *  permitem a assinatura) + os que o texto do modelo usa. */
const BASICOS: Array<keyof AlunoContrato> = ["nome", "documento", "email", "telefone"];
const VARIAVEL_CAMPO: Record<string, keyof AlunoContrato> = {
  aluno_rg: "rg",
  aluno_nascimento: "nascimento",
  aluno_endereco: "endereco",
  aluno_nacionalidade: "nacionalidade",
  aluno_estado_civil: "estadoCivil",
  aluno_profissao: "profissao",
};

export function camposDoFormulario(conteudoModelo: string): Array<keyof AlunoContrato> {
  const usados = new Set<keyof AlunoContrato>(BASICOS);
  for (const m of conteudoModelo.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
    const campo = VARIAVEL_CAMPO[m[1]];
    if (campo) usados.add(campo);
  }
  return ALUNO_CAMPOS.map((c) => c.campo).filter((c) => usados.has(c));
}

export type FormularioPublico = {
  id: number;
  token: string;
  titulo: string;
  instrucoes: string | null;
  envioAutomatico: boolean;
  prazoAssinaturaDias: number;
  criadoPor: string;
  modelo: { id: number; titulo: string; categoria: string; conteudo: string };
  conteudo: string;
  conteudoPersonalizado: string | null;
  evento: (EventoContratoRow & { id: number }) | null;
  campos: Array<keyof AlunoContrato>;
};

export type CargaFormulario =
  | { ok: true; formulario: FormularioPublico }
  | { ok: false; motivo: string };

export async function carregarFormularioPublico(
  admin: SupabaseClient,
  token: string
): Promise<CargaFormulario> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    return { ok: false, motivo: "Link inválido. Confira o endereço que você recebeu." };
  }
  const { data: f } = await admin
    .from("contrato_formularios")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!f) return { ok: false, motivo: "Link inválido. Confira o endereço que você recebeu." };
  if (!f.ativo) return { ok: false, motivo: "Este formulário foi encerrado pela organização." };

  const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  if (f.expira_em && f.expira_em < hoje) {
    return { ok: false, motivo: "O prazo para preencher este formulário terminou." };
  }

  const { data: modelo } = await admin
    .from("contrato_modelos")
    .select("id, titulo, categoria, conteudo, ativo")
    .eq("id", f.modelo_id)
    .single();
  if (!modelo || !modelo.ativo) {
    return { ok: false, motivo: "Este contrato não está disponível no momento. Fale com a organização." };
  }

  let evento: FormularioPublico["evento"] = null;
  let conteudoPersonalizado: string | null = null;
  if (f.evento_id) {
    const { data } = await admin
      .from("eventos")
      .select("id, titulo, descricao, data_evento, local")
      .eq("id", f.evento_id)
      .single();
    evento = (data as FormularioPublico["evento"]) ?? null;
    const { data: vinculo } = await admin
      .from("contrato_evento_modelos")
      .select("conteudo_personalizado")
      .eq("evento_id", f.evento_id)
      .eq("modelo_id", f.modelo_id)
      .maybeSingle();
    conteudoPersonalizado = vinculo?.conteudo_personalizado?.trim() || null;
  }
  const conteudo = conteudoPersonalizado ?? (modelo.conteudo as string);

  return {
    ok: true,
    formulario: {
      id: f.id,
      token: f.token,
      titulo: f.titulo,
      instrucoes: f.instrucoes,
      envioAutomatico: f.envio_automatico,
      prazoAssinaturaDias: f.prazo_assinatura_dias,
      criadoPor: f.criado_por,
      modelo: modelo as FormularioPublico["modelo"],
      conteudo,
      conteudoPersonalizado,
      evento,
      campos: camposDoFormulario(conteudo),
    },
  };
}

/** Limite de respostas atingido? (Contado à parte: a página mostra o aviso
 *  antes de a pessoa preencher tudo.) */
export async function formularioLotado(
  admin: SupabaseClient,
  formularioId: number
): Promise<boolean> {
  const { data: f } = await admin
    .from("contrato_formularios")
    .select("limite_respostas")
    .eq("id", formularioId)
    .single();
  const { count } = await admin
    .from("contrato_formulario_respostas")
    .select("id", { count: "exact", head: true })
    .eq("formulario_id", formularioId)
    .neq("status", "cancelado");
  return (count ?? 0) >= (f?.limite_respostas ?? 0);
}

export function validarRespostaAluno(
  aluno: AlunoContrato,
  campos: Array<keyof AlunoContrato>
): string[] {
  const { erros } = validarAluno(aluno);
  if (!aluno.documento.trim()) erros.push("Informe seu CPF (ou seu documento, se for estrangeiro)");
  for (const campo of campos) {
    if (!aluno[campo].trim()) {
      const label = ALUNO_CAMPOS.find((c) => c.campo === campo)?.label ?? campo;
      const msg = `Preencha: ${label}`;
      if (!erros.some((e) => e.toLowerCase().startsWith(label.toLowerCase().split(" ")[0]))) erros.push(msg);
    }
  }
  if (aluno.endereco.trim() && campos.includes("endereco") && aluno.endereco.trim().length < 15) {
    erros.push("Endereço incompleto (rua, número, bairro, cidade/UF, CEP)");
  }
  if (aluno.nascimento.trim()) {
    const iso = dataParaIso(aluno.nascimento);
    const hoje = new Date().toISOString().slice(0, 10);
    if (iso && (iso > hoje || iso < "1900-01-01")) erros.push("Data de nascimento fora do esperado");
  }
  return erros;
}

export type ResultadoResposta =
  | { tipo: "enviado"; emailMascarado: string; signingUrl?: string }
  | { tipo: "aguardando"; emailMascarado: string }
  | { tipo: "duplicado"; emailMascarado: string; podeReenviar: boolean; status: string }
  | { tipo: "erro"; message: string };

type RespostaRow = {
  id: number;
  status: string;
  aluno_cpf: string;
  aluno_email: string;
  contrato_id: number | null;
  reenviado_em: string | null;
};

async function respostaExistente(
  admin: SupabaseClient,
  formularioId: number,
  cpf: string,
  email: string
): Promise<RespostaRow | null> {
  const { data } = await admin
    .from("contrato_formulario_respostas")
    .select("id, status, aluno_cpf, aluno_email, contrato_id, reenviado_em")
    .eq("formulario_id", formularioId)
    .neq("status", "cancelado")
    .or(`aluno_cpf.eq."${cpf.replace(/[^A-Za-z0-9-]/g, "")}",aluno_email.eq."${email.replace(/["\\,()]/g, "")}"`)
    .limit(1)
    .maybeSingle();
  return (data as RespostaRow | null) ?? null;
}

async function statusContrato(admin: SupabaseClient, contratoId: number | null): Promise<string | null> {
  if (!contratoId) return null;
  const { data } = await admin.from("contratos").select("status").eq("id", contratoId).maybeSingle();
  return (data?.status as string | undefined) ?? null;
}

function duplicado(r: RespostaRow, contratoStatus: string | null): ResultadoResposta {
  return {
    tipo: "duplicado",
    emailMascarado: mascararEmail(r.aluno_email),
    podeReenviar: r.status === "enviado" && contratoStatus === "assinando",
    status: contratoStatus === "assinado" ? "assinado" : r.status,
  };
}

/** Grava a resposta e (se automático) cria o contrato e envia para assinatura. */
export async function registrarResposta(
  admin: SupabaseClient,
  formulario: FormularioPublico,
  alunoBruto: AlunoContrato,
  origem: { ip: string; userAgent: string }
): Promise<ResultadoResposta> {
  const aluno: AlunoContrato = {
    ...alunoBruto,
    nome: normalizarNome(alunoBruto.nome),
    email: alunoBruto.email.trim().toLowerCase(),
  };
  const erros = validarRespostaAluno(aluno, formulario.campos);
  if (erros.length > 0) return { tipo: "erro", message: erros.join(". ") + "." };

  const cpf = chaveDocumento(aluno.documento);

  // Trava 4 — já respondeu (mesmo CPF/documento ou e-mail) neste formulário.
  const anterior = await respostaExistente(admin, formulario.id, cpf, aluno.email);
  if (anterior) {
    // Mesmo e-mail com outro documento: é outra pessoa usando o e-mail de
    // alguém (ex.: casal). Cada aluno precisa do próprio e-mail.
    if (anterior.aluno_cpf !== cpf) return { tipo: "erro", message: MSG_EMAIL_DE_OUTRA_PESSOA };
    return duplicado(anterior, await statusContrato(admin, anterior.contrato_id));
  }

  // Trava 1 — limite de respostas.
  if (await formularioLotado(admin, formulario.id)) {
    return { tipo: "erro", message: "Este formulário atingiu o limite de respostas. Fale com a organização." };
  }

  // Trava 3 — muitas respostas da mesma origem em 1 hora.
  const ipHash = hashOrigem(origem.ip);
  const umaHora = new Date(Date.now() - 3600000).toISOString();
  const { count: recentes } = await admin
    .from("contrato_formulario_respostas")
    .select("id", { count: "exact", head: true })
    .eq("formulario_id", formulario.id)
    .eq("ip_hash", ipHash)
    .gte("created_at", umaHora);
  if ((recentes ?? 0) >= MAX_RESPOSTAS_POR_IP_HORA) {
    return {
      tipo: "erro",
      message: "Muitos envios a partir desta conexão. Aguarde uma hora ou fale com a organização.",
    };
  }

  // Trava 5 — contrato do mesmo modelo/evento e CPF criado por outro caminho.
  let contratoExistente: { id: number; status: string } | null = null;
  {
    let q = admin
      .from("contratos")
      .select("id, status, aluno_documento, aluno_email")
      .eq("modelo_id", formulario.modelo.id)
      .neq("status", "cancelado")
      .limit(2000);
    q = formulario.evento ? q.eq("evento_id", formulario.evento.id) : q.is("evento_id", null);
    const { data } = await q;
    const contratos = data ?? [];
    const achado = contratos.find((c) => chaveDocumento(c.aluno_documento ?? "") === cpf);
    const mesmoEmail = contratos.find(
      (c) => (c.aluno_email ?? "").trim().toLowerCase() === aluno.email
    );
    if (achado) contratoExistente = { id: achado.id, status: achado.status };
    else if (mesmoEmail && mesmoEmail.aluno_documento) {
      // Contrato com este e-mail já é de outra pessoa (documento diferente).
      return { tipo: "erro", message: MSG_EMAIL_DE_OUTRA_PESSOA };
    } else if (mesmoEmail) contratoExistente = { id: mesmoEmail.id, status: mesmoEmail.status };
  }
  const contratoJaEnviado =
    contratoExistente && ["assinando", "assinado"].includes(contratoExistente.status);

  const colunasAluno = {
    aluno_nome: aluno.nome,
    aluno_email: aluno.email,
    aluno_telefone: aluno.telefone.trim() || null,
    aluno_rg: aluno.rg.trim() || null,
    aluno_nascimento: dataParaIso(aluno.nascimento),
    aluno_endereco: aluno.endereco.trim() || null,
    aluno_nacionalidade: aluno.nacionalidade.trim() || null,
    aluno_estado_civil: aluno.estadoCivil.trim() || null,
    aluno_profissao: aluno.profissao.trim() || null,
  };

  // Trava 6 — insert protegido pelos índices únicos (duplo clique).
  const { data: resposta, error: insertError } = await admin
    .from("contrato_formulario_respostas")
    .insert({
      formulario_id: formulario.id,
      ...colunasAluno,
      aluno_cpf: cpf,
      aluno_documento: formatarCpf(aluno.documento),
      contrato_id: contratoExistente?.id ?? null,
      status: contratoJaEnviado ? "enviado" : "recebido",
      consentimento_em: new Date().toISOString(),
      ip_hash: ipHash,
      user_agent: origem.userAgent.slice(0, 300),
    })
    .select("id")
    .single();
  if (insertError || !resposta) {
    if (insertError?.code === "23505") {
      const r = await respostaExistente(admin, formulario.id, cpf, aluno.email);
      if (r) return duplicado(r, await statusContrato(admin, r.contrato_id));
    }
    console.error("[formulario] insert resposta failed", insertError);
    return { tipo: "erro", message: "Não foi possível registrar seus dados. Tente de novo em instantes." };
  }

  if (contratoJaEnviado) {
    // Já existe contrato enviado para este CPF/e-mail: não gasta outro crédito.
    return {
      tipo: "duplicado",
      emailMascarado: mascararEmail(aluno.email),
      podeReenviar: contratoExistente!.status === "assinando",
      status: contratoExistente!.status,
    };
  }

  // Cria (ou atualiza o "gerado" existente) com os dados que a pessoa digitou.
  const expiraEm = new Date(Date.now() + formulario.prazoAssinaturaDias * 86400000)
    .toISOString()
    .slice(0, 10);
  const dadosContrato = {
    ...colunasAluno,
    aluno_documento: formatarCpf(aluno.documento),
    expira_em: expiraEm,
  };
  let contratoId: number;
  if (contratoExistente) {
    await admin.from("contratos").update(dadosContrato).eq("id", contratoExistente.id);
    contratoId = contratoExistente.id;
  } else {
    const { data: novo, error } = await admin
      .from("contratos")
      .insert({
        ...dadosContrato,
        modelo_id: formulario.modelo.id,
        evento_id: formulario.evento?.id ?? null,
        conteudo_utilizado: formulario.conteudoPersonalizado,
        status: "gerado",
        criado_por: formulario.criadoPor,
      })
      .select("id")
      .single();
    if (error || !novo) {
      await admin
        .from("contrato_formulario_respostas")
        .update({ status: "erro_envio", erro: "Falha ao criar o contrato." })
        .eq("id", resposta.id);
      return {
        tipo: "aguardando",
        emailMascarado: mascararEmail(aluno.email),
      };
    }
    contratoId = novo.id as number;
  }
  await admin.from("contrato_formulario_respostas").update({ contrato_id: contratoId }).eq("id", resposta.id);

  if (!formulario.envioAutomatico) {
    await admin
      .from("contrato_formulario_respostas")
      .update({ status: "aguardando_aprovacao" })
      .eq("id", resposta.id);
    return { tipo: "aguardando", emailMascarado: mascararEmail(aluno.email) };
  }

  return enviarResposta(admin, resposta.id, contratoId, formulario.criadoPor, aluno.email);
}

/** Envia o contrato de uma resposta (automático ou aprovado pelo coordenador). */
export async function enviarResposta(
  supabase: SupabaseClient,
  respostaId: number,
  contratoId: number,
  enviadoPor: string | undefined,
  email: string
): Promise<ResultadoResposta> {
  // Trava 7 — cota: sem saldo, fica aguardando o coordenador.
  const saldo = await saldoCota(supabase).catch(() => null);
  if (!saldo || saldo.restantes < 1) {
    await supabase
      .from("contrato_formulario_respostas")
      .update({ status: "aguardando_aprovacao", erro: "Cota mensal da Assinafy esgotada." })
      .eq("id", respostaId);
    return { tipo: "aguardando", emailMascarado: mascararEmail(email) };
  }

  const envio = await enviarContratoParaAssinatura(supabase, contratoId, { enviadoPor });
  await supabase
    .from("contrato_formulario_respostas")
    .update(
      envio.ok
        ? { status: "enviado", erro: null, updated_at: new Date().toISOString() }
        : { status: "erro_envio", erro: envio.message, updated_at: new Date().toISOString() }
    )
    .eq("id", respostaId);

  if (!envio.ok) return { tipo: "aguardando", emailMascarado: mascararEmail(email) };
  return { tipo: "enviado", emailMascarado: mascararEmail(email), signingUrl: envio.url };
}

/** Reenvia o e-mail de assinatura de quem já respondeu (sem novo documento). */
export async function reenviarEmailResposta(
  supabase: SupabaseClient,
  formularioId: number,
  identificacao: { cpf: string; email: string }
): Promise<{ ok: boolean; message: string }> {
  const cpf = chaveDocumento(identificacao.cpf);
  const email = identificacao.email.trim().toLowerCase();
  const r = await respostaExistente(supabase, formularioId, cpf, email);
  if (!r || !r.contrato_id) return { ok: false, message: "Não encontramos seu envio. Fale com a organização." };

  if (r.reenviado_em && Date.now() - new Date(r.reenviado_em).getTime() < REENVIO_INTERVALO_MIN * 60000) {
    return {
      ok: false,
      message: `O e-mail já foi reenviado há pouco. Aguarde ${REENVIO_INTERVALO_MIN} minutos e confira também a caixa de spam.`,
    };
  }

  const { data: c } = await supabase
    .from("contratos")
    .select("status, assinafy_document_id, assinafy_assignment_id, assinafy_signer_id")
    .eq("id", r.contrato_id)
    .single();
  if (!c || c.status !== "assinando" || !c.assinafy_document_id || !c.assinafy_assignment_id || !c.assinafy_signer_id) {
    return { ok: false, message: "Não é possível reenviar este contrato. Fale com a organização." };
  }

  try {
    await assinafyReenviarSolicitacao(c.assinafy_document_id, c.assinafy_assignment_id, c.assinafy_signer_id);
  } catch (error) {
    console.error("[formulario] reenvio failed", error);
    return { ok: false, message: "Não foi possível reenviar agora. Tente mais tarde." };
  }
  await supabase
    .from("contrato_formulario_respostas")
    .update({ reenviado_em: new Date().toISOString() })
    .eq("id", r.id);
  return { ok: true, message: `E-mail reenviado para ${mascararEmail(r.aluno_email)}. Confira também a caixa de spam.` };
}
