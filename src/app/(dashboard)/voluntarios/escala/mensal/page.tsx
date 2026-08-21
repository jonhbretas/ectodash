// /voluntarios/escala/mensal — visão calendarizada das escalas do mês.
// Mostra uma tabela com as sextas-feiras como colunas e funções como linhas.
import Link from "next/link";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../../page-container";
import { buscarEscalasMes } from "../actions";

const FUNCOES_ORDEM = [
  "Epicon",
  "Observador Parapsíquico",
  "Cronometrista",
  "Energizador 1",
  "Energizador 2",
  "Energizador 3",
  "Monitoria",
  "Acoplador 1",
  "Acoplador 2",
];

function formatarDataCurta(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatarDiaSemana(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short" });
}

function nomeBaseFuncao(funcao: string): string {
  return funcao.replace(/ \d+$/, "");
}

export default async function EscalaMensalPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Mês/ano atual ou dos params
  const agora = new Date();
  const mes = Number(params.mes) || agora.getMonth() + 1;
  const ano = Number(params.ano) || agora.getFullYear();

  // Buscar escalas do mês
  const escalas = await buscarEscalasMes(ano, mes);

  // Navegação entre meses
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const anoAnterior = mes === 1 ? ano - 1 : ano;
  const mesProximo = mes === 12 ? 1 : mes + 1;
  const anoProximo = mes === 12 ? ano + 1 : ano;

  const nomeMes = new Date(ano, mes - 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  // Mapear alocações por data e função
  // chave: "dataSemana:nomeBaseFuncao" -> nomes dos voluntários
  const alocacoesMap = new Map<string, string[]>();
  for (const escala of escalas) {
    for (const a of escala.alocacoes) {
      const base = nomeBaseFuncao(a.funcao);
      const key = `${escala.data_semana}:${base}`;
      const lista = alocacoesMap.get(key) ?? [];
      lista.push(a.voluntario_nome);
      alocacoesMap.set(key, lista);
    }
  }

  return (
    <PageContainer>
      <Link
        href="/voluntarios/escala"
        className="inline-flex w-fit items-center gap-1.5 text-base font-medium text-zinc-400 transition-colors hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar para as escalas
      </Link>

      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <CalendarDays size={30} aria-hidden="true" />
            Visão Mensal
          </h1>
          <p className="text-xl text-zinc-500">
            Escala do mês — rotação de funções nas sextas-feiras.
          </p>
        </div>
      </header>

      {/* Navegação de meses */}
      <div className="flex items-center gap-4">
        <Link
          href={`/voluntarios/escala/mensal?mes=${mesAnterior}&ano=${anoAnterior}`}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50"
        >
          <ChevronLeft size={20} />
        </Link>
        <h2 className="min-w-[200px] text-center text-xl font-semibold capitalize text-zinc-900">
          {nomeMes}
        </h2>
        <Link
          href={`/voluntarios/escala/mensal?mes=${mesProximo}&ano=${anoProximo}`}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50"
        >
          <ChevronRight size={20} />
        </Link>
      </div>

      {escalas.length === 0 ? (
        <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <CalendarDays size={48} className="text-zinc-400" />
          <h2 className="text-2xl font-semibold text-zinc-900">
            Nenhuma escala neste mês
          </h2>
          <p className="text-lg text-zinc-500">
            Crie escalas semanais para visualizar a rotação mensal.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-zinc-50 px-4 py-3 text-left text-lg font-semibold text-zinc-900 ring-1 ring-zinc-200/60">
                  Função
                </th>
                {escalas.map((escala) => (
                  <th
                    key={escala.id}
                    className="min-w-[140px] px-4 py-3 text-center"
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-sm font-medium text-zinc-500">
                        {formatarDiaSemana(escala.data_semana)}
                      </span>
                      <span className="text-lg font-semibold text-zinc-900">
                        {formatarDataCurta(escala.data_semana)}
                      </span>
                      {escala.localidade && (
                        <span className="max-w-[120px] truncate text-xs text-zinc-400">
                          {escala.localidade}
                        </span>
                      )}
                      <span
                        className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                          escala.status === "publicada"
                            ? "bg-emerald-50 text-emerald-700"
                            : escala.status === "rascunho"
                            ? "bg-zinc-100 text-zinc-600"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {escala.status}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FUNCOES_ORDEM.map((funcao, i) => (
                <tr
                  key={funcao}
                  className={i % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}
                >
                  <td className="sticky left-0 z-10 bg-inherit px-4 py-3 text-lg font-medium text-zinc-900 ring-1 ring-zinc-200/60">
                    {funcao}
                  </td>
                  {escalas.map((escala) => {
                    const key = `${escala.data_semana}:${funcao}`;
                    const nomes = alocacoesMap.get(key) ?? [];
                    return (
                      <td
                        key={escala.id}
                        className="px-3 py-3 text-center"
                      >
                        {nomes.length === 0 ? (
                          <span className="text-sm text-zinc-300">—</span>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            {nomes.map((nome, idx) => (
                              <span
                                key={idx}
                                className="rounded-md bg-[#2195B9]/10 px-2 py-0.5 text-sm font-medium text-[#2195B9]"
                              >
                                {nome}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
