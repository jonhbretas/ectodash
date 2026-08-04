import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { signOut } from "./actions";

// No confirmation dialog: signing out is not a destructive action (Phase 5
// owns confirmation patterns for those). Default size matches the login
// form's accessibility floor (min-h-14 tap target, text-xl, AA contrast,
// visible focus ring); `compact` mode is for the shared header.
export default function SignOutButton({
  compact = false,
  iconOnly = false,
}: {
  compact?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <form action={signOut}>
      <Button
        type="submit"
        title={iconOnly ? "Sair" : undefined}
        aria-label={iconOnly ? "Sair do sistema" : undefined}
        // Full original className passed as an override — same rationale as
        // login-form.tsx's SubmitButton/Input retrofit: reproduces the exact
        // pre-retrofit rounded-lg/border-zinc-400/bg-white/outline-based
        // focus-visible secondary-button treatment via twMerge, over
        // shadcn's outline/secondary variant defaults.
        className={
          compact
            ? "min-h-11 rounded-full border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            : iconOnly
              ? "flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-400 bg-white p-0 text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              : "min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        }
      >
        {iconOnly ? (
          <LogOut size={24} aria-hidden="true" />
        ) : (
          "Sair"
        )}
      </Button>
    </form>
  );
}
