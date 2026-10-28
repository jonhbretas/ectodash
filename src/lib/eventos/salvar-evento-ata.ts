import type { SupabaseClient } from "@supabase/supabase-js";
import { mesclarInformacoesEvento, normalizarNomeEvento, type EventoDaAta, type EventoCadastrado } from "./duplicados-ata";

/** Percorre a base inteira; o limite padrão da API não pode ocultar duplicados antigos. */
export async function listarEventosParaConferencia(supabase: SupabaseClient) {
  const eventos: EventoCadastrado[] = [];
  for (let inicio = 0; ; inicio += 500) {
    const { data, error } = await supabase.from("eventos")
      .select("id, titulo, data_evento, local, descricao").order("id").range(inicio, inicio + 499);
    if (error) return { data: null, error };
    eventos.push(...(data ?? []));
    if (!data || data.length < 500) return { data: eventos, error: null };
  }
}

/** Mantém RLS, relê o card na hora de salvar e protege o histórico de atualizações simultâneas. */
export async function salvarEventoDaAta(
  supabase: SupabaseClient,
  novo: Omit<EventoDaAta, "key">,
  opcoes: { eventoId?: number | null; criarMesmoAssim?: boolean; ataId?: number | null; fonte: string },
): Promise<{ id: number; atualizado: boolean }> {
  let eventoId = opcoes.eventoId;
  if (!eventoId && !opcoes.criarMesmoAssim) {
    const { data, error } = await supabase.from("eventos")
      .select("id, titulo, local").eq("data_evento", novo.data);
    if (error) throw new Error("Não foi possível conferir se o evento já existe.");
    eventoId = data?.find((evento) => normalizarNomeEvento(evento.titulo) === normalizarNomeEvento(novo.titulo) &&
      (!novo.local || !evento.local || normalizarNomeEvento(novo.local) === normalizarNomeEvento(evento.local)))?.id;
  }
  if (eventoId) {
    const { data: existente, error: leitura } = await supabase.from("eventos")
      .select("id, titulo, data_evento, local, descricao, updated_at").eq("id", eventoId).single();
    if (leitura || !existente) throw new Error("Evento a mesclar não encontrado ou sem acesso.");
    const campos = mesclarInformacoesEvento(existente, novo, opcoes.fonte);
    const { data, error } = await supabase.from("eventos").update(campos)
      .eq("id", eventoId).eq("updated_at", existente.updated_at).select("id").maybeSingle();
    if (error || !data) throw new Error("Não foi possível mesclar o evento. Ele pode ter sido alterado por outra pessoa; revise e tente novamente.");
    return { id: data.id, atualizado: true };
  }
  const { data, error } = await supabase.from("eventos").insert({
    titulo: novo.titulo, data_evento: novo.data, local: novo.local, descricao: novo.descricao,
    ...(opcoes.ataId ? { origem_ata_id: opcoes.ataId } : {}),
  }).select("id").single();
  if (error || !data) throw new Error("Não foi possível criar o evento.");
  return { id: data.id, atualizado: false };
}
