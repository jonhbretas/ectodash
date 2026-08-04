"use client";

// Review screen for AI-suggested demandas. Editable per-card state lives
// HERE (lifted from the card) so a single "Confirmar todas" button can
// validate and create every still-pending card at once — the MCP-flow
// speed-up (user decision, 2026-08-04): with responsável and prazo
// pre-filled by the AI, one click creates everything. The human-review
// gate (IA-04) is unchanged: nothing is ever created without this screen's
// explicit Confirmar click, and each card remains independently editable.
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
  prazoSugerido: string | null;
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

type FieldErrors = { titulo?: string; responsavel?: string; prazo?: string };

function validateCard(
  titulo: string,
  responsavelId: string | null,
  prazo: string
): FieldErrors {
  const errors: FieldErrors = {};
  if (titulo.trim().length === 0) {
    errors.titulo = "Digite um título para a demanda.";
  }
  if (!responsavelId) {
    errors.responsavel = "Escolha quem é o responsável.";
  }
  if (!prazo) {
    errors.prazo = "Escolha uma data de prazo.";
  }
  return errors;
}

export default function SuggestionReviewList({
  suggestions,
  profiles,
}: SuggestionReviewListProps) {
  const router = useRouter();

  // Editable state for every card, lifted from the card itself — the
  // source of truth for both per-card and bulk "Confirmar todas".
  const [titulos, setTitulos] = useState<Record<string, string>>(() =>
    Object.fromEntries(suggestions.map((s) => [s.key, s.titulo]))
  );
  const [responsavelIds, setResponsavelIds] = useState<Record<string, string | null>>(
    () =>
      Object.fromEntries(suggestions.map((s) => [s.key, s.responsavelId]))
  );
  const [prazos, setPrazos] = useState<Record<string, string>>(() =>
    Object.fromEntries(suggestions.map((s) => [s.key, s.prazoSugerido ?? ""]))
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, FieldErrors>>({});
  const [confirmErrors, setConfirmErrors] = useState<Record<string, string>>({});
  const [cardStates, setCardStates] = useState<Record<string, CardStatus>>(
    () =>
      Object.fromEntries(suggestions.map((s) => [s.key, "pending" as const]))
  );
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");

  const total = suggestions.length;
  const resolvedCount = Object.values(cardStates).filter(
    (status) => status === "created" || status === "rejected"
  ).length;
  const allResolved = total > 0 && resolvedCount === total;
  const pendingCount = total - resolvedCount;

  function setStatus(key: string, status: CardStatus) {
    setCardStates((prev) => ({ ...prev, [key]: status }));
  }

  // Creates one card. Returns true on success — shared by the per-card
  // Confirmar and the bulk loop.
  async function createOne(
    key: string,
    titulo: string,
    responsavelId: string | null,
    prazo: string
  ): Promise<boolean> {
    const formData = new FormData();
    formData.set("titulo", titulo);
    if (responsavelId) formData.append("responsavelIds", responsavelId);
    formData.set("prazo", prazo);
    formData.set("status", "pendente");

    const result = await createDemanda({ ok: false, message: "" }, formData);

    if (result.ok) {
      setStatus(key, "created");
      return true;
    }
    setStatus(key, "pending");
    setConfirmErrors((prev) => ({
      ...prev,
      [key]:
        result.message ||
        "Não foi possível criar essa demanda agora. Tente novamente.",
    }));
    return false;
  }

  async function handleConfirmar(key: string) {
    const titulo = titulos[key] ?? "";
    const responsavelId = responsavelIds[key] ?? null;
    const prazo = prazos[key] ?? "";

    const errors = validateCard(titulo, responsavelId, prazo);
    if (Object.keys(errors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, [key]: errors }));
      return;
    }
    setFieldErrors((prev) => ({ ...prev, [key]: {} }));
    setConfirmErrors((prev) => ({ ...prev, [key]: "" }));
    setStatus(key, "confirming");
    await createOne(key, titulo, responsavelId, prazo);
  }

  // Bulk "Confirmar todas" — validates every still-pending card first;
  // if any lacks required fields, only those get inline errors and nothing
  // is created (no partial surprise). When all are valid, creates them all.
  async function handleConfirmarTodas() {
    const pendingKeys = suggestions
      .filter((s) => (cardStates[s.key] ?? "pending") === "pending")
      .map((s) => s.key);

    const newErrors: Record<string, FieldErrors> = {};
    let allValid = true;
    for (const key of pendingKeys) {
      const errors = validateCard(
        titulos[key] ?? "",
        responsavelIds[key] ?? null,
        prazos[key] ?? ""
      );
      newErrors[key] = errors;
      if (Object.keys(errors).length > 0) allValid = false;
    }

    setFieldErrors(newErrors);
    if (!allValid) {
      setBulkMessage(
        "Alguns cartões precisam de preenchimento — veja os campos destacados."
      );
      return;
    }

    setBulkMessage("");
    setBulkPending(true);
    // Mark every pending card confirming while the batch runs.
    setCardStates((prev) => {
      const next = { ...prev };
      for (const key of pendingKeys) next[key] = "confirming";
      return next;
    });

    let created = 0;
    await Promise.all(
      pendingKeys.map(async (key) => {
        const ok = await createOne(
          key,
          titulos[key] ?? "",
          responsavelIds[key] ?? null,
          prazos[key] ?? ""
        );
        if (ok) created += 1;
      })
    );

    setBulkPending(false);
    if (created === pendingKeys.length) {
      setBulkMessage("Todas as demandas foram criadas!");
    } else if (created > 0) {
      setBulkMessage(
        `${created} de ${pendingKeys.length} demandas criadas — verifique os cartões restantes.`
      );
    } else {
      setBulkMessage(
        "Não foi possível criar as demandas agora. Tente novamente."
      );
    }
  }

  function handleRejeitar(key: string) {
    // Pure client-state change — no network/server call at all, nothing was
    // ever persisted (IA-04, 08-RESEARCH.md Validation Architecture).
    setStatus(key, "rejected");
  }

  function handleDesfazer(key: string) {
    // Restores the card to its previous editable state — título/
    // responsavelId/prazo were never cleared, only the status flag changed.
    setStatus(key, "pending");
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Revisar demandas sugeridas
        </h1>
        <p className="text-base text-zinc-700">
          A IA sugeriu{" "}
          {total === 1 ? "1 demanda" : `${total} demandas`} a partir da
          reunião. Revise, edite se precisar, e confirme cada uma antes que
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
            titulo={titulos[suggestion.key] ?? ""}
            responsavelId={responsavelIds[suggestion.key] ?? null}
            prazo={prazos[suggestion.key] ?? ""}
            errors={fieldErrors[suggestion.key] ?? {}}
            confirmError={confirmErrors[suggestion.key] ?? ""}
            onTituloChange={(value) =>
              setTitulos((prev) => ({ ...prev, [suggestion.key]: value }))
            }
            onResponsavelChange={(value) =>
              setResponsavelIds((prev) => ({
                ...prev,
                [suggestion.key]: value,
              }))
            }
            onPrazoChange={(value) =>
              setPrazos((prev) => ({ ...prev, [suggestion.key]: value }))
            }
            onConfirmar={() => handleConfirmar(suggestion.key)}
            onRejeitar={() => handleRejeitar(suggestion.key)}
            onDesfazer={() => handleDesfazer(suggestion.key)}
          />
        ))}
      </div>

      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-zinc-300 bg-white p-4">
        <p className="text-base text-zinc-700">
          {resolvedCount} de {total} revisadas
        </p>
        {pendingCount > 0 && (
          <button
            type="button"
            onClick={handleConfirmarTodas}
            disabled={bulkPending}
            className="min-h-14 w-full rounded-lg bg-green-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-green-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {bulkPending
              ? "Criando demandas..."
              : `Confirmar todas (${pendingCount})`}
          </button>
        )}
        {bulkMessage && (
          <p
            aria-live="polite"
            className={`text-base ${
              bulkMessage.includes("criadas")
                ? "text-green-800"
                : "text-red-700"
            }`}
          >
            {bulkMessage}
          </p>
        )}
        <button
          type="button"
          disabled={!allResolved}
          onClick={() => router.push("/")}
          className="min-h-14 w-full rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
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
  titulo: string;
  responsavelId: string | null;
  prazo: string;
  errors: FieldErrors;
  confirmError: string;
  onTituloChange: (value: string) => void;
  onResponsavelChange: (value: string) => void;
  onPrazoChange: (value: string) => void;
  onConfirmar: () => void;
  onRejeitar: () => void;
  onDesfazer: () => void;
};

// Controlled card — all editable values come from the parent (the source
// of truth for "Confirmar todas"); this component only renders them.
function SuggestionCard({
  suggestion,
  index,
  total,
  profiles,
  status,
  titulo,
  responsavelId,
  prazo,
  errors,
  confirmError,
  onTituloChange,
  onResponsavelChange,
  onPrazoChange,
  onConfirmar,
  onRejeitar,
  onDesfazer,
}: SuggestionCardProps) {
  const isResolved = status === "created" || status === "rejected";
  const isConfirming = status === "confirming";

  return (
    <Card className={`p-6 ${isResolved ? "bg-zinc-50" : "bg-white"}`}>
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
            onClick={onDesfazer}
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
              onChange={(e) => onTituloChange(e.target.value)}
              disabled={isConfirming}
              className="min-h-14 text-xl rounded-lg border-zinc-400 bg-white text-zinc-900 shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 focus-visible:ring-0"
            />
            {errors.titulo && (
              <span className="text-base text-red-700">{errors.titulo}</span>
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
              onValueChange={onResponsavelChange}
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
            {errors.responsavel && (
              <span className="text-base text-red-700">
                {errors.responsavel}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Label
                htmlFor={`prazo-${suggestion.key}`}
                className="text-xl font-medium text-zinc-900"
              >
                Prazo *
              </Label>
              {suggestion.prazoTexto && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-base text-zinc-700">
                  mencionado: {suggestion.prazoTexto}
                </span>
              )}
            </div>
            <Input
              id={`prazo-${suggestion.key}`}
              type="date"
              value={prazo}
              onChange={(e) => onPrazoChange(e.target.value)}
              disabled={isConfirming}
              className="min-h-14 text-xl rounded-lg border-zinc-400 bg-white text-zinc-900 shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 focus-visible:ring-0"
            />
            {errors.prazo && (
              <span className="text-base text-red-700">{errors.prazo}</span>
            )}
          </div>

          {confirmError && (
            <p className="text-base text-red-700">{confirmError}</p>
          )}

          <div className="mt-4 flex gap-4">
            <button
              type="button"
              onClick={onRejeitar}
              disabled={isConfirming}
              className="min-h-14 flex-1 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Rejeitar
            </button>
            <button
              type="button"
              onClick={onConfirmar}
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
