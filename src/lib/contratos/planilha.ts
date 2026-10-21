// src/lib/contratos/planilha.ts
// Converte texto colado do Excel/Google Sheets (tabulação) ou um .csv
// (vírgula ou ponto e vírgula) em alunos para o lote de contratos.
// Com cabeçalho, as colunas são reconhecidas pelo nome ("CPF", "E-mail",
// "Endereço"...); sem cabeçalho, vale a ordem de ALUNO_CAMPOS.

import { ALUNO_CAMPOS, ALUNO_VAZIO, type AlunoContrato } from "./aluno";

type Campo = keyof AlunoContrato;

const SINONIMOS: Record<Campo, string[]> = {
  nome: ["nome", "nome completo", "aluno", "nome do aluno", "participante"],
  documento: ["cpf", "documento", "cpf do aluno"],
  rg: ["rg", "identidade", "documento de identidade"],
  nascimento: ["nascimento", "data de nascimento", "data nascimento", "dt nascimento"],
  email: ["email", "e-mail", "e mail", "correio eletronico"],
  telefone: ["telefone", "celular", "whatsapp", "fone", "tel"],
  endereco: ["endereco", "endereco completo", "logradouro", "morada"],
  nacionalidade: ["nacionalidade"],
  estadoCivil: ["estado civil", "estadocivil"],
  profissao: ["profissao", "ocupacao"],
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_:.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function campoDoCabecalho(celula: string): Campo | null {
  const n = normalizar(celula);
  for (const [campo, nomes] of Object.entries(SINONIMOS) as Array<[Campo, string[]]>) {
    if (nomes.includes(n)) return campo;
  }
  return null;
}

function detectarSeparador(linha: string): string {
  if (linha.includes("\t")) return "\t";
  const pv = (linha.match(/;/g) ?? []).length;
  const v = (linha.match(/,/g) ?? []).length;
  return pv >= v && pv > 0 ? ";" : ",";
}

/** Divide o texto em linhas/células respeitando aspas (CSV). */
function tabular(texto: string, sep: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        celula += '"';
        i++;
      } else if (c === '"') {
        aspas = false;
      } else {
        celula += c;
      }
    } else if (c === '"' && celula.trim() === "") {
      aspas = true;
      celula = "";
    } else if (c === sep) {
      linha.push(celula);
      celula = "";
    } else if (c === "\n") {
      linha.push(celula);
      linhas.push(linha);
      linha = [];
      celula = "";
    } else if (c !== "\r") {
      celula += c;
    }
  }
  linha.push(celula);
  linhas.push(linha);
  return linhas
    .map((l) => l.map((c) => c.replace(/\s+/g, " ").trim()))
    .filter((l) => l.some(Boolean));
}

export type ResultadoPlanilha = {
  alunos: AlunoContrato[];
  /** Colunas reconhecidas, na ordem da planilha (null = ignorada). */
  colunas: Array<Campo | null>;
  comCabecalho: boolean;
};

export function lerPlanilha(texto: string): ResultadoPlanilha {
  const limpo = texto.replace(/^﻿/, "").trim();
  if (!limpo) return { alunos: [], colunas: [], comCabecalho: false };

  const primeiraLinha = limpo.split("\n")[0];
  const linhas = tabular(limpo, detectarSeparador(primeiraLinha));

  const cabecalho = linhas[0].map(campoDoCabecalho);
  const comCabecalho = cabecalho.filter(Boolean).length >= 2 || cabecalho[0] === "nome";
  const colunas: Array<Campo | null> = comCabecalho
    ? cabecalho
    : linhas[0].map((_, i) => ALUNO_CAMPOS[i]?.campo ?? null);

  const alunos = (comCabecalho ? linhas.slice(1) : linhas).map((celulas) => {
    const aluno: AlunoContrato = { ...ALUNO_VAZIO };
    colunas.forEach((campo, i) => {
      if (campo && celulas[i] && !aluno[campo]) aluno[campo] = celulas[i];
    });
    return aluno;
  });

  return { alunos: alunos.filter((a) => Object.values(a).some(Boolean)), colunas, comCabecalho };
}
