"use client";

// /vincular client: a name search over the institutional roster (results
// come from migration 0017's buscar_voluntarios — a SECURITY DEFINER
// function that only answers while the caller's vincular_pendente is set),
// a "Vincular" button per result, and a "Não me encontrei" fallback that
// creates a fresh roster entry with the typed name. On success the account
// is linked (vincular_pendente cleared server-side) and the user navigates
// to the dashboard.
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserRoundCheck, UserRoundPlus, Sparkles } from "lucide-react";
import {
  buscarVoluntarios,
  vincularCadastro,
  criarCadastro,
  type VoluntarioMatch,
} from "./vincular-actions";

const initialState = { ok: false, message: "" };

export default function VincularForm() {
  const router = useRouter();
  const [termo, setTermo] = useState("");
  const [showNaoEncontrei, setShowNaoEncontrei] = useState(false);

  const [buscaState, buscaAction, buscaPending] = useActionState(
    buscarVoluntarios,
    { ...initialState, matches: [] }
  );

  const [vinculaState, vinculaAction] = useActionState(
    vincularCadastro,
    initialState
  );
  const [criaState, criaAction] = useActionState(criarCadastro, initialState);

  function onSuccess(message: string) {
    router.push("/");
  }

  const matches = buscaState.matches ?? [];

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <form
        action={buscaAction}
        className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60 sm:flex-row"
        aria-live="polite"
      >
        <label htmlFor="termo" className="sr-only">
          Buscar meu nome
        </label>
        <input
          id="termo"
          name="termo"
          value={termo}
          onChange={(event) => setTermo(event.target.value)}
          placeholder="Busque seu nome..."
          autoComplete="name"
          className="min-h-14 flex-1 rounded-xl border border-zinc-300 bg-white px-4 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        />
        <button
          type="submit"
          disabled={buscaPending}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-5 text-xl font-medium text-white shadow-[0_1px_3px_rgba(33,149,185,0.25)] transition-all duration-200 hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Search size={22} aria-hidden="true" />
          Buscar
        </button>
      </form>

      {buscaState.message && !buscaState.ok && (
        <p className="text-base text-red-700" role="alert">
          {buscaState.message}
        </p>
      )}

      {matches.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xl font-medium text-zinc-900">
            {matches.length === 1
              ? "Encontramos 1 cadastro:"
              : `Encontramos ${matches.length} cadastros:`}
          </p>
          <div className="flex flex-col rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
            {matches.map((match, index) => (
              <div
                key={match.cadastro_id}
                className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${
                  index > 0 ? "border-t border-zinc-200" : ""
                }`}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-xl font-medium text-zinc-900">
                    {match.nome}
                  </span>
                  <span className="truncate text-base text-zinc-600">
                    {[match.unidade, match.funcao, match.area_atuacao]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <form action={vinculaAction} aria-live="polite">
                  <input
                    type="hidden"
                    name="cadastro_id"
                    value={match.cadastro_id}
                  />
                  <button
                    type="submit"
                    disabled={vinculaState.ok}
                    className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-5 text-xl font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:opacity-70"
                  >
                    <UserRoundCheck size={22} aria-hidden="true" />
                    Sou eu
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {matches.length === 0 && termo.trim().length > 0 && buscaState.ok && (
        <p className="rounded-2xl bg-white px-5 py-4 text-xl text-zinc-700 ring-1 ring-zinc-200/60">
          Nenhum nome encontrado para &ldquo;{termo.trim()}&rdquo;.
        </p>
      )}

      {vinculaState.message && (
        <p
          className={`text-base ${
            vinculaState.ok ? "text-green-800" : "text-red-700"
          }`}
          role={vinculaState.ok ? "status" : "alert"}
        >
          {vinculaState.message}
        </p>
      )}
      {vinculaState.ok && (
        <button
          type="button"
          onClick={() => onSuccess(vinculaState.message)}
          className="flex min-h-14 w-fit items-center justify-center gap-2 rounded-xl bg-green-700 px-5 text-xl font-medium text-white transition-colors hover:bg-green-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
        >
          <Sparkles size={22} aria-hidden="true" />
          Entrar no EctoDash
        </button>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
        <button
          type="button"
          onClick={() => setShowNaoEncontrei((show) => !show)}
          aria-expanded={showNaoEncontrei}
          className="flex min-h-14 items-center gap-2 text-xl font-medium text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          <UserRoundPlus size={22} aria-hidden="true" />
          Não encontrei meu nome
        </button>
        {showNaoEncontrei && (
          <form
            action={criaAction}
            className="mt-3 flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row"
            aria-live="polite"
          >
            <label htmlFor="nome" className="sr-only">
              Seu nome e sobrenome
            </label>
            <input
              id="nome"
              name="nome"
              required
              minLength={2}
              placeholder="Digite seu nome e sobrenome"
              autoComplete="name"
              className="min-h-14 flex-1 rounded-xl border border-zinc-300 bg-white px-4 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            />
            <button
              type="submit"
              disabled={criaState.ok}
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-xl font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:opacity-70"
            >
              <UserRoundPlus size={22} aria-hidden="true" />
              Criar meu cadastro
            </button>
          </form>
        )}
        {criaState.message && (
          <p
            className={`mt-3 text-base ${
              criaState.ok ? "text-green-800" : "text-red-700"
            }`}
            role={criaState.ok ? "status" : "alert"}
          >
            {criaState.message}
          </p>
        )}
        {criaState.ok && (
          <button
            type="button"
            onClick={() => onSuccess(criaState.message)}
            className="mt-3 flex min-h-14 w-fit items-center justify-center gap-2 rounded-xl bg-green-700 px-5 text-xl font-medium text-white transition-colors hover:bg-green-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
          >
            <Sparkles size={22} aria-hidden="true" />
            Entrar no EctoDash
          </button>
        )}
      </div>
    </div>
  );
}
