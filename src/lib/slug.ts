// src/lib/slug.ts
// URL-safe slug from a display name: lowercase, accents stripped,
// non-alphanumeric runs collapsed to a single hyphen. Used to turn
// localidades ("São Paulo") into stable page paths ("sao-paulo").
export function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
