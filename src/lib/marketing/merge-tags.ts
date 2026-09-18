// src/lib/marketing/merge-tags.ts
// Substitui merge tags estilo Mailchimp no HTML na hora do disparo,
// para templates importados não saírem com link/texto morto:
//   *|PRIMEIRO_NOME|* / *|FNAME|* → primeiro nome (ou "amigo(a)")
//   *|SOBRENOME|* / *|LNAME|*     → restante do nome (ou "")
//   *|EMAIL|*                     → e-mail do lead
//   *|UNSUB|*                     → URL real de descadastro
//   *|WEBVERSION|*                → "#" (não hospedamos versão web)
// Case-insensitive; tags desconhecidas são preservadas.
export interface MergeTagData {
  nome: string | null;
  email: string;
  unsubscribeUrl: string;
}

function firstName(nome: string | null): string {
  const first = (nome ?? "").trim().split(/\s+/)[0];
  return first || "amigo(a)";
}

function lastName(nome: string | null): string {
  const parts = (nome ?? "").trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

export function applyMergeTags(html: string, data: MergeTagData): string {
  const map: Record<string, string> = {
    "primeiro_nome": firstName(data.nome),
    "fname": firstName(data.nome),
    "sobrenome": lastName(data.nome),
    "lname": lastName(data.nome),
    "email": data.email,
    "unsub": data.unsubscribeUrl,
    "webversion": "#",
  };
  return html.replace(/\*\|([A-Za-z_]+)\|\*/g, (match, key: string) => {
    const hit = map[key.toLowerCase()];
    return hit === undefined ? match : hit;
  });
}
