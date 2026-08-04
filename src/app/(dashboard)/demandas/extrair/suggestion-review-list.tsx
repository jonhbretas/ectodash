"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, UserX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDemanda } from "../actions";

// Matches plan 08-01's ExtractDemandasState.suggestions item shape exactly
// — no reshaping (08-02-PLAN.md key_links).
export type Suggestion = {
  key: string;
  titulo: string;
  responsavelId: string | null;
  responsavelTexto: string;
  prazoTexto: string;
};

type Profile = {
  id: string;
  email: string;
};

type CardStatus = "pending" | "confirming" | "created" | "rejected";

export type SuggestionReviewListProps = {
  suggestions: Suggestion[];
  profiles: Profile[];
};

export default function SuggestionReviewList({
  suggestions,
  profiles,
}: SuggestionReviewListProps) {
  const router = useRouter();
  const [cardStates, setCardStates] = useState<Record<string, CardStatus>>(
    () =>
      Object.fromEntries(suggestions.map((s) => [s.key, "pending" as const]))
  );

  const total = suggestions.length;
  const resolvedCount = Object.values(cardStates).filter(
    (status) => status === "created" || status === "rejected"
  ).length;
  const allResolved = total > 0 && resolvedCount === total;

  function setStatus(key: string, status: CardStatus) {
    setCardStates((prev) => ({ ...prev, [key]: status }));
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Revisar demandas sugeridas
        </h1>
        <p className="text-base text-zinc-700">
          A IA sugeriu{" "}
          {total === 1 ? "1 demanda" : `${total} demandas`} a partir do
          resumo. Revise, edite se precisar, e confirme cada uma antes que
          ela seja criada.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {suggestions.map((suggestion, index) => (
          <SuggestionCard
            key={suggestion.key}
            suggestion={suggestion}
            index={index + 1}
            total={total}
            profiles={profiles}
            status={cardStates[suggestion.key] ?? "pending"}
            onStatusChange={(status) => setStatus(suggestion.key, status)}
          />
        ))}
      </div>

      <div className="sticky bottom-0 flex flex-col gap-4 border-t border-zinc-300 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-base text-zinc-700">
          {resolvedCount} de {total} revisadas
        </p>
        <button
          type="button"
          disabled={!allResolved}
          onClick={() => router.push("/")}
          className="min-h-14 w-full rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          Concluir revisão
        </button>
      </div>
    </div>
  );
}

type SuggestionCardProps = {
  suggestion: Suggestion;
  index: number;
  total: number;
  profiles: Profile[];
  status: CardStatus;
  onStatusChange: (status: CardStatus) => void;
};

function SuggestionCard({
  suggestion,
  index,
  total,
  profiles,
  status,
  onStatusChange,
}: SuggestionCardProps) {
  // Own local editable state, initialized from the suggestion prop —
  // independent once rendered, edits never propagate back to the original
  // suggestion object. prazo starts "" since prazoTexto is a raw unparsed
  // phrase, never auto-resolved into a date (08-RESEARCH.md Common
  // Pitfall 5).
  const [titulo, setTitulo] = useState(suggestion.titulo);
  const [responsavelId, setResponsavelId] = useState<string | null>(
    suggestion.responsavelId
  );
  const [prazo, setPrazo] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    titulo?: string;
    responsavel?: string;
    prazo?: string;
  }>({});
  const [confirmError, setConfirmError] = useState("");

  const isResolved = status === "created" || status === "rejected";
  const isConfirming = status === "confirming";

  async function handleConfirmar() {
    const errors: typeof fieldErrors = {};
    if (titulo.trim().length === 0) {
      errors.titulo = "Digite um título para a demanda.";
    }
    if (!responsavelId) {
      errors.responsavel = "Escolha quem é o responsável.";
    }
    if (!prazo) {
      errors.prazo = "Escolha uma data de prazo.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setConfirmError("");
    onStatusChange("confirming");

    const formData = new FormData();
    formData.set("titulo", titulo);
    formData.append("responsavelIds", responsavelId as string);
    formData.set("prazo", prazo);
    formData.set("status", "pendente");

    const result = await createDemanda({ ok: false, message: "" }, formData);

    if (result.ok) {
      onStatusChange("created");
    } else {
      onStatusChange("pending");
      setConfirmError(
        result.message ||
          "Não foi possível criar essa demanda agora. Tente novamente."
      );
    }
  }

  function handleRejeitar() {
    // Pure client-state change — no network/server call at all, nothing was
    // ever persisted (IA-04, 08-RESEARCH.md Validation Architecture).
    onStatusChange("rejected");
  }

  function handleDesfazer() {
    // Restores the card to its previous editable state — título/
    // responsavelId/prazo were never cleared, only the status flag changed.
    onStatusChange("pending");
  }

  return (
    <Card
      className={`p-6 ${isResolved ? "bg-zinc-50" : "bg-white"}`}
    >
      <h2 className="text-xl font-semibold text-zinc-900">
        Sugestão {index} de {total}
      </h2>

      {status === "created" ? (
        <div className="mt-4 flex items-center gap-2">
          <CheckCircle2
            size={24}
            className="text-green-700"
            aria-hidden="true"
          />
          <span className="text-xl font-semibold text-green-800">Criada</span>
        </div>
      ) : status === "rejected" ? (
        <div className="mt-4 flex items-center gap-4">
          <span className="text-xl text-zinc-600">Sugestão rejeitada</span>
          <button
            type="button"
            onClick={handleDesfazer}
            className="text-base text-blue-700 underline"
          >
            Desfazer
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label
              htmlFor={`titulo-${suggestion.key}`}
              className="text-xl font-medium text-zinc-900"
            >
              Título *
            </Label>
            <Input
              id={`titulo-${suggestion.key}`}
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              disabled={isConfirming}
              className="min-h-14 text-xl rounded-lg border-zinc-400 bg-white text-zinc-900 shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 focus-visible:ring-0"
            />
            {fieldErrors.titulo && (
              <span className="text-base text-red-700">
                {fieldErrors.titulo}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Label
                htmlFor={`responsavel-${suggestion.key}`}
                className="text-xl font-medium text-zinc-900"
              >
                Responsável *
              </Label>
              {!responsavelId && (
                <span className="flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-base text-red-800">
                  <UserX size={16} aria-hidden="true" />
                  Responsável não identificado — escolha manualmente
                </span>
              )}
            </div>
            {!responsavelId && (
              <p className="text-base text-zinc-700">
                A IA identificou o nome &quot;{suggestion.responsavelTexto}
                &quot;, mas não encontrou esse perfil cadastrado.
              </p>
            )}
            <Select
              value={responsavelId ?? undefined}
              onValueChange={(value) => setResponsavelId(value)}
              disabled={isConfirming}
            >
              <SelectTrigger
                id={`responsavel-${suggestion.key}`}
                className="min-h-14 w-full rounded-lg border border-zinc-400 bg-white px-4 text-xl text-zinc-900"
              >
                <SelectValue placeholder="Escolha um responsável" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.responsavel && (
              <span className="text-base text-red-700">
                {fieldErrors.responsavel}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor={`prazo-${suggestion.key}`}
              className="text-xl font-medium text-zinc-900"
            >
              Prazo *
            </Label>
            <Input
              id={`prazo-${suggestion.key}`}
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              disabled={isConfirming}
              className="min-h-14 text-xl rounded-lg border-zinc-400 bg-white text-zinc-900 shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 focus-visible:ring-0"
            />
            {fieldErrors.prazo && (
              <span className="text-base text-red-700">
                {fieldErrors.prazo}
              </span>
            )}
          </div>

          {confirmError && (
            <p className="text-base text-red-700">{confirmError}</p>
          )}

          <div className="mt-4 flex gap-4">
            <button
              type="button"
              onClick={handleRejeitar}
              disabled={isConfirming}
              className="min-h-14 flex-1 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Rejeitar
            </button>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={!responsavelId || isConfirming}
              className="min-h-14 flex-1 rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isConfirming ? "Confirmando..." : "Confirmar"}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
