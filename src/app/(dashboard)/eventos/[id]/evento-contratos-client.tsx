// src/app/(dashboard)/eventos/[id]/evento-contratos-client.tsx
// Gestão de contratos do evento (client): 4 blocos —
//   A. Produtos da loja vinculados (alunos inscritos = compradores)
//   B. Modelos habilitados por evento (com texto personalizado opcional)
//   C. Alunos inscritos: seleção em lote + gerar/enviar contratos
//   D. Contratos do evento: filtros por status (incl. vencidos) + cards
"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  Package,
  Plus,
  X,
  Pencil,
  Send,
  FileSignature,
  UserRound,
  CheckCircle2,
  Sparkles,
  ListChecks,
} from "lucide-react";
import {
  desabilitarModeloEvento,
  desvincularProdutoEvento,
  enviarPendentesEvento,
  gerarContratosEvento,
  habilitarModeloEvento,
  salvarConteudoPersonalizado,
  vincularProdutoEvento,
  type EventoActionState,
} from "../../contratos/evento-actions";
import ContratoCard from "../../contratos/contrato-card";

export type EventoContratosProps = {
  evento: { id: number; titulo: string; data_evento: string; local: string | null };
  produtos: Array<{ id: number; name: string; sku: string | null }>;
  produtosVinculados: Array<{ wp_product_id: number; nome_produto: string }>;
  modelosAtivos: Array<{
    id: number;
    titulo: string;
    categoria: string;
    descricao: string | null;
  }>;
  modelosVinculados: Array<{
    modelo_id: number;
    titulo: string;
    categoria: string;
    conteudo_personalizado: string | null;
  }>;
  alunos: Array<{
    wp_customer_id: number;
    first_name: string;
    last_name: string;
    email: string;
    courses: string[];
    contratos: number;
  }>;
  contratos: Array<{
    id: number;
    modelo_titulo: string;
    aluno_nome: string;
    aluno_email: string | null;
    aluno_documento: string | null;
    status: "gerado" | "assinando" | "assinado" | "recusado" | "cancelado";
    expira_em: string | null;
    drive_pasta_url: string | null;
    drive_arquivo_url: string | null;
    drive_assinado_url: string | null;
    assinafy_document_id: string | null;
    created_at: string;
    vencido: boolean;
    categoriaLabel: string;
    valorLabel: string | null;
  }>;
  statusFiltro: string;
};

const initial: EventoActionState = { ok: true, message: "" };

function Message({ state }: { state: EventoActionState }) {
  if (!state.message) return null;
  return (
    <p className={`text-lg ${state.ok ? "text-green-700" : "text-red-700"}`}>
      {state.message}
    </p>
  );
}

function normalizarTokens(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 3);
}

function sugerirProdutos(
  tituloEvento: string,
  produtos: EventoContratosProps["produtos"],
  vinculados: EventoContratosProps["produtosVinculados"]
) {
  const tituloTokens = normalizarTokens(tituloEvento);
  if (tituloTokens.length === 0) return [];
  const vinculadosSet = new Set(vinculados.map((v) => v.wp_product_id));
  return produtos
    .filter((p) => !vinculadosSet.has(p.id))
    .map((p) => {
      const tokens = normalizarTokens(p.name);
      const score = tituloTokens.filter((t) => tokens.includes(t)).length;
      return { produto: p, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((s) => s.produto);
}

// ── Bloco A: produtos da loja ─────────────────────────────────────────

function VincularButton({
  eventoId,
  produto,
}: {
  eventoId: number;
  produto: { id: number; name: string };
}) {
  const [state, action, pending] = useActionState(
    vincularProdutoEvento.bind(null, eventoId, produto.id, produto.name),
    initial
  );
  return (
    <form action={action} className="contents">
      <button
        type="submit"
        disabled={pending}
        className="flex min-h-10 items-center gap-1 rounded-full bg-[#2195B9]/10 px-3 py-1.5 text-sm font-semibold text-[#2195B9] ring-1 ring-[#2195B9]/30 transition-colors hover:bg-[#2195B9]/20 disabled:opacity-60"
      >
        <Plus size={14} aria-hidden="true" />
        {pending ? "..." : "Vincular"}
      </button>
      {state.message && (
        <span className={`text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}

function DesvincularButton({
  eventoId,
  wpProductId,
  nome,
}: {
  eventoId: number;
  wpProductId: number;
  nome: string;
}) {
  const [state, action, pending] = useActionState(
    desvincularProdutoEvento.bind(null, eventoId, wpProductId),
    initial
  );
  return (
    <form action={action} className="contents">
      <button
        type="submit"
        disabled={pending}
        title={`Desvincular ${nome}`}
        className="flex min-h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
      >
        <X size={16} aria-hidden="true" />
      </button>
      {state.message && (
        <span className={`text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}

function ProdutosBloco(props: EventoContratosProps) {
  const { evento, produtos, produtosVinculados } = props;
  const [busca, setBusca] = useState("");
  const vinculadosSet = new Set(produtosVinculados.map((v) => v.wp_product_id));

  const filtrados = busca
    ? produtos
        .filter((p) => !vinculadosSet.has(p.id))
        .filter(
          (p) =>
            p.name.toLowerCase().includes(busca.toLowerCase()) ||
            (p.sku ?? "").toLowerCase().includes(busca.toLowerCase())
        )
        .slice(0, 20)
    : [];

  const sugestoes = busca
    ? []
    : sugerirProdutos(evento.titulo, produtos, produtosVinculados);

  return (
    <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
      <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
        <Package size={24} className="text-[#2195B9]" aria-hidden="true" />
        Produtos da loja (alunos inscritos)
      </h2>
      <p className="text-lg text-zinc-600">
        Vincule o(s) produto(s) da loja que os alunos compram para se inscrever
        neste evento. Quem comprou aparece na lista de alunos abaixo.
      </p>

      {produtosVinculados.length === 0 ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-base text-amber-800 ring-1 ring-amber-200/60">
          Nenhum produto vinculado ainda — busque abaixo ou use as sugestões.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {produtosVinculados.map((v) => (
            <span
              key={v.wp_product_id}
              className="flex items-center gap-1 rounded-full bg-[#2195B9]/10 px-3 py-1.5 text-sm font-medium text-[#2195B9] ring-1 ring-[#2195B9]/30"
            >
              {v.nome_produto}
              <DesvincularButton
                eventoId={evento.id}
                wpProductId={v.wp_product_id}
                nome={v.nome_produto}
              />
            </span>
          ))}
        </div>
      )}

      {sugestoes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Sugestões pelo nome do evento
          </span>
          <div className="flex flex-wrap gap-2">
            {sugestoes.map((p) => (
              <span
                key={p.id}
                className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700"
              >
                {p.name}
                <VincularButton eventoId={evento.id} produto={p} />
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar produto da loja pelo nome..."
          className="w-full min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30"
        />
        {filtrados.length > 0 && (
          <div className="flex max-h-52 flex-col gap-1 overflow-y-auto rounded-xl border border-zinc-200 p-2">
            {filtrados.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50"
              >
                <span className="min-w-0 truncate text-sm text-zinc-700">
                  {p.name}
                  {p.sku ? <span className="text-zinc-400"> · {p.sku}</span> : null}
                </span>
                <VincularButton eventoId={evento.id} produto={p} />
              </div>
            ))}
          </div>
        )}
        {busca && filtrados.length === 0 && (
          <p className="text-sm text-zinc-500">Nenhum produto encontrado.</p>
        )}
      </div>
    </section>
  );
}

// ── Bloco B: modelos do evento ────────────────────────────────────────

function ModeloToggle({
  eventoId,
  modeloId,
  habilitado,
}: {
  eventoId: number;
  modeloId: number;
  habilitado: boolean;
}) {
  const action = habilitado
    ? desabilitarModeloEvento.bind(null, eventoId, modeloId)
    : habilitarModeloEvento.bind(null, eventoId, modeloId);
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="contents">
      <button
        type="submit"
        disabled={pending}
        className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium transition-colors disabled:opacity-60 ${
          habilitado
            ? "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            : "bg-[#2195B9] text-white hover:bg-[#28627B]"
        }`}
      >
        {habilitado ? "Desabilitar" : "Usar neste evento"}
      </button>
      {state.message && (
        <span className={`text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}

function PersonalizarModelo({
  eventoId,
  modeloId,
  conteudoAtual,
}: {
  eventoId: number;
  modeloId: number;
  conteudoAtual: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [state, action, pending] = useActionState(
    salvarConteudoPersonalizado.bind(null, eventoId, modeloId),
    initial
  );
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex min-h-10 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
      >
        <Pencil size={15} aria-hidden="true" />
        {aberto ? "Fechar" : conteudoAtual ? "Editar texto" : "Personalizar texto"}
      </button>
      {conteudoAtual && !aberto && (
        <span className="text-sm text-green-700">Texto personalizado em uso</span>
      )}
      {aberto && (
        <form action={action} className="flex flex-col gap-2">
          <textarea
            name="conteudo"
            defaultValue={conteudoAtual ?? ""}
            rows={8}
            placeholder="Cole aqui o texto adaptado para ESTE evento (pode usar as mesmas variáveis {{aluno_nome}}, {{evento_titulo}}...)."
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30"
          />
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-xl bg-[#FDBA2F] px-4 text-base font-semibold text-zinc-900 transition-colors hover:bg-[#f0ac1a] disabled:opacity-60"
          >
            {pending ? "Salvando..." : "Salvar texto deste evento"}
          </button>
          <Message state={state} />
        </form>
      )}
    </div>
  );
}

function ModelosBloco(props: EventoContratosProps) {
  const { modelosAtivos, modelosVinculados } = props;
  const vinculados = new Map(
    modelosVinculados.map((m) => [m.modelo_id, m])
  );

  return (
    <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
      <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
        <FileSignature size={24} className="text-[#2195B9]" aria-hidden="true" />
        Modelos deste evento
      </h2>
      <p className="text-lg text-zinc-600">
        Habilite os modelos que este evento usa — a geração em lote cria um
        contrato por modelo habilitado. Dá para adaptar o texto de cada um para
        este evento.
      </p>

      {modelosAtivos.length === 0 ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-base text-amber-800 ring-1 ring-amber-200/60">
          Nenhum modelo ativo.{" "}
          <Link href="/contratos/modelos" className="underline">
            Crie modelos padronizados primeiro
          </Link>
          .
        </p>
      ) : (
        <div className="flex w-full flex-col gap-2">
          {modelosAtivos.map((modelo) => {
            const vinculo = vinculados.get(modelo.id);
            const habilitado = Boolean(vinculo);
            return (
              <div
                key={modelo.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
                  habilitado ? "border-[#2195B9]/40 bg-[#2195B9]/5" : "border-zinc-200"
                }`}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-lg font-medium text-zinc-900">
                    {modelo.titulo}
                  </span>
                  {modelo.descricao && (
                    <span className="text-sm text-zinc-500">{modelo.descricao}</span>
                  )}
                  {habilitado && (
                    <span className="text-sm font-medium text-green-700">
                      {vinculo?.conteudo_personalizado
                        ? "Texto personalizado para este evento"
                        : "Usando o texto padrão do modelo"}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {habilitado && (
                    <PersonalizarModelo
                      eventoId={props.evento.id}
                      modeloId={modelo.id}
                      conteudoAtual={vinculo?.conteudo_personalizado ?? null}
                    />
                  )}
                  <ModeloToggle
                    eventoId={props.evento.id}
                    modeloId={modelo.id}
                    habilitado={habilitado}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Bloco C: alunos + geração em lote ─────────────────────────────────

function AlunosBloco(props: EventoContratosProps) {
  const { evento, alunos, modelosVinculados } = props;
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [state, action, pending] = useActionState(
    gerarContratosEvento.bind(null, evento.id),
    initial
  );

  function toggle(id: number, checked: boolean) {
    setSelecionados((atual) => {
      const prox = new Set(atual);
      if (checked) prox.add(id);
      else prox.delete(id);
      return prox;
    });
  }

  function onValid() {
    if (selecionados.size === 0) return;
    const fd = new FormData();
    for (const id of selecionados) fd.append("alunos", String(id));
    const dias = document.querySelector<HTMLInputElement>('input[name="expiraDias"]');
    if (dias?.value) fd.set("expiraDias", dias.value);
    const enviar = document.querySelector<HTMLInputElement>('input[name="enviar"]');
    if (enviar?.checked) fd.set("enviar", "1");
    action(fd);
  }

  const todosSelecionados =
    alunos.length > 0 && selecionados.size === alunos.length;

  if (props.produtosVinculados.length === 0) {
    return (
      <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <UserRound size={24} className="text-[#2195B9]" aria-hidden="true" />
          Alunos inscritos
        </h2>
        <p className="rounded-xl bg-zinc-50 px-4 py-3 text-base text-zinc-600">
          Vincule ao menos um produto da loja (bloco acima) para listar os
          alunos que compraram a inscrição deste evento.
        </p>
      </section>
    );
  }

  return (
    <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <UserRound size={24} className="text-[#2195B9]" aria-hidden="true" />
          Alunos inscritos ({alunos.length})
        </h2>
        {alunos.length > 0 && (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-700 hover:bg-zinc-50">
            <input
              type="checkbox"
              checked={todosSelecionados}
              onChange={(e) =>
                setSelecionados(
                  e.target.checked ? new Set(alunos.map((a) => a.wp_customer_id)) : new Set()
                )
              }
              className="h-5 w-5 accent-[#2195B9]"
            />
            Selecionar todos
          </label>
        )}
      </div>

      {alunos.length === 0 ? (
        <p className="rounded-xl bg-zinc-50 px-4 py-3 text-base text-zinc-600">
          Nenhum aluno encontrado com estes produtos. Confira se a loja já foi
          sincronizada (Vendas → sincronizar) e se o nome do produto bate com o
          que aparece no pedido.
        </p>
      ) : (
        <div className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-xl border border-zinc-200 p-2">
          {alunos.map((aluno) => {
            const nome = [aluno.first_name, aluno.last_name].filter(Boolean).join(" ");
            const produtosDoAluno = aluno.courses.filter((c) =>
              props.produtosVinculados.some((v) => v.nome_produto === c)
            );
            return (
              <label
                key={aluno.wp_customer_id}
                className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[#2195B9]/5"
              >
                <input
                  type="checkbox"
                  checked={selecionados.has(aluno.wp_customer_id)}
                  onChange={(e) => toggle(aluno.wp_customer_id, e.target.checked)}
                  className="mt-1 h-5 w-5 accent-[#2195B9]"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium text-zinc-900">{nome || "—"}</span>
                  <span className="break-all text-sm text-zinc-500">{aluno.email}</span>
                  <span className="flex flex-wrap gap-1">
                    {produtosDoAluno.map((curso) => (
                      <span
                        key={curso}
                        className="rounded-full bg-[#2195B9]/10 px-2 py-0.5 text-xs font-medium text-[#2195B9] ring-1 ring-[#2195B9]/20"
                      >
                        {curso}
                      </span>
                    ))}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-medium ${
                    aluno.contratos > 0
                      ? "bg-green-50 text-green-800 ring-1 ring-green-200/60"
                      : "bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200/60"
                  }`}
                >
                  {aluno.contratos > 0
                    ? `${aluno.contratos} contrato${aluno.contratos === 1 ? "" : "s"}`
                    : "sem contrato"}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {selecionados.size > 0 && (
        <div className="flex flex-col gap-2 rounded-xl bg-[#2195B9]/5 p-4 ring-1 ring-[#2195B9]/30">
          <p className="text-base font-medium text-zinc-800">
            {selecionados.size} aluno{selecionados.size === 1 ? "" : "s"} ×{" "}
            {modelosVinculados.length} modelo{modelosVinculados.length === 1 ? "" : "s"} ={" "}
            {selecionados.size * modelosVinculados.length} contrato
            {selecionados.size * modelosVinculados.length === 1 ? "" : "s"}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
              Prazo para assinar (dias)
              <input
                type="number"
                name="expiraDias"
                defaultValue="15"
                min="1"
                max="90"
                className="min-h-11 w-24 rounded-xl border border-zinc-300 bg-white px-3 text-base"
              />
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-700 hover:bg-zinc-50">
              <input
                type="checkbox"
                name="enviar"
                defaultChecked
                className="h-5 w-5 accent-[#2195B9]"
              />
              Já enviar para assinatura
            </label>
            <button
              type="button"
              disabled={pending || modelosVinculados.length === 0}
              onClick={onValid}
              className="flex min-h-12 items-center gap-2 rounded-xl bg-[#2195B9] px-5 text-base font-semibold text-white transition-colors hover:bg-[#28627B] disabled:opacity-60"
            >
              <Send size={17} aria-hidden="true" />
              {pending
                ? "Gerando..."
                : modelosVinculados.length === 0
                  ? "Habilite um modelo"
                  : "Gerar e enviar contratos"}
            </button>
          </div>
          <Message state={state} />
        </div>
      )}
    </section>
  );
}

// ── Bloco D: contratos do evento ──────────────────────────────────────

const STATUS_FILTROS = [
  { key: "", label: "Todos" },
  { key: "gerado", label: "Aguardando" },
  { key: "assinando", label: "Em assinatura" },
  { key: "vencido", label: "Vencidos" },
  { key: "assinado", label: "Assinados" },
  { key: "recusado", label: "Recusados" },
  { key: "cancelado", label: "Cancelados" },
] as const;

function ContratosBloco(props: EventoContratosProps) {
  const { evento, contratos, statusFiltro } = props;
  const [pendState, pendAction, pendPending] = useActionState(
    enviarPendentesEvento.bind(null, evento.id),
    initial
  );

  const counts = new Map<string, number>();
  for (const c of contratos) {
    counts.set("", (counts.get("") ?? 0) + 1);
    counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
    if (c.vencido) counts.set("vencido", (counts.get("vencido") ?? 0) + 1);
  }

  const filtrados = contratos.filter((c) => {
    if (statusFiltro === "vencido") return c.vencido;
    if (!statusFiltro) return true;
    return c.status === statusFiltro;
  });

  const pendentes = counts.get("gerado") ?? 0;

  return (
    <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <ListChecks size={24} className="text-[#2195B9]" aria-hidden="true" />
          Contratos do evento ({contratos.length})
        </h2>
        {pendentes > 0 && (
          <form action={pendAction}>
            <button
              type="submit"
              disabled={pendPending}
              className="flex min-h-11 items-center gap-1.5 rounded-xl bg-[#FDBA2F] px-4 text-base font-semibold text-zinc-900 transition-colors hover:bg-[#f0ac1a] disabled:opacity-60"
            >
              <Send size={16} aria-hidden="true" />
              {pendPending ? "Enviando..." : `Enviar ${pendentes} pendente${pendentes === 1 ? "" : "s"}`}
            </button>
          </form>
        )}
      </div>
      <Message state={pendState} />

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTROS.map((f) => (
          <Link
            key={f.key}
            href={`/eventos/${evento.id}/contratos${f.key ? `?status=${f.key}` : ""}`}
            className={`flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
              statusFiltro === f.key
                ? "bg-[#2195B9] text-white"
                : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {f.label}
            {(counts.get(f.key) ?? 0) > 0 && (
              <span
                className={`rounded-full px-2 text-xs font-semibold ${
                  statusFiltro === f.key ? "bg-white/20" : "bg-zinc-100"
                }`}
              >
                {counts.get(f.key) ?? 0}
              </span>
            )}
          </Link>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 size={40} className="text-zinc-300" aria-hidden="true" />
          <p className="text-xl text-zinc-600">
            {contratos.length === 0
              ? "Nenhum contrato gerado ainda — selecione alunos acima."
              : "Nenhum contrato neste status."}
          </p>
        </div>
      ) : (
        <div className="grid w-full gap-4 lg:grid-cols-2">
          {filtrados.map((c) => (
            <ContratoCard
              key={c.id}
              contrato={c}
              vencido={c.vencido}
              eventoData={null}
              categoriaLabel={c.categoriaLabel}
              valorLabel={c.valorLabel}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Página ────────────────────────────────────────────────────────────

export default function EventoContratosClient(props: EventoContratosProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2 text-lg text-zinc-600">
        <Sparkles size={18} className="text-[#FDBA2F]" aria-hidden="true" />
        <span className="font-medium text-zinc-800">{props.evento.titulo}</span>
        {props.evento.data_evento &&
          new Date(`${props.evento.data_evento.slice(0, 10)}T00:00:00`).toLocaleDateString(
            "pt-BR"
          )}
        {props.evento.local ? ` · ${props.evento.local}` : ""}
      </div>

      <ProdutosBloco {...props} />
      <ModelosBloco {...props} />
      <AlunosBloco {...props} />
      <ContratosBloco {...props} />
    </div>
  );
}
