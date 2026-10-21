// Campos de configuração compartilhados entre criar e editar um formulário.
export type FormularioConfig = {
  titulo: string;
  instrucoes: string | null;
  expira_em: string | null;
  limite_respostas: number;
  prazo_assinatura_dias: number;
  envio_automatico: boolean;
};

const INPUT =
  "w-full min-h-14 rounded-xl border border-zinc-200 bg-white px-4 text-lg text-zinc-900 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30";

export default function CamposConfig({ valores }: { valores?: FormularioConfig }) {
  return (
    <>
      <label className="flex flex-col gap-2">
        <span className="text-lg font-medium text-zinc-800">Título que o aluno vê *</span>
        <input
          name="titulo"
          required
          minLength={3}
          defaultValue={valores?.titulo ?? ""}
          placeholder="ex.: Termo de cessão de imagem — PROEP 2026"
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-lg font-medium text-zinc-800">Instruções para o aluno</span>
        <textarea
          name="instrucoes"
          rows={2}
          defaultValue={valores?.instrucoes ?? ""}
          placeholder="Preencha exatamente como está nos seus documentos."
          className="w-full rounded-xl border border-zinc-200 bg-white p-4 text-lg text-zinc-900 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-2">
          <span className="text-lg font-medium text-zinc-800">Aceita respostas até</span>
          <input type="date" name="expiraEm" defaultValue={valores?.expira_em ?? ""} className={INPUT} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-lg font-medium text-zinc-800">Máximo de respostas</span>
          <input
            type="number"
            name="limite"
            min={1}
            max={1000}
            defaultValue={valores?.limite_respostas ?? 50}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-lg font-medium text-zinc-800">Prazo para assinar (dias)</span>
          <input
            type="number"
            name="prazo"
            min={1}
            max={90}
            defaultValue={valores?.prazo_assinatura_dias ?? 15}
            className={INPUT}
          />
        </label>
      </div>
      <label className="flex items-start gap-3 rounded-xl bg-zinc-50 p-4 text-lg text-zinc-800 ring-1 ring-zinc-200">
        <input
          type="checkbox"
          name="envioAutomatico"
          defaultChecked={valores?.envio_automatico ?? true}
          className="mt-1 h-6 w-6 shrink-0 accent-[#2195B9]"
        />
        <span>
          <strong>Enviar para assinatura automaticamente</strong> assim que o aluno confirmar.
          <span className="block text-base text-zinc-500">
            Desmarcado: as respostas ficam aguardando você conferir e aprovar (gasta cota só ao aprovar).
          </span>
        </span>
      </label>
    </>
  );
}
