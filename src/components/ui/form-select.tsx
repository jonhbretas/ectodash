"use client";

// Dropdowns padrão do app, construídos sobre o Radix Select (mesmo popover
// estilizado dos filtros — o popup nativo do navegador não respeitava
// cores/tamanhos/fontes do box).
//
// FormSelect  — select fechado; opcionalmente grava o valor num hidden
//               input com `name`, então server actions continuam lendo
//               formData.get(name) como nos <select> nativos.
// FormCombobox — select + opção "Outro (digitar)..." que revela um input
//               de texto livre (substitui os <datalist>, cujo popup também
//               era nativo e não estilizável). O texto atual é preservado:
//               se não está nas opções, o combobox abre no modo "Outro".
import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Mesmo visual dos inputs do app (min-h-14, rounded-xl, border, text-lg).
export const formSelectTriggerClass =
  "min-h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 text-lg text-zinc-900 shadow-none transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] focus-visible:ring-0 data-placeholder:text-zinc-500";

const itemClass = "rounded-lg py-2.5 text-lg data-[highlighted]:bg-zinc-100";

// Item sentinela do estado vazio — o Radix exige um item correspondente ao
// valor controlado; selecioná-lo devolve "" (placeholder).
export const FORM_SELECT_VAZIO = "__vazio__";
export const FORM_COMBOBOX_OUTRO = "__outro__";

export function FormSelect({
  name,
  value,
  onValueChange,
  placeholder,
  ariaLabel,
  className,
  options,
  children,
}: {
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  options?: { value: string; label: string }[];
  children?: React.ReactNode;
}) {
  const atual = value === "" ? FORM_SELECT_VAZIO : value;

  return (
    <>
      <Select
        value={atual}
        onValueChange={(v) => onValueChange(v === FORM_SELECT_VAZIO ? "" : v)}
      >
        <SelectTrigger
          aria-label={ariaLabel}
          className={cn(formSelectTriggerClass, className)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="text-lg">
          {placeholder && (
            <SelectItem
              value={FORM_SELECT_VAZIO}
              className={cn(itemClass, "text-zinc-500")}
            >
              {placeholder}
            </SelectItem>
          )}
          {options
            ? options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className={itemClass}
                >
                  {option.label}
                </SelectItem>
              ))
            : children}
        </SelectContent>
      </Select>
      {name && <input type="hidden" name={name} value={value} />}
    </>
  );
}

export function FormCombobox({
  name,
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  className,
  customLabel = "Outro (digitar)...",
}: {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  customLabel?: string;
}) {
  const [digitando, setDigitando] = useState<boolean>(
    () => value.trim() !== "" && !options.includes(value)
  );
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (digitando) inputRef.current?.focus(); }, [digitando]);

  const atual = digitando
    ? FORM_COMBOBOX_OUTRO
    : value !== ""
      ? value
      : FORM_SELECT_VAZIO;

  function aoEscolher(escolha: string) {
    if (escolha === FORM_COMBOBOX_OUTRO) {
      setDigitando(true);
      onChange("");
      return;
    }
    setDigitando(false);
    onChange(escolha === FORM_SELECT_VAZIO ? "" : escolha);
  }

  return (
    <>
      <Select value={atual} onValueChange={aoEscolher}>
        <SelectTrigger
          aria-label={ariaLabel}
          className={cn(formSelectTriggerClass, className)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="text-lg">
          {placeholder && (
            <SelectItem
              value={FORM_SELECT_VAZIO}
              className={cn(itemClass, "text-zinc-500")}
            >
              {placeholder}
            </SelectItem>
          )}
          {options.map((option) => (
            <SelectItem key={option} value={option} className={itemClass}>
              {option}
            </SelectItem>
          ))}
          <SelectItem
            value={FORM_COMBOBOX_OUTRO}
            className={cn(itemClass, "font-medium text-[#2195B9]")}
          >
            {customLabel}
          </SelectItem>
        </SelectContent>
      </Select>

      {digitando && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#E6E6E6] bg-[#E6E6E6]/50 px-3 py-2">
          <Pencil size={16} className="shrink-0 text-[#2195B9]" aria-hidden="true" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Digite o valor"
            className="min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-lg text-zinc-900 outline-none focus:ring-2 focus:ring-[#2195B9]"
          />
        </div>
      )}

      {name && <input type="hidden" name={name} value={value} />}
    </>
  );
}
