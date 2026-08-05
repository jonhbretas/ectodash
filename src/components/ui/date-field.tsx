"use client";

// Campo de data no formato brasileiro dd/mm/aaaa — o <input type="date">
// nativo exibe conforme o locale do navegador (muitas vezes mm/dd/aaaa).
// Máscara simples de dígitos; o valor ISO (yyyy-mm-dd) vai num hidden
// input com o mesmo `name`, então server actions continuam lendo
// formData.get(name) normalmente.
import { useState } from "react";

function isoParaBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function brParaIso(texto: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

export default function DateFieldBr({
  name,
  defaultValue,
  className,
  placeholder = "dd/mm/aaaa",
  required = false,
}: {
  name: string;
  defaultValue?: string | null;
  className?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [texto, setTexto] = useState(isoParaBr(defaultValue ?? ""));

  function aoMudar(raw: string) {
    const digitos = raw.replace(/\D/g, "").slice(0, 8);
    let formatado = digitos;
    if (digitos.length > 4) {
      formatado = `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
    } else if (digitos.length > 2) {
      formatado = `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
    }
    setTexto(formatado);
  }

  return (
    <>
      <input
        value={texto}
        onChange={(e) => aoMudar(e.target.value)}
        inputMode="numeric"
        placeholder={placeholder}
        required={required}
        className={className}
      />
      <input type="hidden" name={name} value={brParaIso(texto)} />
    </>
  );
}
