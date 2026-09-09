/**
 * EctoDash — pós-filtro determinístico (custo zero, roda no servidor)
 */

export function normalizeTexto(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function preprocessarTranscricao(bruto: string): string {
  const linhas = bruto.split('\n');
  const saida: string[] = [];
  let dentroDeHighlights = false;
  const RUIDO =
    /^(boa noite|bom dia|boa tarde|oi+|ol[aá]|tchau|obrigad[oa]|valeu|beleza|t[aá] joia|ok|sim|n[aã]o|é|isso|certo|pode ir|vamos|t[aá]|a[ií]|show de bola|perfeito|combinado|entendi)[\s.!?]*$/i;
  for (const linha of linhas) {
    const t = linha.trim();
    if (/^#{1,3}\s*Highlights/i.test(t)) {
      dentroDeHighlights = true;
      continue;
    }
    if (/^#{1,3}\s*Transcript/i.test(t)) {
      dentroDeHighlights = false;
      saida.push(t);
      continue;
    }
    if (dentroDeHighlights) continue;
    if (/^#\s/.test(t) || /^(Meeting started|Duration|Participants):/i.test(t)) {
      saida.push(t);
      continue;
    }
    const m = t.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+([^:]{2,60}):\s*(.*)$/);
    if (!m) {
      if (t) saida.push(t);
      continue;
    }
    const [, ts, falante, falaBruta] = m;
    const fala = colapsarRepeticoes(falaBruta);
    if (!fala || RUIDO.test(fala)) continue;
    if (normalizeTexto(fala).split(' ').length < 3) continue;
    saida.push(ts + ' ' + falante + ': ' + fala);
  }
  return saida.join('\n');
}

function colapsarRepeticoes(fala: string): string {
  const partes = fala.split(/(?<=[.?!])\s+/).map((p) => p.trim()).filter(Boolean);
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const p of partes) {
    const chave = normalizeTexto(p);
    if (chave.length > 12 && vistas.has(chave)) continue;
    vistas.add(chave);
    out.push(p);
  }
  return out.join(' ').trim();
}

type ItemBase = {
  titulo?: string;
  descricao?: string;
  responsavel?: string | null;
  prazo?: string | null;
  evidencia?: string;
  timestamp?: string;
  [k: string]: unknown;
};

export type Descartado = { lista: string; item: ItemBase; motivo: string };

const HEDGE =
  /\b(vamos ver|a gente v[eê]|ver depois|olhar isso|seria interessante|seria bom|talvez|quem sabe|pensar (em|sobre)|avaliar a possibilidade|estudar a possibilidade|poderia ser|podia ser|quem puder|algu[eé]m poderia)\b/i;

const RESPONSAVEL_INVALIDO =
  /^(a definir|indefinido|equipe|time|todos|grupo|coordena[cç][aã]o|n\/a|-|)$/i;

const VERBO_ACAO =
  /\b(enviar|envie|mandar|atualizar|criar|excluir|remover|preparar|passar|divulgar|marcar|revisar|fechar|montar|corrigir|ajustar|publicar|agendar|verificar|entrar em contato)\b/i;

function evidenciaSustentada(evidencia: string | undefined, fonteNorm: string): boolean {
  if (!evidencia || evidencia.trim().length < 20) return false;
  const alvo = normalizeTexto(evidencia);
  if (alvo.length < 15) return false;
  if (fonteNorm.includes(alvo)) return true;
  const palavras = alvo.split(' ').filter((w) => w.length > 3);
  if (palavras.length < 4) return false;
  const encontradas = palavras.filter((w) => fonteNorm.includes(w)).length;
  return encontradas / palavras.length >= 0.85;
}

function forcaDemanda(d: ItemBase): number {
  let s = 0;
  if (d.responsavel && !RESPONSAVEL_INVALIDO.test(String(d.responsavel).trim())) s += 3;
  if (d.prazo) s += 2;
  if (VERBO_ACAO.test(String(d.titulo ?? ''))) s += 1;
  if (HEDGE.test(String(d.titulo ?? '') + ' ' + String(d.descricao ?? ''))) s -= 3;
  return s;
}

export function filtrarResultado(
  json: Record<string, any>,
  transcricaoFonte: string,
  opts: { maxDemandas?: number } = {},
): { resultado: Record<string, any>; descartados: Descartado[] } {
  const maxDemandas = opts.maxDemandas ?? 7;
  const fonteNorm = normalizeTexto(transcricaoFonte);
  const descartados: Descartado[] = [];
  const out: Record<string, any> = { ...json };

  // Normaliza: deliberacoes/pontos dentro de ata também precisam de evidência — promovemos para filtro
  const ataDeliberacoes = Array.isArray((out.ata as any)?.deliberacoes) ? (out.ata as any).deliberacoes : null;
  const ataPontos = Array.isArray((out.ata as any)?.pontos_principais) ? (out.ata as any).pontos_principais : null;

  const LISTAS = ['demandas', 'eventos', 'dips', 'atualizacoes', 'pautas'];

  for (const lista of LISTAS) {
    if (!Array.isArray(out[lista])) continue;
    out[lista] = (out[lista] as ItemBase[]).filter((item) => {
      if (evidenciaSustentada(item.evidencia, fonteNorm)) return true;
      descartados.push({ lista, item, motivo: 'evidência não encontrada na transcrição' });
      return false;
    });
  }

  // Filtra também ata.deliberacoes se forem objetos com evidencia
  if (ataDeliberacoes && Array.isArray(ataDeliberacoes) && ataDeliberacoes.length > 0 && typeof ataDeliberacoes[0] === 'object') {
    const filtradas = (ataDeliberacoes as ItemBase[]).filter((item) => {
      if (evidenciaSustentada(item.evidencia, fonteNorm)) return true;
      descartados.push({ lista: 'deliberacoes', item, motivo: 'evidência não encontrada na transcrição' });
      return false;
    });
    (out.ata as any).deliberacoes = filtradas;
  }

  if (Array.isArray(out.dips)) {
    out.dips = (out.dips as any[]).filter((d) => {
      const temNumero = ['participantes', 'epicons', 'voluntarios', 'pedidos_paracirurgia'].some((k) => typeof d[k] === 'number' && d[k] > 0);
      if (temNumero) return true;
      descartados.push({ lista: 'dips', item: d, motivo: 'registro de DIP sem nenhum número reportado' });
      return false;
    });
  }

  if (Array.isArray(out.demandas)) {
    const mantidas: ItemBase[] = [];
    for (const d of out.demandas as ItemBase[]) {
      const semResp = !d.responsavel || RESPONSAVEL_INVALIDO.test(String(d.responsavel).trim());
      if (semResp) {
        descartados.push({ lista: 'demandas', item: d, motivo: 'sem responsável nomeado' });
        continue;
      }
      if (HEDGE.test(String(d.titulo ?? '') + ' ' + String(d.descricao ?? '')) && !d.prazo) {
        out.pautas = Array.isArray(out.pautas) ? out.pautas : [];
        (out.pautas as any[]).push({
          titulo: d.titulo,
          motivo: 'intenção sem prazo definido (rebaixada de demanda)',
          evidencia: d.evidencia,
          timestamp: d.timestamp,
        });
        continue;
      }
      mantidas.push(d);
    }
    mantidas.sort((a, b) => forcaDemanda(b) - forcaDemanda(a));
    if (mantidas.length > maxDemandas) {
      for (const excedente of mantidas.slice(maxDemandas)) {
        descartados.push({ lista: 'demandas', item: excedente, motivo: 'excedeu o limite de ' + maxDemandas });
      }
    }
    out.demandas = mantidas.slice(0, maxDemandas);
  }

  const dedupListas = [...LISTAS, 'deliberacoes'];
  for (const lista of dedupListas) {
    const arr = lista === 'deliberacoes' ? (out.ata as any)?.deliberacoes : out[lista];
    if (!Array.isArray(arr)) continue;
    const vistos = new Set<string>();
    const filtrado = (arr as ItemBase[]).filter((item) => {
      const chave = normalizeTexto(String((item as any).titulo ?? (item as any).nome ?? item.descricao ?? JSON.stringify(item)));
      if (vistos.has(chave)) {
        descartados.push({ lista, item, motivo: 'duplicado' });
        return false;
      }
      vistos.add(chave);
      return true;
    });
    if (lista === 'deliberacoes') (out.ata as any).deliberacoes = filtrado;
    else out[lista] = filtrado;
  }

  return { resultado: out, descartados };
}
