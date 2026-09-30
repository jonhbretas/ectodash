"use client";

// src/app/(dashboard)/financeiro/propostas/proposta-form.tsx
// Formulário de criar/editar proposta do ALUNO (mesmo padrão visual dos
// forms do app). Aluno tem datalist com os clientes da loja (wp_customers)
// e preenche o e-mail sozinho ao escolher; curso/atividade sugere eventos
// e produtos da loja; evento vincula ao cadastro de eventos.
import { useActionState, useMemo, useState } from "react";
import { PlusCircle, Save } from "lucide-react";
import {
  atualizarProposta,
  criarProposta,
  type PropostaActionState,
} from "./actions";
import {
  METODO_LABELS,
  METODOS,
  STATUS_LABELS,
  STATUS,
  type AlunoSugestao,
  type EventoOpcao,
  type Proposta,
} from "./proposta-schema";

const INICIAL: PropostaActionState = { ok: false, message: "" };

const inputCls =
  "min-h-11 rounded-lg border border-zinc-400 bg-white px-3 py-2 text-lg text-zinc-900 placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";
const labelCls = "text-base font-medium text-zinc-700";
const erroCls = "text-base text-red-700";

function Campo({
  id,
  rotulo,
  erro,
  children,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={labelCls}>
        {rotulo}
      </label>
      {children}
      {erro && (
        <p role="alert" className={erroCls}>
          {erro}
        </p>
      )}
    </div>
  );
}

type Props = {
  proposta?: Proposta;
  alunos: AlunoSugestao[];
  eventos: EventoOpcao[];
  cursosSugeridos: string[];
};

export default function PropostaForm({ proposta, alunos, eventos, cursosSugeridos }: Props) {
  const editando = Boolean(proposta);
  const sufixo = editando ? `-${proposta!.id}` : "";
  const [estado, acao, pendente] = useActionState(
    editando ? atualizarProposta : criarProposta,
    INICIAL
  );

  const emailPorNome = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const a of alunos) {
      if (!mapa.has(a.nome)) mapa.set(a.nome, a.email);
    }
    return mapa;
  }, [alunos]);

  const [email, setEmail] = useState(proposta?.aluno_email ?? "");

  function aoDigitarAluno(valor: string) {
    const achou = emailPorNome.get(valor.trim());
    if (achou) setEmail(achou);
  }

  return (
    <form action={acao} className="flex flex-col gap-4">
      {editando && <input type="hidden" name="id" value={proposta!.id} />}

      <div className="grid gap-4 md:grid-cols-2">
        <Campo id={`aluno_nome${sufixo}`} rotulo="Aluno *" erro={estado.fieldErrors?.aluno_nome}>
          <input
            id={`aluno_nome${sufixo}`}
            name="aluno_nome"
            required
            maxLength={200}
            list={`alunos${sufixo}`}
            autoComplete="off"
            defaultValue={proposta?.aluno_nome ?? ""}
            onInput={(e) => aoDigitarAluno(e.currentTarget.value)}
            placeholder="Nome do aluno"
            className={inputCls}
          />
          <datalist id={`alunos${sufixo}`}>
            {alunos.map((a) => (
              <option key={`${a.nome}|${a.email}`} value={a.nome}>
                {a.email}
              </option>
            ))}
          </datalist>
        </Campo>
        <Campo id={`aluno_email${sufixo}`} rotulo="E-mail do aluno" erro={estado.fieldErrors?.aluno_email}>
          <input
            id={`aluno_email${sufixo}`}
            name="aluno_email"
            type="email"
            maxLength={200}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="aluno@exemplo.com"
            className={inputCls}
          />
        </Campo>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Campo id={`curso_atividade${sufixo}`} rotulo="Curso / evento / atividade *" erro={estado.fieldErrors?.curso_atividade}>
          <input
            id={`curso_atividade${sufixo}`}
            name="curso_atividade"
            required
            maxLength={200}
            list={`cursos${sufixo}`}
            autoComplete="off"
            defaultValue={proposta?.curso_atividade ?? ""}
            placeholder="Ex.: Curso de Campo — turma 2026"
            className={inputCls}
          />
          <datalist id={`cursos${sufixo}`}>
            {cursosSugeridos.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Campo>
        <Campo id={`evento_id${sufixo}`} rotulo="Vincular ao evento" erro={estado.fieldErrors?.evento_id}>
          <select
            id={`evento_id${sufixo}`}
            name="evento_id"
            defaultValue={proposta?.evento_id ? String(proposta.evento_id) : ""}
            className={inputCls}
          >
            <option value="">Sem vínculo</option>
            {eventos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.titulo}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo id={`descricao${sufixo}`} rotulo="Descrição" erro={estado.fieldErrors?.descricao}>
        <textarea
          id={`descricao${sufixo}`}
          name="descricao"
          rows={2}
          maxLength={2000}
          defaultValue={proposta?.descricao ?? ""}
          placeholder="Detalhes (parcela, desconto, combinação…)"
          className={`${inputCls} leading-relaxed`}
        />
      </Campo>

      <div className="grid gap-4 md:grid-cols-3">
        <Campo id={`valor${sufixo}`} rotulo="Valor (R$) *" erro={estado.fieldErrors?.valor}>
          <input
            id={`valor${sufixo}`}
            name="valor"
            required
            inputMode="decimal"
            defaultValue={proposta ? String(proposta.valor).replace(".", ",") : ""}
            placeholder="Ex.: 1.234,56"
            className={inputCls}
          />
        </Campo>
        <Campo id={`metodo${sufixo}`} rotulo="Método de pagamento *" erro={estado.fieldErrors?.metodo}>
          <select
            id={`metodo${sufixo}`}
            name="metodo"
            required
            defaultValue={proposta?.metodo ?? ""}
            className={inputCls}
          >
            <option value="" disabled>
              Escolha
            </option>
            {METODOS.map((m) => (
              <option key={m} value={m}>
                {METODO_LABELS[m]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id={`prazo${sufixo}`} rotulo="Prazo" erro={estado.fieldErrors?.prazo}>
          <input
            id={`prazo${sufixo}`}
            name="prazo"
            type="date"
            defaultValue={proposta?.prazo ?? ""}
            className={inputCls}
          />
        </Campo>
      </div>

      <div className={`grid gap-4 ${editando ? "md:grid-cols-2" : ""}`}>
        <Campo
          id={`sheet_url${sufixo}`}
          rotulo="Link da planilha Google do aluno"
          erro={estado.fieldErrors?.sheet_url}
        >
          <input
            id={`sheet_url${sufixo}`}
            name="sheet_url"
            type="url"
            inputMode="url"
            maxLength={2000}
            defaultValue={proposta?.sheet_url ?? ""}
            placeholder="https://docs.google.com/spreadsheets/…"
            className={inputCls}
          />
        </Campo>
        {editando && (
          <Campo id={`status-${proposta!.id}`} rotulo="Situação" erro={estado.fieldErrors?.status}>
            <select
              id={`status-${proposta!.id}`}
              name="status"
              defaultValue={proposta!.status}
              className={inputCls}
            >
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Campo>
        )}
      </div>

      <Campo id={`observacoes${sufixo}`} rotulo="Observações" erro={estado.fieldErrors?.observacoes}>
        <textarea
          id={`observacoes${sufixo}`}
          name="observacoes"
          rows={2}
          maxLength={2000}
          defaultValue={proposta?.observacoes ?? ""}
          placeholder="Ex.: aguardar comprovante, parcelado em 2x…"
          className={`${inputCls} leading-relaxed`}
        />
      </Campo>

      {estado.message && (
        <p
          role={estado.ok ? "status" : "alert"}
          className={`rounded-lg px-3 py-2 text-lg ${
            estado.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {estado.message}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pendente}
          className="flex min-h-11 items-center gap-2 rounded-lg bg-[#2195B9] px-6 text-lg font-medium text-white transition-colors hover:bg-[#28627B] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          {editando ? (
            <Save size={18} aria-hidden="true" />
          ) : (
            <PlusCircle size={18} aria-hidden="true" />
          )}
          {pendente ? "Salvando…" : editando ? "Salvar alterações" : "Registrar proposta"}
        </button>
      </div>
    </form>
  );
}
