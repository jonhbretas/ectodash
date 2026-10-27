"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function useTrailSelection(track: "voluntario" | "docente", ids: string[], fallback = 0) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selected = searchParams.get("tab") === track || (!searchParams.get("tab") && track === "voluntario")
    ? ids.indexOf(searchParams.get("etapa") ?? "") : -1;
  const index = selected >= 0 ? selected : fallback;
  function select(index: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", track);
    params.set("etapa", ids[index]);
    router.replace(`/trilha?${params.toString()}`, { scroll: false });
  }
  return [index, select] as const;
}
