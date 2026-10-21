// src/lib/contratos/aluno.ts
// Dados do aluno usados nos contratos: tipo compartilhado entre o formulário
// individual, o lote em massa e a geração do PDF, + validação/formatação de
// CPF, telefone e data. Funções puras (usadas no cliente e no servidor).

export type AlunoContrato = {
  nome: string;
  email: string;
  documento: string;
  telefone: string;
  rg: string;
  /** dd/mm/aaaa ou aaaa-mm-dd */
  nascimento: string;
  endereco: string;
  nacionalidade: string;
  estadoCivil: string;
  profissao: string;
};

export const ALUNO_VAZIO: AlunoContrato = {
  nome: "",
  email: "",
  documento: "",
  telefone: "",
  rg: "",
  nascimento: "",
  endereco: "",
  nacionalidade: "",
  estadoCivil: "",
  profissao: "",
};

export const ALUNO_CAMPOS: Array<{ campo: keyof AlunoContrato; label: string }> = [
  { campo: "nome", label: "Nome completo" },
  { campo: "documento", label: "CPF" },
  { campo: "rg", label: "RG" },
  { campo: "nascimento", label: "Nascimento" },
  { campo: "email", label: "E-mail" },
  { campo: "telefone", label: "Telefone" },
  { campo: "endereco", label: "Endereço completo" },
  { campo: "nacionalidade", label: "Nacionalidade" },
  { campo: "estadoCivil", label: "Estado civil" },
  { campo: "profissao", label: "Profissão" },
];

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** Valida CPF pelos dígitos verificadores. */
export function cpfValido(valor: string): boolean {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return (
    digito(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    digito(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

// ── Documento estrangeiro (aluno sem CPF) ──────────────────────────────
// Guardado no mesmo campo `documento`, já por extenso:
//   "Passaporte nº AB1234567 (Itália)"
// Ter letras é o que diferencia de um CPF.

export const TIPOS_DOCUMENTO_ESTRANGEIRO = [
  "Passaporte",
  "RNM/RNE",
  "Documento de identidade do país de origem",
] as const;

export function documentoEhEstrangeiro(documento: string): boolean {
  return /\p{L}/u.test(documento);
}

export function comporDocumentoEstrangeiro(tipo: string, numero: string, pais: string): string {
  const n = numero.replace(/\s+/g, " ").trim().toUpperCase();
  const p = pais.replace(/\s+/g, " ").trim();
  return `${tipo.trim()} nº ${n}${p ? ` (${p})` : ""}`;
}

function numeroDoDocumentoEstrangeiro(documento: string): string {
  const m = documento.match(/nº\s*([^()]+?)\s*(?:\(|$)/);
  return (m ? m[1] : documento).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Chave para achar duplicados: os 11 dígitos do CPF, ou "EST-" + número
 *  do documento estrangeiro (sem tipo/país, que podem ser escritos de
 *  jeitos diferentes pela mesma pessoa). */
export function chaveDocumento(documento: string): string {
  if (documentoEhEstrangeiro(documento)) return `EST-${numeroDoDocumentoEstrangeiro(documento)}`;
  return somenteDigitos(documento);
}

/** "04407126612" → "044.071.266-12"; outros formatos (RG, passaporte) ficam como vieram. */
export function formatarCpf(valor: string): string {
  if (documentoEhEstrangeiro(valor)) return valor.trim();
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11) return valor.trim();
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

/** "41995382020" → "(41) 99538-2020". */
export function formatarTelefone(valor: string): string {
  let tel = somenteDigitos(valor);
  if (tel.length > 11 && tel.startsWith("55")) tel = tel.slice(2);
  if (tel.length === 11) return `(${tel.slice(0, 2)}) ${tel.slice(2, 7)}-${tel.slice(7)}`;
  if (tel.length === 10) return `(${tel.slice(0, 2)}) ${tel.slice(2, 6)}-${tel.slice(6)}`;
  return valor.trim();
}

/** Aceita dd/mm/aaaa, d/m/aaaa ou aaaa-mm-dd; devolve aaaa-mm-dd ou null. */
export function dataParaIso(valor: string): string | null {
  const v = valor.trim();
  let a: number, m: number, d: number;
  const br = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (br) {
    [d, m, a] = [Number(br[1]), Number(br[2]), Number(br[3])];
  } else if (iso) {
    [a, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else {
    return null;
  }
  const data = new Date(Date.UTC(a, m - 1, d));
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== m - 1 || data.getUTCDate() !== d) {
    return null;
  }
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** aaaa-mm-dd → dd/mm/aaaa */
export function isoParaBr(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

const PARTICULAS = new Set(["da", "das", "de", "do", "dos", "e"]);

/** "MARIA DA SILVA" / "maria da silva" → "Maria da Silva". Nomes já com
 *  maiúsculas e minúsculas misturadas ficam como a pessoa escreveu. */
export function normalizarNome(nome: string): string {
  const limpo = nome.replace(/\s+/g, " ").trim();
  if (limpo !== limpo.toUpperCase() && limpo !== limpo.toLowerCase()) return limpo;
  return limpo
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

/** "andre.pedretti@gmail.com" → "an***@gmail.com" */
export function mascararEmail(email: string): string {
  const [usuario, dominio] = email.trim().split("@");
  if (!dominio) return email;
  return `${usuario.slice(0, 2)}***@${dominio}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailValido(valor: string): boolean {
  return EMAIL_RE.test(valor.trim());
}

/** Problemas que impedem o envio para assinatura (erros) e avisos que só
 *  merecem conferência. */
export function validarAluno(aluno: AlunoContrato): { erros: string[]; avisos: string[] } {
  const erros: string[] = [];
  const avisos: string[] = [];
  if (aluno.nome.trim().length < 3) erros.push("Nome obrigatório");
  else if (!aluno.nome.trim().includes(" ")) avisos.push("Nome sem sobrenome");
  if (!aluno.email.trim()) erros.push("E-mail obrigatório para assinar");
  else if (!emailValido(aluno.email)) erros.push("E-mail inválido");
  if (!aluno.documento.trim()) avisos.push("Sem CPF");
  else if (documentoEhEstrangeiro(aluno.documento)) {
    if (numeroDoDocumentoEstrangeiro(aluno.documento).length < 5) {
      erros.push("Documento estrangeiro incompleto");
    } else if (!/\(.+\)/.test(aluno.documento) && /nº/.test(aluno.documento)) {
      avisos.push("Documento estrangeiro sem país");
    }
  } else if (!cpfValido(aluno.documento)) erros.push("CPF inválido");
  if (aluno.nascimento.trim() && !dataParaIso(aluno.nascimento)) {
    erros.push("Nascimento inválido (use dd/mm/aaaa)");
  }
  if (aluno.telefone.trim()) {
    const n = somenteDigitos(aluno.telefone).replace(/^55(?=\d{10,11}$)/, "");
    if (n.length < 10 || n.length > 11) avisos.push("Telefone com DDD incompleto");
  }
  return { erros, avisos };
}
