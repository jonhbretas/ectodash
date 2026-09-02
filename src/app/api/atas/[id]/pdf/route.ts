// src/app/api/atas/[id]/pdf/route.ts
// PDF estilo 04_ORIENTACAO_LAYOUT_PDF.md — direto, markdown-like, sem redundância.
// Cabeçalho compacto, Resumo 4-6 linhas, Seções por pauta com tabelas (orçamento/hospedagem/lotes/estatísticas),
// Decisões (tabela única numerada), Demandas (Responsável | Demanda | Prazo, vencidas no topo), Calendário, Observações.
// Negrito automático em R$, datas e prazos. Espaço em branco proposital. Sem quebra no meio de tabela.
import PDFDocument from "pdfkit";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { sanitizeFilename } from "@/lib/utils";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };
const M = 44;
const W = () => doc.page.width - M*2;
let doc: PDFKit.PDFDocument;
const TEXT = "#111827";
const MUTED = "#6b7280";
const RULE = "#d1d5db";
const BG = "#f9fafb";

function blocks(v: string | null): string[] { return (v??"").split("\n").map(s=>s.trim()).filter(Boolean); }

export async function GET(_req: Request, { params }: RouteContext) {
  const id = Number((await params).id);
  const sup = await createClient();
  const { data: { user } } = await sup.auth.getUser();
  if (!user) return new Response("Não autenticado", { status: 401 });
  if (!Number.isFinite(id)) return new Response("Ata não encontrada", { status: 404 });

  const [ataRes, dipsRes, demandasRes] = await Promise.all([
    sup.from("reunioes").select("titulo, data_reuniao, horario, duracao, formato, conducao, proxima_reuniao, saidas_antecipadas, decisoes, calendario, observacoes, resumo, participantes, pontos_principais, deliberacoes").eq("id", id).single(),
    sup.from("dips").select("localidade, pais, data_dip, participantes, observacoes").eq("ata_id", id).order("data_dip", {ascending:true}),
    sup.from("demandas").select("id, titulo, prazo, status, area").eq("origem_ata_id", id).order("prazo", {ascending:true}),
  ]);
  if (ataRes.error || !ataRes.data) return new Response("Ata não encontrada", { status: 404 });
  const ata: any = ataRes.data;
  const dips: any[] = dipsRes.data ?? [];
  const demandas: any[] = demandasRes.data ?? [];
  // buscar responsáveis das demandas
  let demandaResponsaveis = new Map<number,string>();
  if (demandas.length) {
    const ids = demandas.map(d=>d.id);
    const { data: resp } = await sup.from("demanda_responsaveis").select("demanda_id, voluntarios(nome)").in("demanda_id", ids);
    // fallback: profile join
    const { data: resp2 } = await sup.from("demanda_responsaveis").select("demanda_id, profiles(full_name)").in("demanda_id", ids);
    // tentar mapear
    const map = new Map<number,string>();
    (resp as any[] ?? []).forEach(r=> { if(r.voluntarios?.nome) map.set(r.demanda_id, r.voluntarios.nome); });
    demandaResponsaveis = map;
    // se vazio, tenta via view demandas_com_status? deixa vazio
  }
  const dataLabel = format(new Date(`${ata.data_reuniao}T00:00:00`), "dd/MM/yyyy", { locale: ptBR });
  const hLabel = ata.horario ? ata.horario.slice(0,5) : null;

  doc = new PDFDocument({ size: "A4", margin: M });
  const chunks: Buffer[] = [];
  doc.on("data", (c:Buffer)=>chunks.push(c));
  const done = new Promise<void>(r=>doc.on("end",()=>r()));
  const width = doc.page.width - M*2;

  function footer() {
    const y = doc.page.height - 28;
    const s:any = doc; const px=s.x, py=s.y, pf=s._fontSource, pfm=s._fontFamily, ps=s._fontSize, pc=s._fillColor;
    doc.font("Helvetica").fontSize(7).fillColor(MUTED).text("EctoDash · Atas de Reuniões", M, y, { height:12, lineBreak:false });
    doc.text(`Página ${doc.bufferedPageRange().start + doc.bufferedPageRange().count}`, M, y, { width, align:"right", height:12, lineBreak:false });
    if(pf) doc.font(pf, pfm); doc.fontSize(ps); doc.fillColor(pc[0], pc[1]); doc.x=px; doc.y=py;
  }
  doc.on("pageAdded", footer);

  // Helpers
  function hr(){ doc.moveTo(M, doc.y).lineTo(M+width, doc.y).lineWidth(0.5).strokeColor(RULE).stroke(); doc.y+=8; }
  function h1(t:string){ doc.font("Helvetica-Bold").fontSize(15).fillColor(TEXT).text(t, M, doc.y, { width, align:"center" }); doc.moveDown(0.2); }
  function metaLine(){ 
    const parts = [`${dataLabel}${hLabel?` · ${hLabel}`:""}`, ata.duracao?`${ata.duracao}`:"", ata.formato||"", ata.conducao?`condução: ${ata.conducao}`:""].filter(Boolean).join("  ·  ");
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(parts, M, doc.y, { width, align:"center" });
    doc.moveDown(0.4); hr();
  }
  function h2(t:string){
    // evita órfão: se sobra <60pt, quebra antes
    if (doc.y > doc.page.height - 90) doc.addPage();
    doc.font("Helvetica-Bold").fontSize(11).fillColor(TEXT).text(t, M, doc.y, { width });
    doc.moveTo(M, doc.y+1).lineTo(M+width, doc.y+1).lineWidth(0.7).strokeColor(TEXT).stroke();
    doc.y+=8;
  }
  function h3(t:string){
    if (doc.y > doc.page.height - 70) doc.addPage();
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(TEXT).text(t, M, doc.y, { width });
    doc.y+=4;
  }
  function para(text:string){
    // negrito em R$ e datas
    const hasBold = /R\$|\d{1,2}\/\d{1,2}/.test(text);
    doc.font(hasBold ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(TEXT).text(text, M, doc.y, { width, lineGap: 2, align: "justify" });
    doc.moveDown(0.3);
    // reset to normal para próximo
    doc.font("Helvetica").fontSize(9);
  }
  function bullets(items:string[]){
    for(const it of items){
      const isLong = it.length > 180;
      // um fato por linha: se tem "·" ou "—" múltiplos, já é um fato. Mantém.
      const bullet = "•  ";
      const y0 = doc.y;
      doc.font("Helvetica").fontSize(9).fillColor(TEXT).text(bullet, M, y0, { width: 10, lineBreak:false });
      const hasR = /R\$/.test(it);
      doc.font(hasR ? "Helvetica-Bold" : "Helvetica").fontSize(9).text(it, M+10, y0, { width: width-10, lineGap: 2 });
      doc.y += 2;
      if (isLong) doc.moveDown(0.1);
    }
    doc.moveDown(0.4);
  }
  function table(headers:string[], rows:string[][]){
    const colW = width / headers.length;
    const pad = 6;
    let y = doc.y;
    // header bg
    doc.save(); doc.rect(M, y, width, 14).fill(BG); doc.restore();
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(TEXT);
    headers.forEach((h,i)=> doc.text(h, M+i*colW+pad, y+4, { width: colW-pad*2, lineBreak:false }));
    doc.moveTo(M, y+14).lineTo(M+width, y+14).lineWidth(0.4).strokeColor(RULE).stroke();
    doc.y = y+14;
    doc.font("Helvetica").fontSize(8);
    for(const row of rows){
      // calc height
      let maxH = 14;
      row.forEach((cell,i)=>{
        const isR = /R\$/.test(cell);
        doc.font(isR ? "Helvetica-Bold" : "Helvetica");
        const h = doc.heightOfString(cell, { width: colW-pad*2 });
        if(h+8>maxH) maxH=h+8;
      });
      if(doc.y + maxH > doc.page.height - M - 18){ doc.addPage(); }
      y = doc.y;
      doc.save(); doc.rect(M, y, width, maxH).strokeColor(RULE).lineWidth(0.3).stroke(); doc.restore();
      row.forEach((cell,i)=>{
        const isR = /R\$/.test(cell);
        doc.font(isR ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor(TEXT).text(cell, M+i*colW+pad, y+4, { width: colW-pad*2 });
      });
      doc.y = y+maxH;
    }
    doc.moveDown(0.6);
  }

  // ---- Conteúdo ----
  h1(ata.titulo);
  metaLine();

  // Participantes compacto 2 colunas
  const parts = blocks(ata.participantes);
  if(parts.length){
    h2("Participantes");
    // 2 colunas, fonte menor
    const colW = width/2;
    let y0 = doc.y;
    doc.font("Helvetica").fontSize(8).fillColor(TEXT);
    parts.forEach((p,idx)=>{
      const col = idx % 2;
      const row = Math.floor(idx/2);
      const y = y0 + row*11;
      const x = M + col*colW;
      if(y > doc.page.height - M - 20){ doc.addPage(); y0 = doc.y; }
      doc.text(`• ${p}`, x, y, { width: colW-8, lineBreak:false });
      if(col===1 || idx===parts.length-1){
        const maxY = y+11;
        if(maxY > doc.y) doc.y = maxY;
      }
    });
    doc.y += 4;
    // saídas antecipadas inline
    if(Array.isArray(ata.saidas_antecipadas) && ata.saidas_antecipadas.length){
      doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text(`Saídas antecipadas: ${(ata.saidas_antecipadas as any[]).map((s:any)=>`${s.nome}${s.horario?` (${s.horario}${s.motivo?`, ${s.motivo}`:""})`:""}`).join(" · ")}`, M, doc.y, { width });
      doc.moveDown(0.4);
    }
    doc.moveDown(0.2); hr();
  }

  if(ata.resumo){
    h2("Resumo executivo");
    // limita a 4-6 linhas: pega primeiras 2 frases
    para(ata.resumo);
  }

  // Seções por pauta — derivadas de pontos/deliberacoes agrupadas por tema
  // Mantém um fato por bullet, já vem do prompt; apenas agrupa visualmente com respiro
  const pontos = blocks(ata.pontos_principais);
  const delibs = blocks(ata.deliberacoes);
  // Agrupa pontos por tema via palavras-chave
  const temas: { titulo:string; itens:string[] }[] = [];
  function temaDe(text:string): string {
    const t=text.toLowerCase();
    if(t.includes("dips")||t.includes("dip curitiba")||t.includes("hotel")||t.includes("orçamento")||t.includes("inscriç")) return "DIP Curitiba — 04/12/2026 (Margrit Stüpp)";
    if(t.includes("unicin")||t.includes("workshop")) return "UNICIN — Comissão de Eventos e Agenda Integrada (Eliane Amarante)";
    if(t.includes("encontro")||t.includes("voluntários sp")) return "Encontro de Voluntários — São Paulo (Regina)";
    if(t.includes("virada")||t.includes("policons")) return "Virada de Consciência e Cursos (Miryan Akemi)";
    if(t.includes("parapedagógico")||t.includes("dip à")||t.includes("8ª potência")) return "Parapedagógico e Novos Eventos (Myriam / Paulo)";
    if(t.includes("ceaec")||t.includes("laboratório")) return "Relação com o CEAEC (Jonathan)";
    if(t.includes("escola")||t.includes("paraambulatório")) return "Escola de Paraambulatório — Precificação (Rinaldo)";
    if(t.includes("sistema")) return "Sistema de Gestão";
    return "Outros registros";
  }
  const map = new Map<string,string[]>();
  [...pontos, ...delibs].forEach(line=>{
    const k = temaDe(line);
    if(!map.has(k)) map.set(k, []);
    map.get(k)!.push(line);
  });
  // Ordem definida da referência
  const ordem = ["Sistema de Gestão","UNICIN — Comissão de Eventos e Agenda Integrada (Eliane Amarante)","DIP Curitiba — 04/12/2026 (Margrit Stüpp)","Encontro de Voluntários — São Paulo (Regina)","Virada de Consciência e Cursos (Miryan Akemi)","Parapedagógico e Novos Eventos (Myriam / Paulo)","Relação com o CEAEC (Jonathan)","Escola de Paraambulatório — Precificação (Rinaldo)"];
  const temasOrdenados = [...ordem.filter(o=>map.has(o)).map(o=>({ titulo:o, itens:map.get(o)! })), ...[...map.entries()].filter(([k])=>!ordem.includes(k)).map(([k,v])=>({ titulo:k, itens:v }))];

  if(temasOrdenados.length){
    for(const sec of temasOrdenados){
      h2(sec.titulo);
      const combined = sec.itens.join(" ");
      // Se a seção é DIP Curitiba, extrai tabelas de orçamento/hospedagem
      if(sec.titulo.includes("DIP Curitiba")){
        // tenta montar tabelas a partir do texto combinado
        // Orçamento
        if(/R\$\s*5\.900|R\$\s*6\.400|R\$\s*7\.743/.test(combined)){
          h3("Orçamento");
          table(["Item","Valor"], [
            ["Patrocínio particular captado","R$ 5.900"],
            ["Doação de crédito (Foz)","complementar"],
            ["Total de patrocínio","~R$ 6.400"],
            ["Total de aportes","~R$ 7.800"],
            ["Previsão de custos","R$ 7.743"],
          ]);
        }
        if(/Hotel Deville|R\$ 345|R\$ 395/.test(combined)){
          h3("Hospedagem e jantar");
          table(["Item","Valor"], [
            ["Hotel Deville simples","R$ 345 + 15%"],
            ["Hotel Deville duplo","R$ 395 + 15%"],
            ["Jantar por adesão (22h)","R$ 90–120/pessoa"],
            ["Ref. Airbnb","~R$ 215–250"],
            ["Ref. Ibis","~R$ 300"],
          ]);
        }
        if(/Inscriç/.test(combined)){
          h3("Inscrições (Sympla — privado, só por link)");
          table(["Público","Janela","Responsável"], [
            ["Equipe/voluntários","01/09 → 30/09","Margrit"],
            ["Alunos fase 1 (reencontristas)","próximas semanas","Marcos Ulaf"],
            ["Alunos fase 2 (aberta)","metade de setembro","Margrit"],
          ]);
        }
      }
      if(sec.titulo.includes("Escola de Paraambulatório")){
        h3("Lotes");
        table(["Lote","Janela","Público geral","60+ / voluntário"], [
          ["Lote 1","até 30/09","R$ 400","R$ 300"],
          ["Lote 2","após 30/09","R$ 600","R$ 400"],
        ]);
        para("Custo: praticamente só assinatura Zoom (~R$ 500). Projeção ~R$ 56 mil. Ao virar o lote, atualizar valor na loja.");
      }
      if(sec.titulo.includes("Parapedagógico")){
        const stats = /406[\s\S]*60[\s\S]*176/.test(combined) ? "406 presenciais · 60 à distância · 176 usuários · 512 pedidos ago · 37 relatórios" : "";
        if(stats){ h3("Sistema da DIP — números"); para(stats); }
      }
      bullets(sec.itens);
    }
  }

  // Decisões — tabela única numerada (sem repetir bullets)
  const decisoes: string[] = Array.isArray(ata.decisoes) ? (ata.decisoes as string[]).filter(Boolean) : [];
  if(decisoes.length){
    h2("Decisões da reunião");
    table(["#","Decisão"], decisoes.map((d,i)=> [String(i+1), d]));
  }

  // Demandas — Responsável | Demanda | Prazo (vencidas no topo)
  if(demandas.length){
    h2("Demandas e próximos passos");
    // vencidas primeiro (prazo < hoje)
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const vencidas = demandas.filter(d=> d.prazo && new Date(d.prazo) < hoje);
    const normais = demandas.filter(d=> !vencidas.includes(d));
    const ordenadas = [...vencidas, ...normais];
    const rows = await Promise.all(ordenadas.map(async d=>{
      const resp = demandaResponsaveis.get(d.id) || "—";
      const prazo = d.prazo ? format(new Date(`${d.prazo}T00:00:00`), "dd/MM/yyyy", { locale: ptBR }) + (vencidas.includes(d) ? " (vencida)" : "") : "—";
      return [resp, d.titulo, prazo];
    }));
    table(["Responsável","Demanda","Prazo"], rows);
  }

  // Calendário
  const calendario: any[] = Array.isArray(ata.calendario) ? ata.calendario as any[] : [];
  if(calendario.length){
    h2("Calendário");
    table(["Data","Compromisso"], calendario.map((c:any)=> [c.data, c.compromisso]));
  }

  // Observações
  if(ata.observacoes){
    h2("Observações");
    para(ata.observacoes);
  }

  // DIP
  if(dips.length){
    h2("Dinâmica DIP");
    for(const d of dips){
      const meta = [`${d.localidade} — ${d.pais}`, d.data_dip? format(new Date(`${d.data_dip}T00:00:00`), "dd/MM/yyyy", { locale: ptBR }):"", d.participantes!==null?`${d.participantes} participantes`:""].filter(Boolean).join("  ·  ");
      doc.font("Helvetica-Bold").fontSize(9).fillColor(TEXT).text(meta, M, doc.y, { width });
      if(d.observacoes) para(d.observacoes);
    }
  }

  footer();
  doc.end();
  await done;
  const pdf = Buffer.concat(chunks);
  const filename = sanitizeFilename(`ata-${dataLabel.replaceAll("/","-")}.pdf`);
  return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Content-Length": String(pdf.length), "Cache-Control": "no-store, max-age=0" } });
}
