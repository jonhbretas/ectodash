"use client";

// src/components/notificacoes/feedback-alerta.tsx
// Banner persistente + badge polling para coordenador_geral.
// Mostra quantos relatos estão com status "novo" (não vistos).
// - Banner no topo do dashboard, dismiss por sessão (fecha até recarregar
//   ou até chegar um novo relato que aumenta a contagem).
// - Badge numérico usado na sidebar no item "Relatos e melhorias".
// Polling simples a cada 60s via Supabase JS (sem realtime) — conforme
// combinado com o usuário.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, X, MessageSquareWarning } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const POLLING_MS = 60_000;
const STORAGE_KEY = "ectodash:feedback-banner-dismissed";
const STORAGE_COUNT_KEY = "ectodash:feedback-banner-dismissed-count";

function getDismissedCount(): number | null {
  try {
    const v = sessionStorage.getItem(STORAGE_COUNT_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export function FeedbackAlertaBanner({
  initialCount,
  isCoordenador,
}: {
  initialCount: number;
  isCoordenador: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [dismissed, setDismissed] = useState(false);

  // Restaura dismiss da sessão no mount
  useEffect(() => {
    if (!isCoordenador) return;
    try {
      const wasDismissed = sessionStorage.getItem(STORAGE_KEY) === "1";
      if (wasDismissed) {
        const c = getDismissedCount();
        // Só mantém dismissed se a contagem não aumentou desde o dismiss
        if (c !== null && c === initialCount) {
          setDismissed(true);
        } else if (c === null) {
          setDismissed(true);
        } else {
          // Nova contagem maior que a do dismiss → reexibe
          sessionStorage.removeItem(STORAGE_KEY);
          sessionStorage.removeItem(STORAGE_COUNT_KEY);
        }
      }
    } catch {
      // storage indisponível
    }
  }, [initialCount, isCoordenador]);

  const fetchCount = useCallback(async () => {
    try {
      const supabase = createClient();
      const { count: novoCount, error } = await supabase
        .from("feedback")
        .select("id", { count: "exact", head: true })
        .eq("status", "novo");
      if (error) return;
      const n = novoCount ?? 0;
      setCount((prev) => {
        // Se estava dismissed e a contagem aumentou, reexibe
        if (dismissed && n > prev) {
          setDismissed(false);
          try {
            sessionStorage.removeItem(STORAGE_KEY);
            sessionStorage.removeItem(STORAGE_COUNT_KEY);
          } catch {}
        }
        return n;
      });
    } catch {
      // silencioso
    }
  }, [dismissed]);

  useEffect(() => {
    if (!isCoordenador) return;
    const id = window.setInterval(fetchCount, POLLING_MS);
    return () => window.clearInterval(id);
  }, [isCoordenador, fetchCount]);

  // Também revalida quando a aba volta ao foco
  useEffect(() => {
    if (!isCoordenador) return;
    const onFocus = () => fetchCount();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isCoordenador, fetchCount]);

  function handleDismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
      sessionStorage.setItem(STORAGE_COUNT_KEY, String(count));
    } catch {}
  }

  if (!isCoordenador || count === 0 || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
        <Bell size={16} aria-hidden="true" />
      </span>
      <p className="flex-1 text-sm font-medium leading-snug">
        {count === 1
          ? "1 novo relato de bug/melhoria aguardando leitura."
          : `${count} novos relatos de bug/melhoria aguardando leitura.`}{" "}
        <Link
          href="/feedback"
          className="font-semibold underline decoration-amber-600 underline-offset-2 hover:text-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
        >
          Ver relatos
        </Link>
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Fechar notificação até a próxima atualização"
        title="Fechar até visualizar"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-amber-700 transition-colors hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

// Badge isolado para uso na sidebar (também faz polling próprio quando
// montado — compartilha o mesmo intervalo, mas é leve).
export function FeedbackSidebarBadge({
  initialCount,
  isCoordenador,
}: {
  initialCount: number;
  isCoordenador: boolean;
}) {
  const [count, setCount] = useState(initialCount);

  const fetchCount = useCallback(async () => {
    try {
      const supabase = createClient();
      const { count: novoCount, error } = await supabase
        .from("feedback")
        .select("id", { count: "exact", head: true })
        .eq("status", "novo");
      if (error) return;
      setCount(novoCount ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    if (!isCoordenador) return;
    const id = window.setInterval(fetchCount, POLLING_MS);
    const onFocus = () => fetchCount();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [isCoordenador, fetchCount]);

  if (!isCoordenador || count === 0) return null;

  return (
    <span
      aria-label={`${count} novos relatos`}
      className="ml-auto flex min-h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-bold leading-none text-white"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// Ícone alternativo para o banner quando usado em contexto isolado
export function FeedbackBannerIcon() {
  return <MessageSquareWarning size={16} aria-hidden="true" />;
}
