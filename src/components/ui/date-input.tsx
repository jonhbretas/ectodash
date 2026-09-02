"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function isoToBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function brToIso(texto: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

interface DateInputProps extends Omit<React.ComponentProps<"input">, "type"> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Quando false, esconde o botão de calendário (útil para casos sem picker). */
  showCalendarPicker?: boolean;
}

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, value, onChange, placeholder = "dd/mm/aaaa", showCalendarPicker = true, ...props }, ref) => {
    const [displayText, setDisplayText] = React.useState(() =>
      value ? isoToBr(value) : ""
    );
    const nativeRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
      if (value !== undefined) {
        setDisplayText(isoToBr(value));
      }
    }, [value]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value;
      const digitos = raw.replace(/\D/g, "").slice(0, 8);
      let formatado = digitos;
      if (digitos.length > 4) {
        formatado = `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
      } else if (digitos.length > 2) {
        formatado = `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
      }
      setDisplayText(formatado);

      const isoValue = brToIso(formatado);
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: isoValue,
        },
      };
      onChange?.(syntheticEvent as React.ChangeEvent<HTMLInputElement>);
    }

    function handleNativeChange(e: React.ChangeEvent<HTMLInputElement>) {
      const iso = e.target.value;
      setDisplayText(isoToBr(iso));
      const syntheticEvent = {
        ...e,
        target: { ...e.target, value: iso },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onChange?.(syntheticEvent);
    }

    function openPicker() {
      const el = nativeRef.current;
      if (!el) return;
      // showPicker é suportado nos navegadores modernos (Chrome/Edge); fallback para focus/click
      const anyEl = el as HTMLInputElement & { showPicker?: () => void };
      if (typeof anyEl.showPicker === "function") {
        try {
          anyEl.showPicker();
          return;
        } catch {
          // Alguns browsers lançam se não for gesto do usuário — fallback
        }
      }
      el.focus();
      el.click();
    }

    const inputEl = (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={displayText}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          "min-h-14 w-full min-w-0 rounded-md border border-input bg-transparent px-4 py-3 text-xl shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-xl dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          showCalendarPicker ? "pr-12" : "",
          className
        )}
        {...props}
      />
    );

    if (!showCalendarPicker) return inputEl;

    return (
      <div className="relative flex w-full items-center">
        {inputEl}
        {/* Input nativo escondido — serve apenas para abrir o calendário do SO */}
        <input
          ref={nativeRef}
          type="date"
          value={value ?? ""}
          onChange={handleNativeChange}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute left-0 top-0 h-0 w-0 overflow-hidden opacity-0 pointer-events-none"
        />
        <button
          type="button"
          onClick={openPicker}
          aria-label="Abrir calendário"
          title="Abrir calendário"
          className="absolute right-1.5 flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      </div>
    );
  }
);

DateInput.displayName = "DateInput";

export { DateInput };
