import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";
import type { PautaPrioridade, PautaTipo, VotacaoStatus, VotoValor } from "@/lib/pautas/regras";

export type AtaRow = {
  id: number;
  titulo: string;
  data_reuniao: string;
  horario: string | null;
  status: string | null;
  resumo: string | null;
  participantes: string | null;
  deliberacoes: string | null;
  dipCount: number;
};

export type VotoPauta = {
  userId: string;
  nome: string;
  voto: VotoValor;
  comentario: string | null;
  atualizadoEm: string;
};

export type PautaRow = {
  id: number;
  titulo: string;
  contexto: string | null;
  status: "pendente" | "discutida";
  origem: "manual" | "ata";
  standBy: boolean;
  ataId: number | null;
  ataTitulo: string | null;
  ataDiscutidaId: number | null;
  ataDiscutidaTitulo: string | null;
  ataDiscutidaData: string | null;
  dataSolicitada: string | null;
  horarioSolicitado: string | null;
  reuniaoSelecionadaId: number | null;
  reuniaoSelecionadaTitulo: string | null;
  criadoPor: string;
  autor: string;
  createdAt: string;
  prioridade: PautaPrioridade;
  tipo: PautaTipo;
  anexoUrl: string | null;
  anexoNome: string | null;
  votacaoStatus: VotacaoStatus | null;
  quorumMinimo: number;
  votacaoEncerradaEm: string | null;
  votacaoEncerradaPorNome: string | null;
  votos: VotoPauta[];
};

/** Colunas de pautas lidas pela área de reuniões. ATENÇÃO: pautas tem 2 FKs
 * para profiles — todo embed usa o hint explícito (PGRST201 se ambíguo). */
export const PAUTAS_SELECT =
  "id, titulo, contexto, status, origem, stand_by, ata_id, ata_discutida_id, data_solicitada, horario_solicitado, reuniao_selecionada_id, criado_por, created_at, updated_at, prioridade, tipo, anexo_url, anexo_nome, quorum_minimo, votacao_status, votacao_encerrada_em, profiles!pautas_criado_por_fkey(full_name, email), encerrador:profiles!pautas_votacao_encerrada_por_fkey(full_name, email)";

export const PAUTA_VOTOS_SELECT =
  "pauta_id, user_id, voto, comentario, updated_at, profiles!pauta_votos_user_id_fkey(full_name, email)";

type PerfilEmbed = { full_name?: string | null; email?: string | null } | null | undefined;
const umPerfil = (v: unknown): PerfilEmbed =>
  (Array.isArray(v) ? v[0] : v) as PerfilEmbed;

type PautaDbRow = {
  id: number;
  titulo: string;
  contexto: string | null;
  status: "pendente" | "discutida";
  origem: "manual" | "ata";
  stand_by: boolean;
  ata_id: number | null;
  ata_discutida_id: number | null;
  data_solicitada: string | null;
  horario_solicitado: string | null;
  reuniao_selecionada_id: number | null;
  criado_por: string;
  created_at: string;
  prioridade: PautaPrioridade;
  tipo: PautaTipo;
  anexo_url: string | null;
  anexo_nome: string | null;
  quorum_minimo: number;
  votacao_status: VotacaoStatus | null;
  votacao_encerrada_em: string | null;
  profiles?: unknown;
  encerrador?: unknown;
};

type VotoDbRow = {
  pauta_id: number;
  user_id: string;
  voto: VotoValor;
  comentario: string | null;
  updated_at: string;
  profiles?: unknown;
};

/** Agrupa votos por pauta, já com o nome de quem votou. */
export function agruparVotos(rows: VotoDbRow[]): Map<number, VotoPauta[]> {
  const porPauta = new Map<number, VotoPauta[]>();
  for (const r of rows) {
    const perfil = umPerfil(r.profiles);
    const lista = porPauta.get(r.pauta_id) ?? [];
    lista.push({
      userId: r.user_id,
      nome: displayName({ full_name: perfil?.full_name ?? null, email: perfil?.email ?? null }),
      voto: r.voto,
      comentario: r.comentario,
      atualizadoEm: r.updated_at,
    });
    porPauta.set(r.pauta_id, lista);
  }
  return porPauta;
}

/** Converte linhas de pautas (+ votos agrupados) em PautaRow. */
export function mapearPautas(
  rows: PautaDbRow[],
  votosPorPauta: Map<number, VotoPauta[]>,
  ataById: Map<number, { titulo: string; data_reuniao: string }>
): PautaRow[] {
  const ataTitulo = (id: number | null): string | null =>
    id === null ? null : (ataById.get(id)?.titulo ?? null);
  return rows.map((row) => {
    const perfil = umPerfil(row.profiles);
    const encerrador = umPerfil(row.encerrador);
    return {
      id: row.id,
      titulo: row.titulo,
      contexto: row.contexto,
      status: row.status,
      origem: row.origem,
      standBy: row.stand_by,
      ataId: row.ata_id,
      ataTitulo: ataTitulo(row.ata_id),
      ataDiscutidaId: row.ata_discutida_id,
      ataDiscutidaTitulo: ataTitulo(row.ata_discutida_id),
      ataDiscutidaData: row.ata_discutida_id ? (ataById.get(row.ata_discutida_id)?.data_reuniao ?? null) : null,
      dataSolicitada: row.data_solicitada,
      horarioSolicitado: row.horario_solicitado,
      reuniaoSelecionadaId: row.reuniao_selecionada_id,
      reuniaoSelecionadaTitulo: ataTitulo(row.reuniao_selecionada_id),
      criadoPor: row.criado_por,
      autor: displayName({ full_name: perfil?.full_name ?? null, email: perfil?.email ?? null }),
      createdAt: row.created_at,
      prioridade: row.prioridade,
      tipo: row.tipo,
      anexoUrl: row.anexo_url,
      anexoNome: row.anexo_nome,
      votacaoStatus: row.votacao_status,
      quorumMinimo: row.quorum_minimo,
      votacaoEncerradaEm: row.votacao_encerrada_em,
      votacaoEncerradaPorNome: encerrador
        ? displayName({ full_name: encerrador.full_name ?? null, email: encerrador.email ?? null })
        : null,
      votos: votosPorPauta.get(row.id) ?? [],
    };
  });
}

export async function getReunioesData() {
  const supabase = await createClient();

  const [atasResult, dipsResult, pautasResult, votosResult] = await Promise.all([
    supabase.from("reunioes").select("id, titulo, data_reuniao, horario, status, resumo, participantes, deliberacoes").order("data_reuniao", { ascending: false }),
    supabase.from("dips").select("ata_id"),
    supabase.from("pautas").select(PAUTAS_SELECT).order("created_at", { ascending: true }),
    supabase.from("pauta_votos").select(PAUTA_VOTOS_SELECT),
  ]);

  const dipCountByAta = new Map<number, number>();
  for (const row of dipsResult.data ?? []) dipCountByAta.set(row.ata_id, (dipCountByAta.get(row.ata_id) ?? 0) + 1);

  const ataById = new Map<number, { titulo: string; data_reuniao: string }>();
  for (const row of atasResult.data ?? []) ataById.set(row.id, { titulo: row.titulo, data_reuniao: row.data_reuniao });

  const rows: AtaRow[] = (atasResult.data ?? []).map((row) => ({
    id: row.id,
    titulo: row.titulo,
    data_reuniao: row.data_reuniao,
    horario: row.horario,
    status: (row as { status?: string | null }).status ?? null,
    resumo: row.resumo,
    participantes: row.participantes,
    deliberacoes: row.deliberacoes,
    dipCount: dipCountByAta.get(row.id) ?? 0,
  }));

  const pautas = mapearPautas(
    (pautasResult.data ?? []) as unknown as PautaDbRow[],
    agruparVotos((votosResult.data ?? []) as unknown as VotoDbRow[]),
    ataById
  );

  return { rows, pautas, dipCountByAta };
}
