import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";

export type AtaRow = {
  id: number;
  titulo: string;
  data_reuniao: string;
  horario: string | null;
  resumo: string | null;
  participantes: string | null;
  deliberacoes: string | null;
  dipCount: number;
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
};

export async function getReunioesData(userId: string) {
  const supabase = await createClient();

  const [atasResult, dipsResult, pautasResult] = await Promise.all([
    supabase.from("reunioes").select("id, titulo, data_reuniao, horario, resumo, participantes, deliberacoes").order("data_reuniao", { ascending: false }),
    supabase.from("dips").select("ata_id"),
    supabase.from("pautas").select("id, titulo, contexto, status, origem, stand_by, ata_id, ata_discutida_id, data_solicitada, horario_solicitado, reuniao_selecionada_id, criado_por, created_at, updated_at, profiles(full_name, email)").order("created_at", { ascending: true }),
  ]);

  const dipCountByAta = new Map<number, number>();
  for (const row of dipsResult.data ?? []) dipCountByAta.set(row.ata_id, (dipCountByAta.get(row.ata_id) ?? 0) + 1);

  const ataById = new Map<number, { titulo: string; data_reuniao: string }>();
  for (const row of atasResult.data ?? []) ataById.set(row.id, { titulo: row.titulo, data_reuniao: row.data_reuniao });

  const ataTitulo = (id: number | null): string | null => (id === null ? null : (ataById.get(id)?.titulo ?? null));

  const rows: AtaRow[] = (atasResult.data ?? []).map((row) => ({
    id: row.id,
    titulo: row.titulo,
    data_reuniao: row.data_reuniao,
    horario: row.horario,
    resumo: row.resumo,
    participantes: row.participantes,
    deliberacoes: row.deliberacoes,
    dipCount: dipCountByAta.get(row.id) ?? 0,
  }));

  const pautas: PautaRow[] = (pautasResult.data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const ataDiscutidaData = row.ata_discutida_id ? (ataById.get(row.ata_discutida_id)?.data_reuniao ?? null) : null;
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
      ataDiscutidaData,
      dataSolicitada: row.data_solicitada,
      horarioSolicitado: row.horario_solicitado,
      reuniaoSelecionadaId: row.reuniao_selecionada_id,
      reuniaoSelecionadaTitulo: ataTitulo(row.reuniao_selecionada_id),
      criadoPor: row.criado_por,
      autor: displayName({ full_name: profile?.full_name ?? null, email: profile?.email ?? null }),
      createdAt: row.created_at,
    };
  });

  return { rows, pautas, dipCountByAta };
}
