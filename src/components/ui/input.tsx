import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Default size edited for this project's accessibility floor
        // (min-h-14/56px touch target, text-xl/20px body text, including
        // the desktop-breakpoint override) per 03-UI-SPEC.md's
        // Spacing/Typography tables and RESEARCH.md Pitfall 3
        // recommendation (b) — shadcn's stock default is h-9/text-base
        // with a md:text-sm downshift on desktop, both below this
        // project's floor.
        "min-h-14 w-full min-w-0 rounded-md border border-input bg-transparent px-4 py-3 text-xl shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-xl dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
