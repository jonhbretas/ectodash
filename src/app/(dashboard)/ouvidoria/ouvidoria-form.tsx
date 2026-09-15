"use client";

// src/app/(dashboard)/ouvidoria/ouvidoria-form.tsx
// Formulário de envio anônimo com orientação de comunicação não-violenta:
// reforça relato respeitoso focado em COMO a pessoa se sente.
import { useActionState } from "react";
import { HeartHandshake, Lock, Send } from "lucide-react";
import { enviarRelato, type ActionResult } from "./ouvidoria-actions";

export const CATEGORIA_LABELS: Record<string, string> = {
  coordenacao_geral: "Coordenação geral",
  coordenacao_diaria: "Coordenação do dia a dia",
  convivencia_voluntarios: "Convivência com voluntários",
  vivencia_pessoal: "Vivência pessoal / experiência",
  outro: "Outro assunto",
};

export const SENTIMENTO_LABELS: Record<string, string> = {
  acolhido: "Acolhido(a)",
  preocupado: "Preocupado(a)",
  frustrado: "Frustrado(a)",
  desmotivado: "Desmotivado(a)",
  esperancoso: "Esperançoso(a)",
  grato: "Grato(a)",
  inseguro: "Inseguro(a)",
  outro: "Outro",
};

const INICIAL: ActionResult = { ok: false };

export default function OuvidoriaForm({ cicloLabel }: { cicloLabel: string }) {
  const [estado, acao, pendente] = useActionState(enviarRelato, INICIAL);

  return (
    <section
      aria-labelledby="ouvidoria-form-titulo"
      className="flex flex-col gap-4 rounded-xl border border-zinc-300 bg-white p-5"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="ouvidoria-form-titulo"
          className="flex items-center gap-2 text-2xl font-semibold text-zinc-900"
        >
          <HeartHandshake size={24} aria-hidden="true" className="text-[#2195B9]" />
          Como você está se sentindo?
        </h2>
        <p className="text-lg text-zinc-600">
          Caixinha de <strong>{cicloLabel}</strong> — lacrada até a reunião mensal do
          colegiado gestor.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg bg-[#2195B9]/5 px-4 py-3 text-lg leading-relaxed text-zinc-700">
        <p>
          <strong>Este espaço é para cuidar do grupo.</strong> Escreva sobre{" "}
          <strong>como você se sente</strong> e do que precisa — não sobre o que o
          outro fez ou deixou de fazer.
        </p>
        <ul className="list-disc pl-6">
          <li>Use &ldquo;eu me sinto&hellip;&rdquo; em vez de &ldquo;fulano é&hellip;&rdquo;.</li>
          <li>Evite nomes, apelidos ou detalhes que identifiquem alguém.</li>
          <li>Termine com uma sugestão de melhoria, se puder.</li>
        </ul>
        <p className="flex items-center gap-2 text-base text-zinc-600">
          <Lock size={16} aria-hidden="true" />
          Anônimo para todos. A identidade fica registrada sob sigilo e só pode ser
          revelada pelo coordenador geral em caso excepcional de mau uso, com motivo
          registrado em auditoria.
        </p>
      </div>

      <form action={acao} className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="categoria" className="text-base font-medium text-zinc-700">
              Tema
            </label>
            <select
              id="categoria"
              name="categoria"
              required
              defaultValue=""
              className="min-h-11 rounded-lg border border-zinc-400 bg-white px-3 py-2 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            >
              <option value="" disabled>
                Escolha o tema
              </option>
              {Object.entries(CATEGORIA_LABELS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sentimento" className="text-base font-medium text-zinc-700">
              Como você se sente? <span className="font-normal text-zinc-500">(opcional)</span>
            </label>
            <select
              id="sentimento"
              name="sentimento"
              defaultValue=""
              className="min-h-11 rounded-lg border border-zinc-400 bg-white px-3 py-2 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            >
              <option value="">Prefiro não dizer</option>
              {Object.entries(SENTIMENTO_LABELS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="mensagem" className="text-base font-medium text-zinc-700">
            Seu relato (mínimo 10 caracteres)
          </label>
          <textarea
            id="mensagem"
            name="mensagem"
            required
            minLength={10}
            maxLength={4000}
            rows={6}
            placeholder="Ex.: Na última semana eu me senti inseguro quando… Eu precisaria de… Sugiro que a gente…"
            className="rounded-lg border border-zinc-400 bg-white px-3 py-2 text-lg leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-zinc-50 px-3 py-2 text-lg text-zinc-700">
          <input
            type="checkbox"
            name="confirma_respeitoso"
            required
            className="mt-1 h-5 w-5 accent-[#2195B9]"
          />
          <span>
            Confirmo que meu relato é <strong>respeitoso</strong>, fala sobre{" "}
            <strong>como eu me sinto</strong> e busca a melhoria do trabalho em grupo.
          </span>
        </label>

        {estado.error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-lg text-red-700">
            {estado.error}
          </p>
        )}
        {estado.ok && (
          <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-lg text-green-700">
            Relato guardado na caixinha com sigilo. Obrigado por cuidar do grupo.
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={pendente}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-[#2195B9] px-6 text-lg font-medium text-white transition-colors hover:bg-[#28627B] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            <Send size={18} aria-hidden="true" />
            {pendente ? "Guardando…" : "Guardar na caixinha"}
          </button>
        </div>
      </form>
    </section>
  );
}
