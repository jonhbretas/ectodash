// /voluntarios/[id] — volunteer detail: the full roster record (migration
// 0017) plus, when the volunteer's account is linked, their demandas.
// Visibility follows RLS (0017): a volunteer sees their own record; a
// coordenador_geral/voluntariado sees any; a coordenador_area sees their
// own áreas.
import Link from "next/link";
import {
  UserRound,
  ClipboardList,
  Lock,
  Pencil,
  UserRoundCheck,
  CalendarClock,
  NotebookPen,
  MoonStar,
  MessageCircle,
  Mail,
  Phone,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { roleLabel } from "@/lib/role-labels";
import PageContainer from "../../page-container";
import StatusBadge from "../../demandas/status-badge";
import OverdueBadge from "../../demandas/overdue-badge";
import AtividadesSection from "../atividades-section";
import SituacaoToggle from "../situacao-toggle";

type VoluntarioPageProps = {
  params: Promise<{ id: string }>;
};

function formatData(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return format(new Date(`${iso}T00:00:00`), "dd/MM/yyyy", { locale: ptBR });
}

// Format phone number to only digits for WhatsApp link
function phoneToDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

// Format phone for display
function formatPhoneDisplay(phone: string): string {
  const digits = phoneToDigits(phone);
  if (digits.length <= 2) return phone;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  // International or long numbers
  return phone;
}

function normalizePhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return "55" + digits;
}

function WhatsAppLink({ phone, label }: { phone: string; label: string }) {
  const normalized = normalizePhoneForWhatsApp(phone);
  return (
    <a
      href={`https://wa.me/${normalized}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xl text-[#2195B9] underline decoration-[#2195B9]/30 transition-colors hover:text-[#28627B] hover:decoration-[#28627B]/50"
    >
      {label}
    </a>
  );
}

function phoneToWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits;
}

function PhoneLink({ phone, label }: { phone: string; label: string }) {
  const digits = phoneToWhatsApp(phone);
  if (!digits || digits.length < 8) return null;
  return (
    <a
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-lg text-[#2195B9] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
    >
      <Phone size={14} aria-hidden="true" />
      {label}: {phone}
    </a>
  );
}

type DemandaRow = {
  id: number;
  titulo: string;
  prazo: string;
  status: "pendente" | "em_andamento" | "concluida";
  atrasada: boolean;
};

export default async function VoluntarioPage({ params }: VoluntarioPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, voluntario_id")
    .eq("id", user.id)
    .single();
  const role = me?.role;
  const canManage =
    role === "coordenador_geral" ||
    role === "voluntariado" ||
    role === "coordenador_area";

  const { data: voluntario } = await supabase
    .from("voluntarios")
    .select(
      "id, nome, codigo_pf, unidade, org_depto, funcao, data_inicio, data_saida, obs, area_atuacao, role, ativo, situacao, telefone1, telefone2, profiles(id, email, role)"
    )
    .eq("id", Number(id))
    .maybeSingle();

  if (!voluntario) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">
            Voluntário não encontrado ou sem acesso
          </h1>
          <Link
            href="/voluntarios"
            className="flex min-h-14 items-center justify-center rounded-lg bg-[#2195B9] px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            Voltar para a equipe
          </Link>
        </div>
      </PageContainer>
    );
  }

  const linked = Array.isArray(voluntario.profiles)
    ? voluntario.profiles[0]
    : voluntario.profiles;
  const effectiveRole = linked?.role ?? voluntario.role ?? "voluntario_comum";
  const afastado = Boolean(voluntario.data_saida);

  // Demandas of this volunteer — assigned either to their linked account
  // (profile_id) or directly to their roster row (voluntario_id, migration
  // 0020: volunteers without an account are assignable too).
  let ativas: DemandaRow[] = [];
  let historico: DemandaRow[] = [];

  let links = null;
  if (linked?.id) {
    const result = await supabase
      .from("demanda_responsaveis")
      .select("demanda_id")
      .or(`profile_id.eq.${linked.id},voluntario_id.eq.${voluntario.id}`);
    links = result.data;
  } else {
    const result = await supabase
      .from("demanda_responsaveis")
      .select("demanda_id")
      .eq("voluntario_id", voluntario.id);
    links = result.data;
  }

  const idsDeDemandas = (links ?? []).map((row) => row.demanda_id);
  const demandas = idsDeDemandas.length
    ? (
        await supabase
          .from("demandas_com_status")
          .select("id, titulo, prazo, status, atrasada")
          .in("id", idsDeDemandas)
          .order("prazo", { ascending: true })
      ).data ?? []
    : [];

  ativas = demandas.filter((d) => d.status !== "concluida") as DemandaRow[];
  historico = demandas.filter((d) => d.status === "concluida") as DemandaRow[];

  // Atividades de conscienciologia (migration 0026) — o próprio voluntário
  // (ou o coordenador) preenche.
  const { data: atividadesRows } = await supabase
    .from("voluntario_atividades")
    .select("atividade")
    .eq("voluntario_id", voluntario.id);
  const atividades = (atividadesRows ?? []).map((a) => a.atividade);
  const ehProprioCadastro = me?.voluntario_id === voluntario.id;

  const situacao = voluntario.situacao === "ocioso" ? "ocioso" : "ativo";

  // Áreas adicionais (migration 0027) — além da área principal.
  const { data: areasExtrasRows } = await supabase
    .from("voluntario_areas")
    .select("area")
    .eq("voluntario_id", voluntario.id);
  const areasExtras = (areasExtrasRows ?? []).map((a) => a.area);

  // Participação em reuniões gerais (ata_participantes, migration 0023) —
  // the per-volunteer participation metric the coordinator can see here.
  const { data: participacoesRows } = await supabase
    .from("ata_participantes")
    .select("ata_id, reunioes(titulo, data_reuniao)")
    .eq("voluntario_id", voluntario.id);

  type AtaRow = { titulo: string; data_reuniao: string };
  const participacoes = (participacoesRows ?? [])
    .map((row) => {
      const ata = Array.isArray(row.reunioes) ? row.reunioes[0] : row.reunioes;
      if (!ata) return null;
      return {
        ataId: row.ata_id,
        ...(ata as AtaRow),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => b.data_reuniao.localeCompare(a.data_reuniao));

  return (
    <PageContainer>
      <div className="flex w-full flex-col gap-5">
        <div className="flex w-full flex-col gap-5 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
                  <UserRound size={30} aria-hidden="true" />
                  {voluntario.nome}
                </h1>
                {linked && (
                  <span className="flex items-center gap-1 rounded-full bg-[#E6E6E6] px-2.5 py-0.5 text-base font-medium text-[#28627B] ring-1 ring-[#E6E6E6]/60">
                    <UserRoundCheck size={14} aria-hidden="true" />
                    Vinculado
                  </span>
                )}
                {afastado && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-base font-medium text-amber-800 ring-1 ring-amber-200/60">
                    <CalendarClock size={14} aria-hidden="true" />
                    Saída: {formatData(voluntario.data_saida)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-base font-medium text-zinc-800 ring-1 ring-zinc-200/60">
                  {roleLabel(effectiveRole)}
                </span>
                {situacao === "ocioso" && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-base font-medium text-amber-800 ring-1 ring-amber-200/60">
                    <MoonStar size={14} aria-hidden="true" />
                    Ocioso
                  </span>
                )}
                <span
                  className={`w-fit rounded-full px-3 py-1 text-base font-medium ring-1 ${
                    voluntario.ativo
                      ? "bg-green-50 text-green-800 ring-green-200/60"
                      : "bg-red-50 text-red-800 ring-red-200/60"
                  }`}
                >
                  {voluntario.ativo ? "Ativo" : "Desativado"}
                </span>
              </div>
              {linked?.email && (
                <p className="text-base text-zinc-600">{linked.email}</p>
              )}
              {(voluntario.telefone1 || voluntario.telefone2) && (
                <div className="flex flex-col gap-1">
                  {voluntario.telefone1 && (
                    <PhoneLink phone={voluntario.telefone1} label="Tel 1" />
                  )}
                  {voluntario.telefone2 && (
                    <PhoneLink phone={voluntario.telefone2} label="Tel 2" />
                  )}
                </div>
              )}
            </div>
            {canManage && (
              <div className="flex flex-col gap-2">
                <Link
                  href={`/voluntarios/${voluntario.id}/editar`}
                  className="flex min-h-12 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-lg font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
                >
                  <Pencil size={18} aria-hidden="true" />
                  Editar cadastro
                </Link>
                <SituacaoToggle voluntarioId={voluntario.id} situacao={situacao} />
              </div>
            )}
          </div>

          <dl className="grid grid-cols-1 gap-4 border-t border-zinc-100 pt-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[
              ["Código PF", voluntario.codigo_pf],
              ["Unidade", voluntario.unidade],
              ["Org Depto", voluntario.org_depto],
              ["Função", voluntario.funcao],
              ["Área de atuação", voluntario.area_atuacao],
              ["Data de início", formatData(voluntario.data_inicio)],
              ["Data de saída", formatData(voluntario.data_saida)],
            ].map(([label, value]) => (
              <div key={label as string} className="flex flex-col gap-0.5">
                <dt className="text-base text-zinc-500">{label}</dt>
                <dd className="text-xl text-zinc-900">{value ?? "—"}</dd>
              </div>
            ))}
            {areasExtras.length > 0 && (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <dt className="text-base text-zinc-500">Outras áreas</dt>
                <dd className="flex flex-wrap gap-2">
                  {areasExtras.map((area) => (
                    <span
                      key={area}
                      className="rounded-full bg-[#E6E6E6] px-3 py-1 text-base font-medium text-[#28627B] ring-1 ring-[#E6E6E6]/60"
                    >
                      {area}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <dt className="text-base text-zinc-500">Observações</dt>
              <dd className="text-xl text-zinc-900">
                {voluntario.obs || "—"}
              </dd>
            </div>
          </dl>
        </div>

        <AtividadesSection
          voluntarioId={voluntario.id}
          atuais={atividades}
          editavel={canManage || ehProprioCadastro}
        />

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
                <ClipboardList size={24} aria-hidden="true" />
                Demandas atuais ({ativas.length})
              </h2>
              {!linked ? (
                <p className="rounded-2xl bg-white px-5 py-4 text-xl text-zinc-700 ring-1 ring-zinc-200/60">
                  Este voluntário ainda não vinculou a conta de acesso — as
                  demandas aparecem aqui depois do vínculo.
                </p>
              ) : ativas.length === 0 ? (
                <p className="rounded-2xl bg-white px-5 py-4 text-xl text-zinc-700 ring-1 ring-zinc-200/60">
                  Nenhuma demanda ativa no momento.
                </p>
              ) : (
                <div className="flex flex-col rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
                  {ativas.map((demanda) => (
                    <Link
                      key={demanda.id}
                      href={`/demandas/${demanda.id}/editar`}
                      className="flex flex-col gap-1 border-b border-zinc-100 px-5 py-4 last:border-b-0 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="text-xl text-zinc-900">{demanda.titulo}</span>
                      <span className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={demanda.status} />
                        <span
                          className={`text-base ${
                            demanda.atrasada ? "text-red-700" : "text-zinc-700"
                          }`}
                        >
                          {format(
                            new Date(`${demanda.prazo}T00:00:00`),
                            "dd/MM/yyyy",
                            { locale: ptBR }
                          )}
                        </span>
                        {demanda.atrasada && <OverdueBadge prazo={demanda.prazo} />}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {linked && historico.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-2xl font-semibold text-zinc-900">
                  Histórico de concluídas ({historico.length})
                </h2>
                <div className="flex flex-col rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
                  {historico.map((demanda) => (
                    <Link
                      key={demanda.id}
                      href={`/demandas/${demanda.id}/editar`}
                      className="flex flex-col gap-1 border-b border-zinc-100 px-5 py-4 last:border-b-0 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="text-xl text-zinc-900">{demanda.titulo}</span>
                      <span className="text-base text-zinc-700">
                        Concluída — prazo{" "}
                        {format(
                          new Date(`${demanda.prazo}T00:00:00`),
                          "dd/MM/yyyy",
                          { locale: ptBR }
                        )}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
              <NotebookPen size={24} aria-hidden="true" />
              Participação em reuniões gerais ({participacoes.length})
            </h2>
            {participacoes.length === 0 ? (
              <p className="rounded-2xl bg-white px-5 py-4 text-xl text-zinc-700 ring-1 ring-zinc-200/60">
                Este voluntário ainda não foi vinculado como participante de
                nenhuma ata.
              </p>
            ) : (
              <div className="flex flex-col rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
                {participacoes.map((participacao) => (
                  <Link
                    key={participacao.ataId}
                    href={`/reunioes/${participacao.ataId}`}
                    className="flex flex-col gap-1 border-b border-zinc-100 px-5 py-4 last:border-b-0 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-xl text-zinc-900">
                      {participacao.titulo}
                    </span>
                    <span className="text-base text-zinc-700">
                      {formatData(participacao.data_reuniao)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
