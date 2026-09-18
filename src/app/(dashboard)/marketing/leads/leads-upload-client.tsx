"use client";

// Upload de leads: textarea p/ colar + arquivo CSV/TXT. Fatia em lotes
// de 2000 linhas e chama importLeadsChunk em sequência com progresso.
import { useRef, useState } from "react";
import {
  importLeadsChunk,
  type ImportChunkResult,
} from "../actions";
import type { InvalidLead } from "@/lib/marketing/sanitize";

const LINES_PER_CALL = 2000;

interface Aggregate {
  imported: number;
  duplicates: number;
  invalidTotal: number;
  invalidSample: InvalidLead[];
}

export default function LeadsUploadClient() {
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<Aggregate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const content = await file.text();
    setText((prev) => (prev ? `${prev}\n${content}` : content));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleImport() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length === 0) throw new Error("Cole os e-mails ou suba um arquivo primeiro.");
      const agg: Aggregate = { imported: 0, duplicates: 0, invalidTotal: 0, invalidSample: [] };
      const totalCalls = Math.ceil(lines.length / LINES_PER_CALL);
      for (let i = 0; i < lines.length; i += LINES_PER_CALL) {
        const callNo = Math.floor(i / LINES_PER_CALL) + 1;
        setProgress(`Lote ${callNo} de ${totalCalls}…`);
        const chunk = lines.slice(i, i + LINES_PER_CALL).join("\n");
        const r: ImportChunkResult = await importLeadsChunk(chunk, source || undefined);
        if (!r.ok) throw new Error(r.message);
        agg.imported += r.imported;
        agg.duplicates += r.duplicates;
        agg.invalidTotal += r.invalidTotal;
        if (agg.invalidSample.length < 100) {
          agg.invalidSample = [...agg.invalidSample, ...r.invalid].slice(0, 100);
        }
      }
      setProgress("");
      setResult(agg);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na importação.");
      setProgress("");
    } finally {
      setRunning(false);
    }
  }

  const lineCount = text.split(/\r?\n/).filter((l) => l.trim()).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-base font-medium text-zinc-700">
          Origem (opcional, ex.: feira, site)
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="De onde veio essa lista?"
            className="h-11 w-72 rounded-xl border border-slate-200 px-3 text-base"
            disabled={running}
          />
        </label>
        <label className="inline-flex h-11 cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-4 text-base font-medium text-slate-700 hover:bg-slate-50">
          Subir CSV/TXT
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.tsv"
            className="hidden"
            disabled={running}
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-base font-medium text-zinc-700">
        Cole a base (um e-mail por linha — vale <code>email</code>, <code>Nome &lt;email&gt;</code> ou <code>email,nome</code>)
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder={"maria@exemplo.com\nJoão Silva <joao@exemplo.com>\nana@exemplo.com,Ana"}
          className="w-full rounded-xl border border-slate-200 p-3 font-mono text-sm"
          disabled={running}
        />
      </label>
      <p className="text-base text-zinc-500">{lineCount.toLocaleString("pt-BR")} linhas prontas. A sanitização remove duplicados, corrige caixa alta/espaços e separa inválidos com o motivo.</p>

      <div>
        <button
          onClick={() => void handleImport()}
          disabled={running || lineCount === 0}
          className="inline-flex h-12 items-center rounded-xl bg-[#2195B9] px-6 text-lg font-medium text-white disabled:opacity-50 hover:bg-[#1a7a98]"
        >
          {running ? "Importando…" : "Sanitizar e importar"}
        </button>
      </div>

      {progress && <p className="text-lg text-zinc-600" role="status">{progress}</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-lg text-red-700" role="alert">{error}</p>}

      {result && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-xl font-semibold text-zinc-900">Resultado</h3>
          <ul className="mt-2 list-disc pl-6 text-lg text-zinc-700">
            <li><strong>{result.imported.toLocaleString("pt-BR")}</strong> leads novos na base</li>
            <li><strong>{result.duplicates.toLocaleString("pt-BR")}</strong> duplicados ou já cadastrados (ignorados — descadastrado nunca volta)</li>
            <li><strong>{result.invalidTotal.toLocaleString("pt-BR")}</strong> inválidos (quarentena abaixo)</li>
          </ul>
          {result.invalidSample.length > 0 && (
            <div className="mt-4">
              <h4 className="text-lg font-medium text-zinc-900">Quarentena (primeiros {result.invalidSample.length})</h4>
              <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto text-base">
                {result.invalidSample.map((inv, i) => (
                  <li key={i} className="rounded-lg bg-slate-50 px-3 py-1.5 font-mono text-sm text-zinc-700">
                    {inv.raw} <span className="font-sans text-red-600">— {inv.reason}</span>
                    {inv.suggestion && <span className="font-sans text-emerald-700"> Sugestão: {inv.suggestion}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
