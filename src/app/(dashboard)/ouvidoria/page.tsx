import { HeartHandshake } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import OuvidoriaForm from "./ouvidoria-form";
import OuvidoriaColegiado, { type CicloColegiado } from "./ouvidoria-colegiado";

// src/app/(dashboard)/ouvidoria/page.tsx
// Ouvidoria dos voluntários: envio anônimo (qualquer autenticado) +
// painel do colegiado gestor (leitura anonimizada por ciclo mensal
// lacrado) + quebra de sigilo exclusiva do coordenador geral.
// O sigilo é garantido no banco (0095): a tabela de relatos não tem
// policy direta — todo acesso passa por RPCs SECURITY DEFINER.

type MeuRelato = {
  id: string;
  categoria: string;
  sentimento: string | null;
  mensagem: string;
  status: string;
  created_at: string;
  ciclo_referencia: string;
  ciclo_status: string;
  nota_colegiado: string | null;
};

const CATEGORIA_LABELS: Record<string, string> = {
  coordenacao_geral: "Coordenação geral",
  coordenacao_diaria: "Coordenação do dia a dia",
  convivencia_voluntarios: "Convivência com voluntários",
  vivencia_pessoal: "Vivência pessoal / experiência",
  outro: "Outro assunto",
};

function rotuloMes(ref: string): string {
  const [ano, mes] = ref.split("-");
  const nome = format(new Date(Number(ano), Number(mes) - 1, 1), "MMMM/yyyy", {
    locale: ptBR,
  });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

export default async function OuvidoriaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isGeral = profile?.role === "coordenador_geral";
  const { data: colegiado } = await supabase.rpc("eh_colegiado");
  const isColegiado = colegiado === true;

  const { data: ciclosAbertos } = await supabase
    .from("ouvidoria_ciclos")
    .select("id, referencia, status, opened_at, closed_at, resumo_colegiado, encaminhamentos")
    .order("referencia", { ascending: false })
    .limit(12);

  const listaCiclos = (ciclosAbertos ?? []).map((c) => ({
    id: String(c.id),
    referencia: String(c.referencia),
    status: String(c.status),
  }));
  const atual =
    listaCiclos.find((c) => c.status === "coletando") ??
    listaCiclos[0] ??
    null;
  const referenciaAtual = atual?.referencia ?? format(new Date(), "yyyy-MM");
  const cicloAtualLabel = rotuloMes(referenciaAtual);

  const { data: meus } = await supabase.rpc("meus_relatos_ouvidoria");
  const meusRelatos: MeuRelato[] = ((meus ?? []) as Array<Record<string, unknown>>).map(
    (r) => ({
      id: String(r.id),
      categoria: String(r.categoria),
      sentimento: (r.sentimento as string | null) ?? null,
      mensagem: String(r.mensagem),
      status: String(r.status),
      created_at: String(r.created_at),
      ciclo_referencia: String(r.ciclo_referencia),
      ciclo_status: String(r.ciclo_status),
      nota_colegiado: (r.nota_colegiado as string | null) ?? null,
    })
  );

  let ciclosColegiado: CicloColegiado[] = [];
  if (isColegiado) {
    const { data } = await supabase.rpc("listar_ciclos_colegiado");
    ciclosColegiado = ((data ?? []) as Array<Record<string, unknown>>).map((c) => ({
      id: String(c.id),
      referencia: String(c.referencia),
      status: String(c.status),
      total_relatos: Number(c.total_relatos ?? 0),
      total_novos: Number(c.total_novos ?? 0),
      opened_at: (c.opened_at as string | null) ?? null,
      closed_at: (c.closed_at as string | null) ?? null,
      resumo_colegiado: (c.resumo_colegiado as string | null) ?? null,
      encaminhamentos: (c.encaminhamentos as string | null) ?? null,
    }));
  }

  const ultimoConcluido = (ciclosAbertos ?? []).find(
    (c) => String(c.status) === "concluido"
  ) as
    | {
        referencia: string;
        resumo_colegiado: string | null;
        encaminhamentos: string | null;
      }
    | undefined;

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <HeartHandshake size={30} aria-hidden="true" />
            Ouvidoria — escuta dos voluntários
          </h1>
          <p className="max-w-2xl text-xl text-zinc-500">
            Espaço anônimo para compartilhar como você se sente e ajudar na reciclagem
            institucional. O colegiado gestor abre a caixinha uma vez por mês, em reunião.
          </p>
        </div>
      </header>

      <OuvidoriaForm cicloLabel={cicloAtualLabel} />

      <section
        aria-labelledby="meus-envios-titulo"
        className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-5"
      >
        <h2 id="meus-envios-titulo" className="text-2xl font-semibold text-zinc-900">
          Meus envios ({meusRelatos.length})
        </h2>
        {meusRelatos.length === 0 ? (
          <p className="text-lg text-zinc-600">
            Você ainda não guardou nenhum relato. Quando enviar, ele aparece aqui só para
            você — ninguém mais vê quem escreveu.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {meusRelatos.slice(0, 10).map((r) => (
              <li key={r.id} className="rounded-lg bg-zinc-50 px-4 py-3">
                <p className="text-base text-zinc-500">
                  {rotuloMes(r.ciclo_referencia)} ·{" "}
                  {CATEGORIA_LABELS[r.categoria] ?? r.categoria} ·{" "}
                  {r.ciclo_status === "coletando"
                    ? "na caixinha lacrada"
                    : r.ciclo_status === "aberto"
                      ? "em análise pelo colegiado"
                      : "ciclo concluído"}
                </p>
                <p className="whitespace-pre-wrap break-words text-lg text-zinc-900">
                  {r.mensagem}
                </p>
                {r.nota_colegiado && (
                  <p className="mt-1 text-lg text-zinc-700">
                    <strong>Retorno do colegiado:</strong> {r.nota_colegiado}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {ultimoConcluido?.resumo_colegiado && (
        <section
          aria-labelledby="retorno-titulo"
          className="flex flex-col gap-2 rounded-xl border border-green-200 bg-green-50/60 p-5"
        >
          <h2 id="retorno-titulo" className="text-2xl font-semibold text-zinc-900">
            Retorno do colegiado — {rotuloMes(ultimoConcluido.referencia)}
          </h2>
          <p className="text-lg text-zinc-700">{ultimoConcluido.resumo_colegiado}</p>
          {ultimoConcluido.encaminhamentos && (
            <p className="text-lg text-zinc-700">
              <strong>Encaminhamentos:</strong> {ultimoConcluido.encaminhamentos}
            </p>
          )}
        </section>
      )}

      {isColegiado && <OuvidoriaColegiado ciclos={ciclosColegiado} isGeral={isGeral} />}
    </PageContainer>
  );
}
