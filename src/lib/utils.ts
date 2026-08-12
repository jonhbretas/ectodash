import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Escapa caracteres especiais do padrão ILIKE do PostgREST para prevenir
 * injeção de filtros via parâmetros de busca do usuário.
 *
 * O Supabase JS client NÃO escapa `%`, `_`, `(`, `)` em padrões ilike.
 * Sem esta sanitização, um atacante pode: retornar todos os registros (%),
 * quebrar a estrutura do filtro (), ou causar matching inesperado.
 */
export function sanitizeSearch(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "%%")
    .replace(/_/g, "\\_")
    .replace(/[()'"]/g, "")
    .trim()
}

/**
 * Sanitiza um nome para uso em Content-Disposition header (nomes de arquivo).
 * Remove caracteres que podem injetar headers HTTP (CRLF, aspas, etc).
 */
export function sanitizeFilename(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "")
    || "arquivo";
}
