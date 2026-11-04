// Gravação dos registros da Dinâmica DIP extraídos de uma ata — regra única
// para /analisar e /reunioes/analisar (AGENTS.md: buscar duplicata → mesclar
// em vez de duplicar).
//
// - País vazio é completado pelo cadastro dip_localidades (a IA costuma
//   citar só a cidade).
// - Duplicata = mesma localidade (normalizada) + país compatível + data
//   compatível. Datas diferentes NÃO casam: DIPs são semanais por localidade.
//   Data ausente de um dos lados casa com o registro mais próximo.
// - Mesclagem via RPC mesclar_dip_da_ata (migration 20261104120000):
//   aditiva, nunca apaga participantes/observações, e retorna erro real
//   quando falta permissão (antes o UPDATE afetava 0 linhas em silêncio).
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeTexto } from "@/lib/ai/pos-filtro";

export type DipAcao = "auto" | "criar" | "pular" | "incrementar";

export type DipEntrada = {
  localidade: string;
  pais: string;
  data: string | null;
  participantes: number | null;
  observacoes: string;
  acao?: DipAcao;
  dipId?: number | null;
};

export type DipExistente = {
  id: number;
  localidade: string;
  pais: string;
  data_dip: string | null;
};

export type LocalidadeCadastrada = { localidade: string; pais: string };

export type ResultadoDips = {
  salvos: number;
  atualizados: number;
  ignorados: number;
  erros: string[];
};

/** Completa o país pelo cadastro de localidades quando a IA não informou. */
export function completarPais(
  localidade: string,
  pais: string,
  cadastro: LocalidadeCadastrada[]
): string {
  if (pais.trim()) return pais.trim();
  const alvo = normalizeTexto(localidade);
  if (!alvo) return "";
  return cadastro.find((l) => normalizeTexto(l.localidade) === alvo)?.pais.trim() ?? "";
}

/**
 * Procura o registro DIP que a menção da ata atualiza. Prioridade:
 * 1) mesma data; 2) registro sem data (quando a menção tem data);
 * 3) menção sem data → registro mais recente da localidade.
 */
export function encontrarDipExistente(
  dip: { localidade: string; pais: string; data: string | null },
  existentes: DipExistente[]
): DipExistente | null {
  const loc = normalizeTexto(dip.localidade);
  const pais = normalizeTexto(dip.pais);
  if (!loc) return null;
  const candidatos = existentes.filter((e) => {
    if (normalizeTexto(e.localidade) !== loc) return false;
    const ePais = normalizeTexto(e.pais);
    return !pais || !ePais || ePais === pais;
  });
  if (candidatos.length === 0) return null;

  if (dip.data) {
    return (
      candidatos.find((e) => e.data_dip === dip.data) ??
      candidatos.find((e) => e.data_dip === null) ??
      null
    );
  }
  return [...candidatos].sort((a, b) => (b.data_dip ?? "").localeCompare(a.data_dip ?? ""))[0];
}

function mensagemErro(localidade: string, error: { code?: string; message?: string }): string {
  if (error.code === "42501") return `${localidade}: sem permissão para atualizar o registro DIP`;
  return `${localidade}: ${error.message || "falha ao salvar"}`;
}

export async function carregarContextoDips(supabase: SupabaseClient): Promise<{
  existentes: DipExistente[];
  cadastro: LocalidadeCadastrada[];
}> {
  const [dipsResult, localidadesResult] = await Promise.all([
    supabase.from("dips").select("id, localidade, pais, data_dip"),
    supabase.from("dip_localidades").select("localidade, pais"),
  ]);
  return {
    existentes: (dipsResult.data ?? []) as DipExistente[],
    cadastro: (localidadesResult.data ?? []) as LocalidadeCadastrada[],
  };
}

export async function salvarDipsDaAta(
  supabase: SupabaseClient,
  ataId: number | null,
  dips: DipEntrada[]
): Promise<ResultadoDips> {
  const resultado: ResultadoDips = { salvos: 0, atualizados: 0, ignorados: 0, erros: [] };
  if (dips.length === 0) return resultado;

  const { existentes, cadastro } = await carregarContextoDips(supabase);

  for (const dip of dips) {
    const acao = dip.acao ?? "auto";
    const localidade = dip.localidade.trim();
    if (acao === "pular" || !localidade) {
      resultado.ignorados++;
      continue;
    }
    const pais = completarPais(localidade, dip.pais, cadastro);
    const observacoes = dip.observacoes.trim() || null;

    let alvoId: number | null = null;
    if (acao === "incrementar" && dip.dipId) alvoId = dip.dipId;
    else if (acao !== "criar") {
      alvoId = encontrarDipExistente({ localidade, pais, data: dip.data }, existentes)?.id ?? null;
    }

    if (alvoId !== null) {
      const { error } = await supabase.rpc("mesclar_dip_da_ata", {
        p_dip_id: alvoId,
        p_participantes: dip.participantes,
        p_observacoes: observacoes,
        p_data: dip.data,
        p_pais: pais || null,
      });
      if (error) {
        console.error("salvarDipsDaAta: merge failed", error);
        resultado.erros.push(mensagemErro(localidade, error));
      } else {
        resultado.atualizados++;
      }
      continue;
    }

    if (!pais) {
      resultado.erros.push(
        `${localidade}: país não informado (cadastre a localidade em Dinâmica DIP ou preencha o país)`
      );
      continue;
    }

    const { data: criado, error } = await supabase
      .from("dips")
      .insert({
        ata_id: ataId,
        localidade,
        pais,
        data_dip: dip.data,
        participantes: dip.participantes,
        observacoes,
      })
      .select("id")
      .single();
    if (error || !criado) {
      console.error("salvarDipsDaAta: insert failed", error);
      resultado.erros.push(mensagemErro(localidade, error ?? {}));
      continue;
    }
    resultado.salvos++;
    // Menções repetidas na mesma ata passam a mesclar neste registro novo.
    existentes.push({ id: criado.id, localidade, pais, data_dip: dip.data });
  }

  return resultado;
}
