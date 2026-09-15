// src/lib/telefone.ts
// Normalização única de telefone para link de WhatsApp (wa.me exige só
// dígitos + DDI). Antes cada tela fazia de um jeito: o cartão "Meu cadastro"
// usava os dígitos crus (número local gerava link sem DDI, inválido) e o
// detalhe prefixava "55" cegamente (quebrava internacionais como +1/+49).
//
// Regra:
//   - já com DDI 55 (12-13 dígitos começando com 55) -> mantém;
//   - 10-11 dígitos (BR sem DDI, com ou sem 9 extra) -> prefixa 55;
//   - demais tamanhos (internacional, ramal curto) -> usa como está;
//   - < 8 dígitos -> null (não linkável).

export function telefoneParaWhatsApp(phone: string): string | null {
  let digitos = phone.replace(/\D/g, "");
  if (digitos.length < 8) return null;
  // Prefixo internacional "00" (ex.: 00351...) -> DDI direto.
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  if (digitos.startsWith("55") && digitos.length > 11) return digitos;
  if (digitos.length === 11) {
    // Celular BR sem DDI: DD 11-99 + 9 + 8 dígitos. Internacional de 11
    // dígitos (ex.: EUA +1) não tem 9 na terceira posição -> mantém.
    const ddd = Number(digitos.slice(0, 2));
    if (ddd >= 11 && ddd <= 99 && digitos[2] === "9") return `55${digitos}`;
    return digitos;
  }
  if (digitos.length === 10) {
    const ddd = Number(digitos.slice(0, 2));
    if (ddd >= 11 && ddd <= 99) return `55${digitos}`;
    return digitos;
  }
  return digitos;
}

export function linkWhatsApp(phone: string): string | null {
  const normalizado = telefoneParaWhatsApp(phone);
  return normalizado ? `https://wa.me/${normalizado}` : null;
}

// Formatação curta para exibição em listas. Só formata quando reconhece
// padrão BR (evita "traduzir" internacional como BR: EUA +1 tem 11 dígitos
// mas o terceiro não é 9 de celular).
export function formatarTelefone(phone: string): string {
  const digitos = phone.replace(/\D/g, "");
  let base: string | null = null;
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) {
    base = digitos.slice(2);
  } else if (digitos.length === 11) {
    const ddd = Number(digitos.slice(0, 2));
    if (ddd >= 11 && ddd <= 99 && digitos[2] === "9") base = digitos;
  } else if (digitos.length === 10) {
    const ddd = Number(digitos.slice(0, 2));
    if (ddd >= 11 && ddd <= 99) base = digitos;
  }
  if (!base) return phone;
  if (base.length === 10) return `(${base.slice(0, 2)}) ${base.slice(2, 6)}-${base.slice(6)}`;
  return `(${base.slice(0, 2)}) ${base.slice(2, 7)}-${base.slice(7)}`;
}
