"use client";

// Editor da campanha: cola o HTML, vê o resultado final ao lado e
// salva como rascunho (createCampaign). Preview em iframe isolado.
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createCampaign, type ActionState } from "../../actions";

const initial: ActionState & { id?: number } = { ok: false, message: "" };

export default function CampaignEditorClient() {
  const [state, formAction, pending] = useActionState(createCampaign, initial);
  const [html, setHtml] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (state.ok && state.id) router.push(`/marketing/campanhas/${state.id}`);
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-base font-medium text-zinc-700">
          Título interno (só você vê)
          <input name="titulo" required maxLength={200} placeholder="Ex.: Divulgação curso de outubro" className="h-11 rounded-xl border border-slate-200 px-3 text-base font-normal" />
        </label>
        <div className="rounded-xl bg-sky-50 p-3 text-base text-sky-900">
          <strong>Teste A/B automático:</strong> escreva até 10 assuntos (1 por linha).
          Com 2+, o sistema envia 100 e-mails por assunto, mede a abertura e
          dispara o restante com o vencedor.
        </div>
      </div>

      <label className="flex flex-col gap-1 text-base font-medium text-zinc-700">
        Assuntos do e-mail (1 por linha, até 10)
        <textarea
          name="assuntos"
          required
          rows={5}
          placeholder={"Vagas abertas: novo curso!\nÚltimas vagas com desconto\nVocê foi convidado(a)…"}
          className="w-full rounded-xl border border-slate-200 p-3 text-base font-normal"
        />
      </label>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="flex flex-col gap-1 text-base font-medium text-zinc-700">
          Código HTML
          <textarea
            name="html"
            required
            rows={20}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder="<h1>Olá!</h1><p>Confira as novidades…</p>"
            className="w-full rounded-xl border border-slate-200 p-3 font-mono text-sm font-normal"
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-base font-medium text-zinc-700">Resultado final (como o lead vai ver)</span>
          <iframe
            title="Pré-visualização do e-mail"
            sandbox=""
            srcDoc={html || "<p style='font-family:sans-serif;color:#888'>Cole o HTML ao lado para ver aqui.</p>"}
            className="min-h-[480px] w-full rounded-xl border border-slate-200 bg-white"
          />
        </div>
      </div>

      {!state.ok && state.message && (
        <p className="rounded-xl bg-red-50 p-3 text-lg text-red-700" role="alert">{state.message}</p>
      )}

      <div>
        <button type="submit" disabled={pending} className="inline-flex h-12 items-center rounded-xl bg-[#2195B9] px-6 text-lg font-medium text-white disabled:opacity-50 hover:bg-[#1a7a98]">
          {pending ? "Salvando…" : "Salvar rascunho"}
        </button>
      </div>
    </form>
  );
}
