export const CAMPOS_CONSULTA = {
  titulo: "Título",
  resumo: "Resumo",
  participantes: "Participantes",
  pontos_principais: "Assuntos principais",
  deliberacoes: "Deliberações",
  decisoes: "Decisões",
  calendario: "Calendário",
  observacoes: "Observações",
  conducao: "Condução",
  proxima_reuniao: "Próxima reunião",
  saidas_antecipadas: "Saídas antecipadas",
  texto: "Texto original",
} as const;

export type CampoConsulta = keyof typeof CAMPOS_CONSULTA;
export type AtaConsulta = {
  id: number;
  data_reuniao: string;
} & Record<CampoConsulta, string | null>;

/** Some sections are JSON arrays/objects; search their values as readable text. */
export function textoCampoConsulta(valor: unknown): string {
  if (valor == null) return "";
  if (Array.isArray(valor)) return valor.map(textoCampoConsulta).filter(Boolean).join("\n");
  if (typeof valor === "object") return Object.values(valor).map(textoCampoConsulta).filter(Boolean).join(" · ");
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return `${valor.split("-").reverse().join("/")} (${valor})`;
  return String(valor);
}

export function mapearAtaConsulta(row: { id: number; data_reuniao: string } & Record<CampoConsulta, unknown>): AtaConsulta {
  return {
    id: row.id,
    data_reuniao: row.data_reuniao,
    ...Object.fromEntries(Object.keys(CAMPOS_CONSULTA).map((campo) => [campo, textoCampoConsulta(row[campo as CampoConsulta])])),
  } as AtaConsulta;
}

export function normalizarConsulta(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function termosConsulta(busca: string) {
  return normalizarConsulta(busca).trim().split(/\s+/).filter(Boolean);
}

export type ModoCorrespondencia = "palavras" | "pessoa" | "expressao";

export function posicoesConsulta(texto: string, busca: string, modo: ModoCorrespondencia = "palavras") {
  const normalizado = normalizarConsulta(texto);
  const termos = modo !== "palavras" ? [normalizarConsulta(busca).trim().replace(/\s+/g, " ")].filter(Boolean) : termosConsulta(busca);
  const posicoes: { inicio: number; fim: number }[] = [];
  for (const termo of termos) {
    let inicio = normalizado.indexOf(termo);
    while (inicio >= 0) {
      const fim = inicio + termo.length;
      const letra = /[\p{L}\p{N}_]/u;
      if (modo === "palavras" || (!letra.test(normalizado[inicio - 1] ?? "") && !letra.test(normalizado[fim] ?? ""))) posicoes.push({ inicio, fim });
      inicio = normalizado.indexOf(termo, fim);
    }
  }
  return posicoes.sort((a, b) => a.inicio - b.inicio || b.fim - a.fim);
}

export function trechosConsulta(texto: string, busca: string, modo: ModoCorrespondencia = "palavras") {
  const limpo = texto.normalize("NFC").replace(/\s+/g, " ").trim();
  const posicoes = posicoesConsulta(limpo, busca, modo);
  const janelas: { inicio: number; fim: number }[] = [];
  for (const posicao of posicoes) {
    const inicio = Math.max(0, posicao.inicio - 80);
    const fim = Math.min(limpo.length, posicao.fim + 180);
    const anterior = janelas.at(-1);
    if (anterior && inicio <= anterior.fim) anterior.fim = Math.max(anterior.fim, fim);
    else janelas.push({ inicio, fim });
  }
  return janelas.map(({ inicio, fim }) => `${inicio ? "…" : ""}${limpo.slice(inicio, fim)}${fim < limpo.length ? "…" : ""}`);
}

export function consultarAtas(atas: AtaConsulta[], busca: string, inicio: string, fim: string, campo: CampoConsulta | "todos", modo: ModoCorrespondencia = "palavras") {
  const termos = termosConsulta(busca);
  if (inicio && fim && inicio > fim) return [];
  const campos = campo === "todos" ? Object.keys(CAMPOS_CONSULTA) as CampoConsulta[] : [campo];
  return atas.flatMap((ata) => {
    if ((inicio && ata.data_reuniao < inicio) || (fim && ata.data_reuniao > fim)) return [];
    const dataBR = ata.data_reuniao.split("-").reverse().join("/");
    const secoes = campos.map((chave) => ({ campo: chave, texto: ata[chave] ?? "" }));
    const textoCompleto = normalizarConsulta([ata.data_reuniao, dataBR, ...secoes.map((s) => s.texto)].join(" "));
    if (modo !== "palavras" && termos.length) {
      const textos = secoes.map((s) => s.texto);
      if (modo === "expressao") textos.push(ata.data_reuniao, dataBR);
      if (!textos.some((texto) => posicoesConsulta(texto.replace(/\s+/g, " "), busca, modo).length)) return [];
    } else if (!termos.every((termo) => textoCompleto.includes(termo))) return [];
    const correspondencias = secoes.filter((s) => s.texto.trim() && posicoesConsulta(s.texto.replace(/\s+/g, " "), busca, modo).length);
    return [{ ata, correspondencias: termos.length ? correspondencias : secoes.filter((s) => s.texto.trim() && s.campo !== "titulo").slice(0, 2) }];
  });
}

/** Preserve original accents and character positions when building excerpts. */
export function trechoConsulta(texto: string, busca: string) {
  const termos = termosConsulta(busca);
  const limpo = texto.replace(/\s+/g, " ").trim();
  const normalizado = normalizarConsulta(limpo);
  const posicoes = termos.map((termo) => normalizado.indexOf(termo)).filter((p) => p >= 0);
  const posicao = posicoes.length ? Math.min(...posicoes) : 0;
  const inicio = Math.max(0, posicao - 80);
  const fim = Math.min(limpo.length, Math.max(inicio + 300, posicao + (termos.find((t) => normalizado.indexOf(t) === posicao)?.length ?? 0)));
  return `${inicio ? "…" : ""}${limpo.slice(inicio, fim)}${fim < limpo.length ? "…" : ""}`;
}
