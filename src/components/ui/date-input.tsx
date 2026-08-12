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
}

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, value, onChange, placeholder = "dd/mm/aaaa", ...props }, ref) => {
    const [displayText, setDisplayText] = React.useState(() =>
      value ? isoToBr(value) : ""
    );

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

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={displayText}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          "min-h-14 w-full min-w-0 rounded-md border border-input bg-transparent px-4 py-3 text-xl shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-xl dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        {...props}
      />
    );
  }
);

DateInput.displayName = "DateInput";

export { DateInput };
