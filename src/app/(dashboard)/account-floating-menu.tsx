"use client";

import { ChevronDown, UserRound } from "lucide-react";
import { useStoredPreference } from "@/lib/use-stored-preference";
import SignOutButton from "./sign-out-button";
import ViewAsSelector, { type ViewAsOption } from "./view-as-selector";

const VIEW_AS_KEY = "ectodash:visualizar-como";

export default function AccountFloatingMenu({ isCoordenador, viewAsOptions }: { isCoordenador: boolean; viewAsOptions: ViewAsOption[] }) {
  const [viewAs, setViewAs] = useStoredPreference(VIEW_AS_KEY, "eu");
  return (
    <details className="fixed right-4 top-2 z-50 lg:right-6 lg:top-5">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-slate-200 bg-white/95 px-2.5 text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] [&::-webkit-details-marker]:hidden">
        <UserRound size={19} aria-hidden="true" /><span className="hidden text-sm font-semibold sm:inline">Minha conta</span><ChevronDown size={15} aria-hidden="true" />
      </summary>
      <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/15">
        {isCoordenador && <ViewAsSelector options={viewAsOptions} value={viewAs} onChange={setViewAs} compact />}
        <div className={`${isCoordenador ? "mt-3 border-t border-slate-100 pt-3" : ""} flex items-center gap-2`}>
          <a href="/perfil" className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"><UserRound size={17} aria-hidden="true" />Meu perfil</a>
          <div className="flex-1"><SignOutButton /></div>
        </div>
      </div>
    </details>
  );
}
