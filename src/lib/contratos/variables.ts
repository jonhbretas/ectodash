// src/lib/contratos/variables.ts
// Catálogo de variáveis substituíveis nos modelos de contrato + função de
// renderização. Os textos dos modelos usam {{token}}; ao gerar o contrato,
// cada token é trocado pelo valor real (aluno, evento, contrato).

export type ContratoVariavel = {
  token: string;
  label: string;
  grupo: "Aluno" | "Evento" | "Contrato";
};

export const CONTRATO_VARIAVEIS: ContratoVariavel[] = [
  { token: "{{aluno_nome}}", label: "Nome completo do aluno", grupo: "Aluno" },
  { token: "{{aluno_email}}", label: "E-mail do aluno", grupo: "Aluno" },
  { token: "{{aluno_documento}}", label: "CPF/RG do aluno", grupo: "Aluno" },
  { token: "{{aluno_telefone}}", label: "Telefone do aluno", grupo: "Aluno" },
  { token: "{{evento_titulo}}", label: "Título do evento/atividade", grupo: "Evento" },
  { token: "{{evento_data}}", label: "Data do evento (dd/mm/aaaa)", grupo: "Evento" },
  { token: "{{evento_local}}", label: "Local do evento", grupo: "Evento" },
  { token: "{{evento_descricao}}", label: "Descrição do evento", grupo: "Evento" },
  { token: "{{valor}}", label: "Valor (ex.: R$ 120,00)", grupo: "Contrato" },
  { token: "{{data_emissao}}", label: "Data de emissão do contrato", grupo: "Contrato" },
  { token: "{{modelo_titulo}}", label: "Título do modelo", grupo: "Contrato" },
];

export function variaveisPorGrupo(): Record<"Aluno" | "Evento" | "Contrato", ContratoVariavel[]> {
  return {
    Aluno: CONTRATO_VARIAVEIS.filter((v) => v.grupo === "Aluno"),
    Evento: CONTRATO_VARIAVEIS.filter((v) => v.grupo === "Evento"),
    Contrato: CONTRATO_VARIAVEIS.filter((v) => v.grupo === "Contrato"),
  };
}

export const CONTRATO_CATEGORIAS = [
  { valor: "curso", label: "Contrato de curso" },
  { valor: "evento", label: "Contrato por evento" },
  { valor: "cessao_imagem", label: "Termo de cessão de imagem" },
  { valor: "consentimento", label: "Termo de consentimento" },
  { valor: "outro", label: "Outro" },
] as const;

export function categoriaLabel(categoria: string): string {
  return CONTRATO_CATEGORIAS.find((c) => c.valor === categoria)?.label ?? categoria;
}

/** Troca cada {{token}} conhecido pelo valor fornecido. Tokens desconhecidos
 *  (ou sem valor) permanecem no texto — o coordenador vê o que faltou. */
export function aplicarVariaveis(
  texto: string,
  valores: Record<string, string>
): string {
  let resultado = texto;
  for (const variavel of CONTRATO_VARIAVEIS) {
    const valor = valores[variavel.token];
    if (valor !== undefined && valor !== null && valor.trim() !== "") {
      resultado = resultado.split(variavel.token).join(valor.trim());
    }
  }
  return resultado;
}
