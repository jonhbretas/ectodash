"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ClipboardList, MonitorPlay } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { extractDemandas, type ExtractDemandasState } from "./actions";
import SuggestionReviewList from "./suggestion-review-list";
import type { Meeting } from "@/lib/meetings";

const initialState: ExtractDemandasState = {
  ok: false,
  message: "",
  suggestions: [],
};

// extractDemandas' own empty/whitespace-only-paste validation copy
// (actions.ts's pasteSchema) — matched verbatim so this exact outcome
// renders as a small inline validation span (mirrors demanda-form.tsx's
// errors.titulo treatment) rather than the full AlertCircle
// extraction-error block, per 08-UI-SPEC.md's explicit "not the
// empty-input validation message" carve-out for the genuine-error state.
const EMPTY_PASTE_MESSAGE = "Cole o resumo da reunião antes de continuar.";

// Same roster option shape as the demandas form (demanda-form.tsx): the
// institutional roster is the source of truth for responsáveis; temConta
// flags who has an activated account.
export type VoluntarioOption = {
  id: number;
  nome: string;
  temConta: boolean;
};

type ImportFormProps = {
  voluntarios: VoluntarioOption[];
  meetings: Meeting[];
  meetingsError: string | null;
  meetingsConfigured: boolean;
};

function formatMeetingDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

// Mirrors demanda-form.tsx's exact SubmitButton pattern — idle/pending
// labels swap via useFormStatus, same min-h-14/bg-[#2195B9] classes. The
// idle label becomes "Tentar novamente" once a genuine extraction error is
// showing — same button, same textarea, same FormData on re-submit, per
// 08-UI-SPEC.md's "re-submits the same textarea content" requirement (no
// separate retry button/handler needed).
function SubmitButton({ isRetry }: { isRetry: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-14 w-full rounded-lg bg-[#2195B9] px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Analisando..." : isRetry ? "Tentar novamente" : "Extrair demandas"}
    </button>
  );
}

export default function ImportForm({
  voluntarios,
  meetings,
  meetingsError,
  meetingsConfigured,
}: ImportFormProps) {
  const [state, formAction] = useActionState(extractDemandas, initialState);
  // Local-only reset key: incrementing this forces the form back to a fresh,
  // empty Screen 1 render ("Colar outro resumo") without needing a second
  // route or a server round-trip — useActionState's own state can't be
  // reset directly, so a key bump on the wrapping form remounts it.
  const [resetKey, setResetKey] = useState(0);

  const isEmptyPasteValidation =
    state.ok === false && state.message === EMPTY_PASTE_MESSAGE;
  const isGenuineError =
    state.ok === false && state.message !== "" && !isEmptyPasteValidation;
  const isZeroSuggestions = state.ok === true && state.suggestions.length === 0;
  const hasSuggestions = state.ok === true && state.suggestions.length > 0;

  if (hasSuggestions) {
    return (
      <SuggestionReviewList suggestions={state.suggestions} voluntarios={voluntarios} />
    );
  }

  if (isZeroSuggestions) {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-4 py-16 text-center">
        <ClipboardList size={48} className="text-zinc-400" aria-hidden="true" />
        <h2 className="text-3xl font-semibold text-zinc-900">
          Nenhuma demanda encontrada nesse resumo
        </h2>
        <p className="max-w-md text-xl text-zinc-700">
          A IA não identificou tarefas com responsável e prazo claros no
          texto colado. Você pode colar outro resumo ou criar a demanda
          manualmente.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <button
            type="button"
            onClick={() => setResetKey((key) => key + 1)}
            className="flex min-h-14 items-center justify-center rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            Colar outro resumo
          </button>
          <Link
            href="/demandas/nova"
            className="flex min-h-14 items-center justify-center rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            Criar demanda manualmente
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      key={resetKey}
      action={formAction}
      className="flex w-full max-w-md flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Extrair demandas de uma reunião
        </h1>
        <p className="text-base text-zinc-700">
          Escolha uma reunião gravada no Tactiq ou cole a transcrição já
          pronta. A IA vai sugerir novas demandas para você revisar.
        </p>
      </div>

      {meetingsConfigured && (
        <div className="flex flex-col gap-2">
          <label
            htmlFor="reuniaoId"
            className="text-xl font-medium text-zinc-900"
          >
            Reunião gravada no Tactiq
          </label>
          {meetingsError ? (
            <p className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-base text-amber-900">
              <AlertCircle size={20} aria-hidden="true" />
              {meetingsError}
            </p>
          ) : meetings.length === 0 ? (
            <p className="text-base text-zinc-700">
              Nenhuma reunião gravada encontrada. Você pode colar a
              transcrição manualmente abaixo.
            </p>
          ) : (
            <>
              <select
                id="reuniaoId"
                name="reuniaoId"
                defaultValue=""
                className="min-h-14 w-full rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
              >
                <option value="">Escolha uma reunião...</option>
                {meetings.map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {meeting.titulo}
                    {formatMeetingDate(meeting.data)
                      ? ` (${formatMeetingDate(meeting.data)})`
                      : ""}
                  </option>
                ))}
              </select>
              <p className="flex items-center gap-1 text-base text-zinc-700">
                <MonitorPlay size={18} aria-hidden="true" />
                Ao escolher, a transcrição é usada automaticamente.
              </p>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label
          htmlFor="texto"
          className="text-xl font-medium text-zinc-900"
        >
          Ou cole a transcrição / resumo
        </label>
        <ResumoTextarea />
        {isEmptyPasteValidation && (
          <span className="text-base text-red-700">{state.message}</span>
        )}
      </div>

      {isGenuineError ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={32} className="text-red-700" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-red-800">
              Não foi possível analisar a transcrição
            </h2>
          </div>
          <p className="text-base text-zinc-700">{state.message}</p>
        </div>
      ) : null}

      <SubmitButton isRetry={isGenuineError} />

      <div aria-live="polite" className="min-h-7 text-lg text-zinc-800">
        <PendingHint />
      </div>
    </form>
  );
}

// Pending sub-text must live inside the same aria-live region as the
// idle/error copy above (08-UI-SPEC.md's "honest about taking a few
// seconds" requirement) — a separate useFormStatus() read here (not lifted
// to the parent) is required because useFormStatus only works inside the
// <form> subtree it belongs to.
function PendingHint() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return <p>Isso pode levar alguns segundos. Não recarregue a página.</p>;
}

// readOnly (not hidden/disabled) while pending — keeps the pasted text
// visible and its value included in the eventual retry's FormData; a
// disabled field is excluded from form submission, which would silently
// drop the text on any re-submit path. Its own useFormStatus() read (not
// lifted to the parent) is required for the same reason PendingHint's is.
function ResumoTextarea() {
  const { pending } = useFormStatus();

  return (
    <textarea
      id="texto"
      name="texto"
      readOnly={pending}
      placeholder="Cole aqui o texto do resumo da reunião..."
      className="min-h-48 w-full rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
    />
  );
}
