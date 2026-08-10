// src/app/(dashboard)/contratos/evento-actions.ts
// Server actions da gestão de contratos POR EVENTO: vínculo evento↔produto da
// loja, modelos habilitados por evento (com texto personalizado opcional),
// geração em lote para os alunos selecionados e envio em lote para assinatura.
// Reutiliza o núcleo de lib/contratos/{geracao,assinatura}.ts.

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { arquivarContratoNoDrive } from "@/lib/contratos/geracao";
import { enviarContratoParaAssinatura } from "@/lib/contratos/assinatura";
import { requireCoordenador, type ContratoActionState } from "./actions";

export type EventoActionState = ContratoActionState;

const initialState: EventoActionState = { ok: true, message: "" };

const ID_REGEX = /^\d+$/;
const MAX_COMBINACOES = 30;
const MAX_ENVIOS_LOTE = 30;

function revalidateEvento(eventoId: number) {
  revalidatePath(`/eventos/${eventoId}/contratos`);
  revalidatePath("/contratos");
}

function prazoCom(diasTexto: string): string | null {
  const dias = Number.parseInt(diasTexto, 10);
  if (!Number.isFinite(dias) || dias < 1 || dias > 90) return null;
  return new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
}

// ── Vínculo evento ↔ produto da loja ───────────────────────────────────

export async function vincularProdutoEvento(
  eventoId: number,
  wpProductId: number,
  nomeProduto: string,
  _prev: EventoActionState,
  _formData: FormData
): Promise<EventoActionState> {
  try {
    const { supabase } = await requireCoordenador();
    const { error } = await supabase.from("contrato_evento_produtos").insert({
      evento_id: eventoId,
      wp_product_id: wpProductId,
      nome_produto: nomeProduto.trim(),
    });
    if (error) throw new Error("Não foi possível vincular o produto.");
    revalidateEvento(eventoId);
    return { ok: true, message: "Produto vinculado ao evento." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Erro ao vincular o produto.",
    };
  }
}

export async function desvincularProdutoEvento(
  eventoId: number,
  wpProductId: number,
  _prev: EventoActionState,
  _formData: FormData
): Promise<EventoActionState> {
  try {
    const { supabase } = await requireCoordenador();
    await supabase
      .from("contrato_evento_produtos")
      .delete()
      .eq("evento_id", eventoId)
      .eq("wp_product_id", wpProductId);
    revalidateEvento(eventoId);
    return { ok: true, message: "Produto desvinculado do evento." };
  } catch {
    return { ok: false, message: "Erro ao desvincular o produto." };
  }
}

// ── Modelos do evento ──────────────────────────────────────────────────

export async function habilitarModeloEvento(
  eventoId: number,
  modeloId: number,
  _prev: EventoActionState,
  _formData: FormData
): Promise<EventoActionState> {
  try {
    const { supabase } = await requireCoordenador();
    const { error } = await supabase.from("contrato_evento_modelos").insert({
      evento_id: eventoId,
      modelo_id: modeloId,
    });
    if (error) throw new Error("Não foi possível habilitar o modelo.");
    revalidateEvento(eventoId);
    return { ok: true, message: "Modelo habilitado para o evento." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Erro ao habilitar o modelo.",
    };
  }
}

export async function desabilitarModeloEvento(
  eventoId: number,
  modeloId: number,
  _prev: EventoActionState,
  _formData: FormData
): Promise<EventoActionState> {
  try {
    const { supabase } = await requireCoordenador();
    await supabase
      .from("contrato_evento_modelos")
      .delete()
      .eq("evento_id", eventoId)
      .eq("modelo_id", modeloId);
    revalidateEvento(eventoId);
    return { ok: true, message: "Modelo desabilitado para o evento." };
  } catch {
    return { ok: false, message: "Erro ao desabilitar o modelo." };
  }
}

export async function salvarConteudoPersonalizado(
  eventoId: number,
  modeloId: number,
  _prev: EventoActionState,
  formData: FormData
): Promise<EventoActionState> {
  try {
    const { supabase } = await requireCoordenador();
    const conteudo = String(formData.get("conteudo") ?? "").trim();
    if (conteudo.length < 20) {
      return { ok: false, message: "O texto personalizado está muito curto." };
    }
    const { error } = await supabase
      .from("contrato_evento_modelos")
      .update({ conteudo_personalizado: conteudo })
      .eq("evento_id", eventoId)
      .eq("modelo_id", modeloId);
    if (error) throw new Error("Não foi possível salvar o texto.");
    revalidateEvento(eventoId);
    return { ok: true, message: "Texto personalizado salvo para este evento." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Erro ao salvar o texto.",
    };
  }
}

// ── Geração e envio em lote ────────────────────────────────────────────

export async function gerarContratosEvento(
  eventoId: number,
  _prev: EventoActionState,
  formData: FormData
): Promise<EventoActionState> {
  try {
    const { supabase } = await requireCoordenador();

    const alunoIds = formData
      .getAll("alunos")
      .map(String)
      .filter((v) => ID_REGEX.test(v))
      .map(Number);
    if (alunoIds.length === 0) {
      return { ok: false, message: "Selecione ao menos um aluno." };
    }
    if (alunoIds.length > 40) {
      return { ok: false, message: "Selecione no máximo 40 alunos por vez." };
    }

    const enviar = formData.get("enviar") === "1";
    const expiraDias = prazoCom(String(formData.get("expiraDias") ?? "15"));
    const expiraEm = expiraDias ?? prazoCom("15");

    const { data: modelos } = await supabase
      .from("contrato_evento_modelos")
      .select("modelo_id, conteudo_personalizado, modelo:contrato_modelos(titulo, categoria, conteudo)")
      .eq("evento_id", eventoId);
    const habilitados = (modelos ?? []).filter(
      (m) => m.modelo && typeof m.modelo === "object"
    );
    if (habilitados.length === 0) {
      return {
        ok: false,
        message: "Nenhum modelo habilitado para este evento. Habilite ao menos um.",
      };
    }

    if (alunoIds.length * habilitados.length > MAX_COMBINACOES) {
      return {
        ok: false,
        message: `Muitas combinações (${alunoIds.length} alunos × ${habilitados.length} modelos). Selecione menos alunos.`,
      };
    }

    const { data: alunos } = await supabase
      .from("wp_customers")
      .select("wp_customer_id, first_name, last_name, email")
      .in("wp_customer_id", alunoIds);

    let gerados = 0;
    let arquivados = 0;
    let enviados = 0;
    let semEmail = 0;
    const erros: string[] = [];

    for (const aluno of alunos ?? []) {
      const nome = [aluno.first_name, aluno.last_name].filter(Boolean).join(" ").trim();
      if (!nome) {
        erros.push(`Aluno #${aluno.wp_customer_id} sem nome — ignorado.`);
        continue;
      }
      for (const vinculo of habilitados) {
        const modelo = (Array.isArray(vinculo.modelo)
          ? vinculo.modelo[0]
          : vinculo.modelo) as {
          titulo: string;
          categoria: string;
          conteudo: string;
        } | null;
        if (!modelo) continue;

        const { data: inserted, error } = await supabase
          .from("contratos")
          .insert({
            modelo_id: vinculo.modelo_id,
            evento_id: eventoId,
            aluno_nome: nome,
            aluno_email: aluno.email || null,
            status: "gerado",
            expira_em: expiraEm,
            conteudo_utilizado: vinculo.conteudo_personalizado ?? modelo.conteudo,
          })
          .select("id")
          .single();
        if (error || !inserted) {
          erros.push(`Falha ao criar contrato de ${nome}.`);
          continue;
        }
        gerados += 1;

        try {
          await arquivarContratoNoDrive(supabase, inserted.id as number, eventoId);
          arquivados += 1;
        } catch {
          erros.push(`Drive falhou para ${nome}.`);
        }

        if (enviar) {
          if (!aluno.email) {
            semEmail += 1;
            continue;
          }
          const resultado = await enviarContratoParaAssinatura(supabase, inserted.id as number);
          if (resultado.ok) {
            enviados += 1;
          } else {
            erros.push(`Envio falhou para ${nome}.`);
          }
        }
      }
    }

    revalidateEvento(eventoId);
    const partes = [
      `${gerados} contrato${gerados === 1 ? "" : "s"} gerado${gerados === 1 ? "" : "s"}`,
      `${arquivados} no Drive`,
      ...(enviar ? [`${enviados} enviado${enviados === 1 ? "" : "s"} para assinatura`] : []),
      ...(semEmail > 0 ? [`${semEmail} sem e-mail (só gerado)`] : []),
    ];
    const amostra = erros.slice(0, 3).join(" ");
    return {
      ok: true,
      message: `${partes.join(" · ")}.${amostra ? ` ${amostra}` : ""}`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `Erro na geração em lote: ${error.message}`
          : "Erro na geração em lote.",
    };
  }
}

export async function enviarPendentesEvento(
  eventoId: number,
  _prev: EventoActionState,
  _formData: FormData
): Promise<EventoActionState> {
  try {
    const { supabase } = await requireCoordenador();

    const { data: pendentes } = await supabase
      .from("contratos")
      .select("id")
      .eq("evento_id", eventoId)
      .eq("status", "gerado")
      .order("created_at", { ascending: true })
      .limit(MAX_ENVIOS_LOTE);

    const ids = (pendentes ?? []).map((c) => c.id as number);
    if (ids.length === 0) {
      return { ok: true, message: "Nenhum contrato aguardando envio." };
    }

    let enviados = 0;
    const erros: string[] = [];
    for (const id of ids) {
      const resultado = await enviarContratoParaAssinatura(supabase, id);
      if (resultado.ok) {
        enviados += 1;
      } else {
        erros.push(`Contrato #${id}: ${resultado.message}`);
      }
    }

    revalidateEvento(eventoId);
    const amostra = erros.slice(0, 3).join(" ");
    return {
      ok: true,
      message: `${enviados} de ${ids.length} enviados para assinatura.${amostra ? ` ${amostra}` : ""}`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `Erro no envio em lote: ${error.message}`
          : "Erro no envio em lote.",
    };
  }
}
