"use client";

// Merge de cadastros repetidos (migration 0028) — vincula um cadastro
// "perdido" (roster sem conta vinculada) a um perfil já cadastrado pelo
// link. As referências do cadastro antigo são movidas e o duplicado
// removido. Visível apenas para coordenador_geral / voluntariado.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GitMerge, UserRoundCheck } from "lucide-react";
import { vincularCadastroPerdido } from "./actions";
import { FormSelect } from "@/components/ui/form-select";

export type MergePerfilOpcao = {
  id: string;
  email: string;
  voluntarioId: number | null;
  vinculadoNome: string | null;
  pendente: boolean;
};

export default function MergeVincularSection({
  perfis,
  cadastrosPerdidos,
}: {
  perfis: MergePerfilOpcao[];
  cadastrosPerdidos: { id: number; nome: string }[];
}) {
  const router = useRouter();
  const [perfilId, setPerfilId] = useState("");
  const [cadastroId, setCadastroId] = useState("");
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const [executando, setExecutando] = useState(false);
  const [, startTransition] = useTransition();

  const perfilEscolhido = perfis.find((p) => p.id === perfilId) ?? null;

  async function executar() {
    setExecutando(true);
    setMensagem(null);
    const r = await vincularCadastroPerdido(Number(cadastroId), perfilId);
    setExecutando(false);
    setMensagem({ ok: r.ok, texto: r.message });
    if (r.ok) {
      setPerfilId("");
      setCadastroId("");
      startTransition(() => router.refresh());
    }
  }

  return (
    <section className="flex w-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
      <div className="flex flex-wrap items-center gap-3">
        <span className="h-8 w-1.5 rounded-full bg-green-600" aria-hidden="true" />
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <GitMerge size={22} aria-hidden="true" className="text-green-600" />
          Vincular cadastro perdido (merge)
        </h2>
      </div>
      <p className="text-base text-zinc-500">
        Junta um cadastro do roster que ficou sem conta com um perfil já
        cadastrado pelo link. As responsabilidades, participações e
        atividades do cadastro antigo são movidas para o definitivo e o
        duplicado é removido.
      </p>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-lg font-medium text-zinc-900">Conta (perfil)</span>
          <FormSelect
            value={perfilId}
            onValueChange={setPerfilId}
            placeholder="Escolha a conta"
            ariaLabel="Escolha a conta"
            options={perfis.map((p) => ({
              value: p.id,
              label: p.vinculadoNome
                ? `${p.email} (vinculado a ${p.vinculadoNome})`
                : p.pendente
                  ? `${p.email} (aguardando vínculo)`
                  : p.email,
            }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-lg font-medium text-zinc-900">Cadastro (roster)</span>
          <FormSelect
            value={cadastroId}
            onValueChange={setCadastroId}
            placeholder="Escolha o cadastro"
            ariaLabel="Escolha o cadastro"
            options={cadastrosPerdidos.map((c) => ({
              value: String(c.id),
              label: c.nome,
            }))}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={executar}
          disabled={!perfilId || !cadastroId || executando}
          className="flex min-h-12 items-center gap-2 rounded-xl bg-green-700 px-5 text-lg font-medium text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UserRoundCheck size={18} aria-hidden="true" />
          {executando ? "Vinculando..." : "Vincular e mesclar"}
        </button>

        {perfilEscolhido?.vinculadoNome && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-base font-medium text-amber-800 ring-1 ring-amber-200/60">
            O perfil já está vinculado a &quot;{perfilEscolhido.vinculadoNome}&quot; —
            este cadastro será mesclado nele.
          </span>
        )}

        {mensagem && (
          <span className={`text-base ${mensagem.ok ? "text-green-800" : "text-red-700"}`}>
            {mensagem.texto}
          </span>
        )}
      </div>
    </section>
  );
}
