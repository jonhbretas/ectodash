// Formulário público do contrato em 3 etapas: preencher → conferir (com
// prévia em PDF e autorização) → resultado em janela de aviso. O botão de
// envio trava enquanto processa; o servidor recusa duplicados de qualquer jeito.
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Eye, Loader2, Mail, AlertTriangle, Users } from "lucide-react";
import {
  ALUNO_VAZIO,
  TIPOS_DOCUMENTO_ESTRANGEIRO,
  comporDocumentoEstrangeiro,
  dataParaIso,
  formatarCpf,
  formatarTelefone,
  isoParaBr,
  validarAluno,
  type AlunoContrato,
} from "@/lib/contratos/aluno";
import type { ResultadoResposta } from "@/lib/contratos/formulario";
import PdfPreviewDialog, {
  type PdfAberto,
} from "@/app/(dashboard)/utilidades/contratos/pdf-preview-dialog";
import {
  enviarFormularioContrato,
  previaContratoPublico,
  reenviarEmailContrato,
} from "./actions";

type Campo = { campo: keyof AlunoContrato; label: string };

const DICAS: Partial<Record<keyof AlunoContrato, { placeholder: string; ajuda?: string; tipo?: string; modo?: "numeric" | "tel" | "email"; auto?: string }>> = {
  nome: { placeholder: "Seu nome completo, sem abreviar", auto: "name" },
  documento: { placeholder: "000.000.000-00", modo: "numeric", ajuda: "Somente o CPF (11 números)." },
  email: { placeholder: "seu@email.com", tipo: "email", modo: "email", auto: "email", ajuda: "O contrato para assinar chega neste e-mail." },
  telefone: { placeholder: "(00) 00000-0000", tipo: "tel", modo: "tel", auto: "tel" },
  rg: { placeholder: "Número e órgão emissor (ex.: 12.345.678-9 SSP/PR)" },
  nascimento: { placeholder: "dd/mm/aaaa", modo: "numeric", auto: "bday" },
  endereco: { placeholder: "Rua, número, complemento, bairro, cidade/UF, CEP", auto: "street-address" },
  nacionalidade: { placeholder: "ex.: brasileira" },
  estadoCivil: { placeholder: "ex.: solteira, casado, divorciada" },
  profissao: { placeholder: "ex.: professora, aposentado" },
};

const INPUT =
  "w-full min-h-14 rounded-xl border border-zinc-300 bg-white px-4 text-lg text-zinc-900 placeholder:text-zinc-400 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30";
const BTN_PRIMARY =
  "flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-6 text-xl font-semibold text-white transition-colors hover:bg-[#28627B] disabled:cursor-not-allowed disabled:opacity-60";
const BTN_SECONDARY =
  "flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-6 text-lg font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-60";

/** Data digitada só com números vira dd/mm/aaaa enquanto a pessoa digita. */
function mascaraData(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export default function FormularioContratoClient({
  token,
  instrucoes,
  envioAutomatico,
  campos,
}: {
  token: string;
  instrucoes: string | null;
  envioAutomatico: boolean;
  campos: Campo[];
}) {
  const [aluno, setAluno] = useState<AlunoContrato>({ ...ALUNO_VAZIO });
  const [emailConfirmacao, setEmailConfirmacao] = useState("");
  // Estrangeiro sem CPF: documento composto em aluno.documento
  // ("Passaporte nº AB123 (Itália)") a partir destes três campos.
  const [estrangeiro, setEstrangeiro] = useState(false);
  const [docEstrangeiro, setDocEstrangeiro] = useState({
    tipo: TIPOS_DOCUMENTO_ESTRANGEIRO[0] as string,
    numero: "",
    pais: "",
  });
  const [site, setSite] = useState("");
  const [etapa, setEtapa] = useState<"preencher" | "conferir" | "concluido">("preencher");
  const [erros, setErros] = useState<string[]>([]);
  const [dadosOk, setDadosOk] = useState(false);
  const [consentimento, setConsentimento] = useState(false);
  const [resultado, setResultado] = useState<ResultadoResposta | null>(null);
  const [reenvio, setReenvio] = useState<{ ok: boolean; message: string } | null>(null);
  const [pdf, setPdf] = useState<PdfAberto | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [previewPending, startPreview] = useTransition();
  const [reenvioPending, startReenvio] = useTransition();
  const avisoRef = useRef<HTMLDialogElement>(null);
  const topoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = avisoRef.current;
    if (resultado && resultado.tipo !== "erro" && dialog && !dialog.open) dialog.showModal();
  }, [resultado]);

  // Enquanto envia, avisa antes de sair da página.
  useEffect(() => {
    if (!enviando) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enviando]);

  function set(campo: keyof AlunoContrato, valor: string) {
    setAluno((a) => ({ ...a, [campo]: valor }));
  }

  function setDoc(parcial: Partial<typeof docEstrangeiro>) {
    const novo = { ...docEstrangeiro, ...parcial };
    setDocEstrangeiro(novo);
    set("documento", novo.numero.trim() ? comporDocumentoEstrangeiro(novo.tipo, novo.numero, novo.pais) : "");
  }

  function trocarEstrangeiro(valor: boolean) {
    setEstrangeiro(valor);
    set(
      "documento",
      valor && docEstrangeiro.numero.trim()
        ? comporDocumentoEstrangeiro(docEstrangeiro.tipo, docEstrangeiro.numero, docEstrangeiro.pais)
        : ""
    );
  }

  function validarLocal(): string[] {
    const lista = [...validarAluno(aluno).erros];
    for (const { campo, label } of campos) {
      if (!aluno[campo].trim() && !lista.some((e) => e.toLowerCase().startsWith(label.toLowerCase().split(" ")[0]))) {
        lista.push(`Preencha: ${label}`);
      }
    }
    if (!aluno.documento.trim()) lista.push(estrangeiro ? "Informe o número do seu documento" : "Informe seu CPF");
    if (estrangeiro && !docEstrangeiro.pais.trim()) lista.push("Informe o país que emitiu o documento");
    if (emailConfirmacao.trim().toLowerCase() !== aluno.email.trim().toLowerCase()) {
      lista.push("Os dois e-mails não são iguais");
    }
    return Array.from(new Set(lista));
  }

  function continuar() {
    const lista = validarLocal();
    setErros(lista);
    if (lista.length === 0) {
      setEtapa("conferir");
      setDadosOk(false);
    }
    topoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function verPrevia() {
    startPreview(async () => {
      const r = await previaContratoPublico(token, aluno);
      if (!r.ok) {
        setErros([r.message]);
        return;
      }
      const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      if (pdf) URL.revokeObjectURL(pdf.url);
      setPdf({ url: URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })), filename: r.filename });
    });
  }

  async function confirmar() {
    if (enviando) return;
    setEnviando(true);
    setErros([]);
    try {
      const r = await enviarFormularioContrato(token, aluno, {
        emailConfirmacao,
        consentimento,
        site,
      });
      if (r.tipo === "erro") {
        setErros([r.message]);
      } else {
        setResultado(r);
        setEtapa("concluido");
      }
    } catch {
      setErros(["Falha de conexão. Confira sua internet e tente de novo — seus dados não foram perdidos."]);
    } finally {
      setEnviando(false);
    }
  }

  function reenviar() {
    startReenvio(async () => {
      setReenvio(await reenviarEmailContrato(token, { cpf: aluno.documento, email: aluno.email }));
    });
  }

  const valorExibido = (campo: keyof AlunoContrato): string => {
    const v = aluno[campo].trim();
    if (campo === "documento") return formatarCpf(v);
    if (campo === "telefone") return formatarTelefone(v);
    if (campo === "nascimento") {
      const iso = dataParaIso(v);
      return iso ? isoParaBr(iso) : v;
    }
    return v;
  };

  return (
    <div ref={topoRef} className="flex flex-col gap-6 scroll-mt-6">
      {erros.length > 0 && (
        <div className="rounded-2xl bg-red-50 p-5 ring-1 ring-red-200" role="alert">
          <p className="flex items-center gap-2 text-lg font-semibold text-red-800">
            <AlertTriangle size={22} aria-hidden="true" /> Confira antes de continuar:
          </p>
          <ul className="mt-2 list-disc pl-6 text-lg text-red-800">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {etapa === "preencher" && (
        <form
          className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          onSubmit={(e) => {
            e.preventDefault();
            continuar();
          }}
          noValidate
        >
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold uppercase tracking-wide text-[#2195B9]">Etapa 1 de 2</p>
            <h2 className="text-2xl font-semibold text-zinc-900">Seus dados para o contrato</h2>
            <p className="text-lg text-zinc-600">
              {instrucoes?.trim() ||
                "Preencha exatamente como está nos seus documentos. Esses dados vão aparecer no contrato."}
            </p>
          </div>

          <div className="flex gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200" role="note">
            <Users size={26} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
            <p className="text-lg text-amber-900">
              <strong>Cada pessoa preenche o seu.</strong> O contrato é individual: use os seus dados e o seu
              próprio e-mail. Casais e familiares: cada um preenche o próprio formulário — não preencha pelo outro.
            </p>
          </div>

          {campos.map(({ campo, label }) => {
            const dica = DICAS[campo] ?? { placeholder: "" };
            if (campo === "documento") {
              return (
                <fieldset key={campo} className="flex flex-col gap-3">
                  <legend className="mb-1.5 text-lg font-medium text-zinc-800">Documento</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { valor: false, texto: "Tenho CPF" },
                      { valor: true, texto: "Sou estrangeiro(a), não tenho CPF" },
                    ].map((op) => (
                      <label
                        key={op.texto}
                        className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 text-lg ${
                          estrangeiro === op.valor
                            ? "border-[#2195B9] bg-[#e8f4f8] text-zinc-900"
                            : "border-zinc-300 bg-white text-zinc-700"
                        }`}
                      >
                        <input
                          type="radio"
                          name="tipo-documento"
                          checked={estrangeiro === op.valor}
                          onChange={() => trocarEstrangeiro(op.valor)}
                          className="h-5 w-5 accent-[#2195B9]"
                        />
                        {op.texto}
                      </label>
                    ))}
                  </div>
                  {!estrangeiro ? (
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="f-documento" className="text-base font-medium text-zinc-700">
                        CPF
                      </label>
                      <input
                        id="f-documento"
                        inputMode="numeric"
                        autoComplete="off"
                        value={aluno.documento}
                        onChange={(e) => set("documento", e.target.value)}
                        onBlur={() => {
                          if (aluno.documento.replace(/\D/g, "").length === 11) {
                            set("documento", formatarCpf(aluno.documento));
                          }
                        }}
                        placeholder="000.000.000-00"
                        className={INPUT}
                        maxLength={20}
                      />
                      <p className="text-base text-zinc-500">Somente o CPF (11 números).</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="f-doc-tipo" className="text-base font-medium text-zinc-700">
                          Tipo de documento
                        </label>
                        <select
                          id="f-doc-tipo"
                          value={docEstrangeiro.tipo}
                          onChange={(e) => setDoc({ tipo: e.target.value })}
                          className={INPUT}
                        >
                          {TIPOS_DOCUMENTO_ESTRANGEIRO.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="f-doc-numero" className="text-base font-medium text-zinc-700">
                          Número do documento
                        </label>
                        <input
                          id="f-doc-numero"
                          autoComplete="off"
                          value={docEstrangeiro.numero}
                          onChange={(e) => setDoc({ numero: e.target.value })}
                          placeholder="exatamente como está no documento"
                          className={INPUT}
                          maxLength={40}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="f-doc-pais" className="text-base font-medium text-zinc-700">
                          País que emitiu
                        </label>
                        <input
                          id="f-doc-pais"
                          autoComplete="country-name"
                          value={docEstrangeiro.pais}
                          onChange={(e) => setDoc({ pais: e.target.value })}
                          placeholder="ex.: Portugal, Argentina, Itália"
                          className={INPUT}
                          maxLength={60}
                        />
                      </div>
                    </div>
                  )}
                </fieldset>
              );
            }
            return (
              <div key={campo} className="flex flex-col gap-1.5">
                <label htmlFor={`f-${campo}`} className="text-lg font-medium text-zinc-800">
                  {label}
                </label>
                <input
                  id={`f-${campo}`}
                  type={dica.tipo ?? "text"}
                  inputMode={dica.modo}
                  autoComplete={dica.auto ?? "off"}
                  value={aluno[campo]}
                  onChange={(e) => set(campo, campo === "nascimento" ? mascaraData(e.target.value) : e.target.value)}
                  onBlur={() => {
                    if (campo === "telefone") set("telefone", formatarTelefone(aluno.telefone));
                  }}
                  placeholder={dica.placeholder}
                  className={INPUT}
                  maxLength={campo === "endereco" ? 300 : 150}
                  required
                />
                {campo === "telefone" && estrangeiro ? (
                  <p className="text-base text-zinc-500">Telefone fora do Brasil: inclua o código do país (ex.: +351 …).</p>
                ) : (
                  dica.ajuda && <p className="text-base text-zinc-500">{dica.ajuda}</p>
                )}
                {campo === "email" && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    <label htmlFor="f-email2" className="text-lg font-medium text-zinc-800">
                      Repita o e-mail
                    </label>
                    <input
                      id="f-email2"
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      value={emailConfirmacao}
                      onChange={(e) => setEmailConfirmacao(e.target.value)}
                      onPaste={(e) => e.preventDefault()}
                      placeholder="digite de novo, sem copiar e colar"
                      className={INPUT}
                      required
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Honeypot: invisível para pessoas; robôs preenchem. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Site
              <input tabIndex={-1} autoComplete="off" value={site} onChange={(e) => setSite(e.target.value)} />
            </label>
          </div>

          <button type="submit" className={BTN_PRIMARY}>
            Continuar
          </button>
        </form>
      )}

      {etapa === "conferir" && (
        <div className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold uppercase tracking-wide text-[#2195B9]">Etapa 2 de 2</p>
            <h2 className="text-2xl font-semibold text-zinc-900">Confira seus dados</h2>
            <p className="text-lg text-zinc-600">
              Depois de confirmar não é possível corrigir por aqui. Se algo estiver errado, toque em
              &quot;Corrigir dados&quot;.
            </p>
          </div>

          <dl className="flex flex-col divide-y divide-zinc-100 rounded-2xl bg-zinc-50 px-5 ring-1 ring-zinc-200">
            {campos.map(({ campo, label }) => (
              <div key={campo} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-4">
                <dt className="text-base font-semibold text-zinc-600 sm:w-40 sm:shrink-0">
                  {campo === "documento" ? (estrangeiro ? "Documento" : "CPF") : label}
                </dt>
                <dd className="break-words text-lg text-zinc-900">{valorExibido(campo)}</dd>
              </div>
            ))}
          </dl>

          <button type="button" onClick={verPrevia} disabled={previewPending} className={BTN_SECONDARY}>
            {previewPending ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
            Ver como fica o contrato
          </button>

          <label className="flex items-start gap-3 text-lg text-zinc-800">
            <input
              type="checkbox"
              checked={dadosOk}
              onChange={(e) => setDadosOk(e.target.checked)}
              className="mt-1 h-6 w-6 shrink-0 accent-[#2195B9]"
            />
            Conferi: meus dados estão corretos e o e-mail <strong className="break-all">{aluno.email}</strong> é meu.
          </label>
          <label className="flex items-start gap-3 text-lg text-zinc-800">
            <input
              type="checkbox"
              checked={consentimento}
              onChange={(e) => setConsentimento(e.target.checked)}
              className="mt-1 h-6 w-6 shrink-0 accent-[#2195B9]"
            />
            Autorizo a Ectolab a usar estes dados para emitir e guardar este contrato (LGPD).
          </label>

          <button
            type="button"
            onClick={confirmar}
            disabled={!dadosOk || !consentimento || enviando}
            className={BTN_PRIMARY}
          >
            {enviando ? (
              <>
                <Loader2 size={22} className="animate-spin" aria-hidden="true" />
                Enviando… não feche esta página
              </>
            ) : envioAutomatico ? (
              "Confirmar e receber o contrato por e-mail"
            ) : (
              "Confirmar e enviar meus dados"
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setEtapa("preencher");
              setErros([]);
            }}
            disabled={enviando}
            className={BTN_SECONDARY}
          >
            Corrigir dados
          </button>
        </div>
      )}

      {etapa === "concluido" && resultado && resultado.tipo !== "erro" && (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ResultadoConteudo
            resultado={resultado}
            reenvio={reenvio}
            reenvioPending={reenvioPending}
            onReenviar={reenviar}
          />
        </div>
      )}

      <dialog
        ref={avisoRef}
        className="m-auto w-[min(520px,92vw)] rounded-3xl bg-white p-0 shadow-2xl backdrop:bg-black/50"
        aria-label="Resultado do envio"
      >
        {resultado && resultado.tipo !== "erro" && (
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <ResultadoConteudo
              resultado={resultado}
              reenvio={reenvio}
              reenvioPending={reenvioPending}
              onReenviar={reenviar}
            />
            <button type="button" onClick={() => avisoRef.current?.close()} className={BTN_PRIMARY}>
              Entendi
            </button>
          </div>
        )}
      </dialog>

      <PdfPreviewDialog pdf={pdf} onClose={() => setPdf(null)} />
    </div>
  );
}

function ResultadoConteudo({
  resultado,
  reenvio,
  reenvioPending,
  onReenviar,
}: {
  resultado: Exclude<ResultadoResposta, { tipo: "erro" }>;
  reenvio: { ok: boolean; message: string } | null;
  reenvioPending: boolean;
  onReenviar: () => void;
}) {
  if (resultado.tipo === "enviado") {
    return (
      <>
        <Mail size={56} className="text-[#2195B9]" aria-hidden="true" />
        <h2 className="text-2xl font-semibold text-zinc-900">Contrato enviado para o seu e-mail!</h2>
        <p className="text-lg text-zinc-700">
          Enviamos o contrato para <strong>{resultado.emailMascarado}</strong>. Abra seu e-mail, procure a
          mensagem da <strong>Assinafy</strong> e toque em <strong>Assinar</strong>.
        </p>
        <p className="text-base text-zinc-500">Não chegou em alguns minutos? Veja a caixa de spam ou promoções.</p>
        {resultado.signingUrl && (
          <a
            href={resultado.signingUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#2195B9] px-6 text-xl font-semibold text-[#2195B9] hover:bg-[#e8f4f8]"
          >
            Assinar agora
          </a>
        )}
      </>
    );
  }
  if (resultado.tipo === "aguardando") {
    return (
      <>
        <CheckCircle2 size={56} className="text-emerald-600" aria-hidden="true" />
        <h2 className="text-2xl font-semibold text-zinc-900">Recebemos seus dados!</h2>
        <p className="text-lg text-zinc-700">
          A organização vai conferir e o contrato para assinar chegará no seu e-mail
          {resultado.emailMascarado ? (
            <>
              {" "}
              <strong>{resultado.emailMascarado}</strong>
            </>
          ) : null}
          . Não precisa preencher de novo.
        </p>
      </>
    );
  }
  // duplicado
  return (
    <>
      <CheckCircle2 size={56} className="text-emerald-600" aria-hidden="true" />
      <h2 className="text-2xl font-semibold text-zinc-900">
        {resultado.status === "assinado" ? "Seu contrato já está assinado" : "Você já preencheu este formulário"}
      </h2>
      <p className="text-lg text-zinc-700">
        {resultado.status === "assinado"
          ? "Não é preciso fazer mais nada. Obrigado!"
          : resultado.podeReenviar
            ? `O contrato já foi enviado para ${resultado.emailMascarado}. Procure o e-mail da Assinafy (veja também o spam).`
            : "Seus dados já foram recebidos. A organização vai entrar em contato se precisar de algo."}
      </p>
      {resultado.podeReenviar && (
        <button type="button" onClick={onReenviar} disabled={reenvioPending || reenvio?.ok} className={BTN_SECONDARY}>
          {reenvioPending ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <Mail size={20} aria-hidden="true" />}
          Reenviar e-mail de assinatura
        </button>
      )}
      {reenvio && (
        <p className={`text-base ${reenvio.ok ? "text-emerald-700" : "text-red-700"}`} role="status">
          {reenvio.message}
        </p>
      )}
      <p className="text-base text-zinc-500">E-mail errado? Fale com a organização para corrigir.</p>
    </>
  );
}
