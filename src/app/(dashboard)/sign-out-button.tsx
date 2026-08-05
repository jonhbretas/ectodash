import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { signOut } from "./actions";

export default function SignOutButton({
  compact = false,
  iconOnly = false,
}: {
  compact?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <form action={signOut} className="w-full">
      <Button
        type="submit"
        title={iconOnly ? "Sair" : undefined}
        aria-label={iconOnly ? "Sair do sistema" : undefined}
        className={
          compact
            ? "min-h-10 w-full rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            : iconOnly
              ? "flex h-9 w-full items-center justify-center rounded-xl border-0 bg-transparent p-0 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
              : "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        }
      >
        {iconOnly ? (
          <LogOut size={18} aria-hidden="true" strokeWidth={1.5} />
        ) : (
          "Sair"
        )}
      </Button>
    </form>
  );
}
