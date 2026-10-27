"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { journeySteps } from "@/lib/journey";
import { registrarExploracao } from "./journey-actions";

export default function JourneyVisit({ userId }: { userId: string }) {
  const pathname = usePathname();
  const recorded = useRef(new Set<string>());
  useEffect(() => {
    const step = journeySteps.find((item) => item.track === "sistema" && item.href === pathname);
    if (!step) return;
    const key = `${userId}:${step.id}`;
    if (recorded.current.has(key)) return;
    recorded.current.add(key);
    void registrarExploracao(step.id).then((result) => {
      if (result.error) recorded.current.delete(key);
    }).catch(() => recorded.current.delete(key));
  }, [pathname, userId]);
  return null;
}
