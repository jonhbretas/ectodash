"use client";

// src/app/(dashboard)/utilidades/dicionario/dicionario-view.tsx
// Tela do Dicionário: cadastro, lista, edição e preview de tradução.
// Gestão (criar/editar/excluir) só aparece para coordenador_geral — os
// gates estão nas server actions e a RLS (0079) é a fronteira real.

import { useActionState, useMemo, useState } from "react";
import { Plus, Search, Trash2, Pencil, Power, Wand2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyGlossary, countGlossaryMatches, type GlossaryTerm } from "@/lib/glossary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  criarTermoGlossario,
  atualizarTermoGlossario,
  alternarTermoGlossario,
  excluirTermoGlossario,
  type DicionarioState,
} from "./dicionario-actions";

const initialState: DicionarioState = { ok: false, message: "" };

export default function DicionarioView({
  termos,
  podeGerenciar,
}: {
  termos: GlossaryTerm[];
  podeGerenciar: boolean;
}) {
  const [query, setQuery] = useState("");
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [testText, setTestText] = useState("");

  const [criarState, criarAction, criarPending] = useActionState(
    criarTermoGlossario,
    initialState
  );
  const [editarState, editarAction, editarPending] = useActionState(
    atualizarTermoGlossario,
    initialState
  );
  const [alternarState, alternarAction] = useActionState(
    alternarTermoGlossario,
    initialState
  );
  const [excluirState, excluirAction] = useActionState(
    excluirTermoGlossario,
    initialState
  );

  const ativos = useMemo(() => termos.filter((t) => t.active), [termos]);
  const inativos = termos.length - ativos.length;

  const filtrados = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    if (!needle) return termos;
    return termos.filter(
      (t) =>
        t.term.toLocaleLowerCase("pt-BR").includes(needle) ||
        t.replacement.toLocaleLowerCase("pt-BR").includes(needle) ||
        (t.description ?? "").toLocaleLowerCase("pt-BR").includes(needle)
    );
  }, [termos, query]);

  const testResultado = useMemo(
    () => (testText.trim() ? applyGlossary(testText, ativos) : ""),
    [testText, ativos]
  );
  const testEncontrados = useMemo(
    () => (testText.trim() ? countGlossaryMatches(testText, ativos) : 0),
    [testText, ativos]
  );

  const formField =
    "h-12 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const textareaField =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y";
  const sectionLabel =
    "text-xs font-semibold uppercase tracking-wider text-muted-foreground";
  const listRow =
    "flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:gap-4";

  return (
    <div className="flex w-full flex-col gap-6">
      {(criarState.message || editarState.message || alternarState.message || excluirState.message) && (
        <div
          role="status"
          className={cn(
            "rounded-lg border px-4 py-3 text-base",
            criarState.ok && criarState.message
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
          )}
        >
          {criarState.message || editarState.message || alternarState.message || excluirState.message}
        </div>
      )}

      {/* Cadastro / edição */}
      {podeGerenciar && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="size-5" aria-hidden="true" />
              {editandoId !== null ? "Editar termo" : "Cadastrar termo"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              key={editandoId ?? "novo"}
              action={editandoId !== null ? editarAction : criarAction}
              className="flex flex-col gap-4"
            >
              {editandoId !== null && (
                <input type="hidden" name="id" value={editandoId} />
              )}
              <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className={sectionLabel}>
                    Termo (como aparece na transcrição)
                  </span>
                  <input
                    name="term"
                    defaultValue={
                      termos.find((t) => t.id === editandoId)?.term ?? ""
                    }
                    required
                    maxLength={200}
                    placeholder="ex.: SIAEC, neossinapse, holopensene"
                    className={formField}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={sectionLabel}>
                    Significado (como a IA deve entender)
                  </span>
                  <input
                    name="replacement"
                    defaultValue={
                      termos.find((t) => t.id === editandoId)?.replacement ?? ""
                    }
                    required
                    maxLength={200}
                    placeholder="ex.: CEAEC, nova conexão mental, ambiente energético"
                    className={formField}
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className={sectionLabel}>Descrição (opcional)</span>
                <input
                  name="description"
                  defaultValue={
                    termos.find((t) => t.id === editandoId)?.description ?? ""
                  }
                  maxLength={500}
                  placeholder="Contexto para você se lembrar do termo"
                  className={formField}
                />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  size="lg"
                  disabled={criarPending || editarPending}
                >
                  {criarPending || editarPending
                    ? "Salvando…"
                    : editandoId !== null
                      ? "Salvar alterações"
                      : "Cadastrar"}
                </Button>
                {editandoId !== null && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    onClick={() => setEditandoId(null)}
                  >
                    Cancelar edição
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-5" aria-hidden="true" />
            Termos cadastrados
            <span className="text-base font-normal text-muted-foreground">
              · {ativos.length} ativo(s)
              {inativos > 0 && ` · ${inativos} inativo(s)`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar termo ou significado…"
            className={formField}
          />

          {filtrados.length === 0 ? (
            <p className="py-8 text-center text-base text-muted-foreground">
              {termos.length === 0
                ? "Nenhum termo cadastrado ainda. Os termos aparecem aqui depois de cadastrados."
                : "Nada encontrado para essa busca."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtrados.map((termo) => (
                <li
                  key={termo.id}
                  className={cn(listRow, !termo.active && "opacity-50")}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-primary">
                        {termo.term}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-base font-medium">
                        {termo.replacement}
                      </span>
                      {!termo.active && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          Inativo
                        </span>
                      )}
                    </div>
                    {termo.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {termo.description}
                      </p>
                    )}
                  </div>
                  {podeGerenciar && (
                    <div className="flex shrink-0 items-center gap-1">
                      <form action={alternarAction} title={termo.active ? "Desativar" : "Ativar"}>
                        <input type="hidden" name="id" value={termo.id} />
                        <input type="hidden" name="active" value={String(!termo.active)} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={termo.active ? "Desativar termo" : "Ativar termo"}
                        >
                          <Power className={cn("size-4", termo.active ? "text-emerald-600" : "")} />
                        </Button>
                      </form>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Editar termo"
                        onClick={() =>
                          setEditandoId((atual) =>
                            atual === termo.id ? null : termo.id
                          )
                        }
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <form action={excluirAction} onSubmit={(e) => {
                        if (!window.confirm(`Excluir o termo "${termo.term}" do dicionário?`)) e.preventDefault();
                      }}>
                        <input type="hidden" name="id" value={termo.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Excluir termo"
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Testar tradução */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="size-5" aria-hidden="true" />
            Testar tradução
            {testEncontrados > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                {testEncontrados} termo(s) encontrado(s)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Cole um trecho de transcrição para ver exatamente como a IA vai
            recebê-lo durante a análise de reuniões.
          </p>
          <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={sectionLabel}>Texto original</span>
              <textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                rows={8}
                placeholder="Cole aqui o trecho da ata ou transcrição…"
                className={textareaField}
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className={sectionLabel}>Texto traduzido para a IA</span>
              <div className="relative">
                <textarea
                  readOnly
                  value={testResultado}
                  rows={8}
                  placeholder="O resultado aparece aqui…"
                  className={cn(textareaField, "border-primary/40 bg-primary/5")}
                />
                {testResultado && <CopyButton text={testResultado} />}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copiar texto traduzido"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
      className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
      aria-label="Copiar texto traduzido"
    >
      {copied ? (
        <Check className="size-4 text-emerald-500" />
      ) : (
        <Copy className="size-4" />
      )}
    </button>
  );
}
