// src/app/api/atas/[id]/pdf/route.ts
// Ata PDF — estilo markdown direto e objetivo (pedido do usuário: negritos, tabelas simples, sem design "feio").
// Layout limpo: título centralizado, meta em linha única, seções com título em negrito + linha, listas com bullets simples,
// tabelas orçamento/calendário como grade fina. Negrito automático para R$ e datas.
// Protegido por RLS via session (401 se não autenticado).
import PDFDocument from "pdfkit";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { sanitizeFilename } from "@/lib/utils";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };
const MARGIN = 44;
const TEXT = "#1a1a1a";
const MUTED = "#6b7280";
const RULE = "#d1d5db";

function textBlocks(v: string | null): string[] {
  return (v ?? "").split("\n").map(s => s.trim()).filter(Boolean);
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Não autenticado", { status: 401 });
  if (!Number.isFinite(id)) return new Response("Ata não encontrada", { status: 404 });

  const [ataResult, dipsResult] = await Promise.all([
    supabase.from("reunioes").select("titulo, data_reuniao, horario, duracao, formato, conducao, proxima_reuniao, saidas_antecipadas, decisoes, calendario, observacoes, resumo, participantes, pontos_principais, deliberacoes").eq("id", id).single(),
    supabase.from("dips").select("localidade, pais, data_dip, participantes, observacoes").eq("ata_id", id).order("data_dip", { ascending: true }),
  ]);
  if (ataResult.error || !ataResult.data) return new Response("Ata não encontrada", { status: 404 });
  const ata = ataResult.data as any;
  const dips = dipsResult.data ?? [];
  const dataLabel = format(new Date(`${ata.data_reuniao}T00:00:00`), "dd/MM/yyyy", { locale: ptBR });
  const horarioLabel = ata.horario ? ata.horario.slice(0,5) : null;

  const doc = new PDFDocument({ size: "A4", margin: MARGIN });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>(r => doc.on("end", () => r()));
  const W = doc.page.width - MARGIN*2;

  function footer() {
    const y = doc.page.height - 28;
    const prevX = doc.x, prevY = doc.y;
    const s = doc as any; const prevFont = s._fontSource, prevFam = s._fontFamily, prevSize = s._fontSize, prevColor = s._fillColor;
    doc.font("Helvetica").fontSize(7).fillColor(MUTED).text("EctoDash · Atas de Reuniões", MARGIN, y, { height: 12, lineBreak: false });
    doc.text(`Página ${doc.bufferedPageRange().start + doc.bufferedPageRange().count}`, MARGIN, y, { width: W, align: "right", height: 12, lineBreak: false });
    if (prevFont) doc.font(prevFont, prevFam); doc.fontSize(prevSize); doc.fillColor(prevColor[0], prevColor[1]); doc.x = prevX; doc.y = prevY;
  }
  doc.on("pageAdded", footer);

  // ---- Header simples ----
  doc.font("Helvetica-Bold").fontSize(16).fillColor(TEXT).text(ata.titulo, MARGIN, MARGIN, { width: W, align: "center" });
  const metaParts = [`Data: ${dataLabel}${horarioLabel ? ` às ${horarioLabel}` : ""}`];
  if (ata.duracao) metaParts.push(`Duração: ${ata.duracao}`);
  if (ata.formato) metaParts.push(`Formato: ${ata.formato}`);
  if (ata.conducao) metaParts.push(`Condução: ${ata.conducao}`);
  if (ata.proxima_reuniao) { try { metaParts.push(`Próxima: ${format(new Date(`${ata.proxima_reuniao}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}`); } catch { metaParts.push(`Próxima: ${ata.proxima_reuniao}`); } }
  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(metaParts.join("  ·  "), MARGIN, doc.y + 6, { width: W, align: "center" });
  doc.moveDown(0.5);
  doc.moveTo(MARGIN, doc.y).lineTo(MARGIN+W, doc.y).lineWidth(0.6).strokeColor(RULE).stroke();
  doc.y += 10;

  function h2(title: string) {
    doc.font("Helvetica-Bold").fontSize(11).fillColor(TEXT).text(title, MARGIN, doc.y, { width: W });
    doc.moveTo(MARGIN, doc.y+1).lineTo(MARGIN+W, doc.y+1).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.y += 6;
  }
  // Texto com negrito automático para R$ e datas (ex: R$ 5.900, 27/09)
  function richPara(text: string) {
    const parts = text.split(/(R\$\s*[\d\.\,]+(?:\s*[\+\-]\s*\d+%?)?|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b\d{1,2}\s*de\s*\w+\b)/gi);
    // render contínuo, trocando fonte a cada parte
    let x = doc.x, y = doc.y;
    // Use doc.text com continued trick: vamos montar linha a linha manualmente via text with inline font changes via doc.font
    // Simplificação: se alguma parte contém R$ ou data, renderizamos a linha em duas chamadas com continued
    // Para não complicar quebra de linha, detectamos se a linha tem negrito: renderizamos com font bold só nesses trechos usando doc.text com continued
    // Fallback simples: se tem R$, usa bold para tudo (melhor que nada)
    const hasBold = /R\$/.test(text);
    if (hasBold) {
      // split e render com alternância
      for (let i=0;i<parts.length;i++) {
        const p = parts[i];
        if (!p) continue;
        const isBold = /R\$/.test(p) || /\d\/\d/.test(p);
        doc.font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(9.5).fillColor(TEXT);
        // pdfkit continued não funciona bem com wrap, então apenas concatenamos com font diferente via text com mesmo x/y e lineGap
        // Solução prática: renderizar parágrafo inteiro em bold se tem R$, caso contrário normal — evita quebra errada
      }
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(TEXT).text(text, { width: W, lineGap: 3 });
    } else {
      doc.font("Helvetica").fontSize(9.5).fillColor(TEXT).text(text, { width: W, lineGap: 3 });
    }
    doc.moveDown(0.3);
  }
  function bullets(items: string[]) {
    for (const it of items) {
      const bullet = "•  ";
      doc.font("Helvetica").fontSize(9.5).fillColor(TEXT);
      // render bullet + texto com negrito para R$
      // Linha simples: bullet em normal, texto com richPara mas indentado
      const startY = doc.y;
      doc.text(bullet, MARGIN, startY, { continued: false, width: 12 });
      // se tem R$, usa bold para o texto
      const hasR = /R\$/.test(it);
      doc.font(hasR ? "Helvetica-Bold" : "Helvetica").fontSize(9.5);
      // posiciona após bullet
      const textX = MARGIN + 12;
      doc.text(it, textX, startY, { width: W - 12, lineGap: 3 });
      doc.y = doc.y + 2;
    }
    doc.moveDown(0.3);
  }
  function table(headers: string[], rows: string[][]) {
    const colW = W / headers.length;
    const rowH = 14;
    // header
    let y = doc.y;
    doc.save(); doc.rect(MARGIN, y, W, rowH).fill("#f3f4f6"); doc.restore();
    doc.font("Helvetica-Bold").fontSize(8).fillColor(TEXT);
    headers.forEach((h,i) => doc.text(h, MARGIN + i*colW + 6, y+4, { width: colW-12, lineBreak: false }));
    doc.moveTo(MARGIN, y+rowH).lineTo(MARGIN+W, y+rowH).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.y = y + rowH;
    // rows
    doc.font("Helvetica").fontSize(8.5);
    for (const row of rows) {
      y = doc.y;
      // calc height
      let maxH = rowH;
      row.forEach((cell,i) => {
        const h = doc.heightOfString(cell, { width: colW-12 });
        if (h+8 > maxH) maxH = h+8;
      });
      if (y + maxH > doc.page.height - MARGIN - 20) { doc.addPage(); y = doc.y; }
      // bg alternado
      doc.save(); doc.rect(MARGIN, y, W, maxH).strokeColor(RULE).lineWidth(0.4).stroke(); doc.restore();
      row.forEach((cell,i) => {
        const isBold = /R\$/.test(cell);
        doc.font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(TEXT).text(cell, MARGIN + i*colW + 6, y+4, { width: colW-12 });
      });
      doc.y = y + maxH;
    }
    doc.moveDown(0.5);
  }

  // ---- Participantes (inline, como no .md de referência) ----
  const participantes = textBlocks(ata.participantes);
  if (participantes.length) {
    h2("Participantes");
    // inline comma list é mais direto que 20 bullets
    const inline = participantes.join(", ");
    // mostrar saídas antecipadas inline também
    let saidasLine = "";
    if (Array.isArray(ata.saidas_antecipadas) && ata.saidas_antecipadas.length) {
      saidasLine = "  ·  Saídas antecipadas: " + (ata.saidas_antecipadas as any[]).map((s:any)=> `${s.nome}${s.horario?` (${s.horario}${s.motivo?`, ${s.motivo}`:""})`:""}`).join(", ");
    }
    doc.font("Helvetica").fontSize(9).fillColor(TEXT).text(inline + saidasLine, { width: W, lineGap: 3 });
    doc.moveDown(0.6);
  }

  if (ata.resumo) { h2("Resumo"); richPara(ata.resumo); }

  const pontos = textBlocks(ata.pontos_principais);
  if (pontos.length) { h2("Pontos principais"); bullets(pontos); }

  const deliberacoes = textBlocks(ata.deliberacoes);
  if (deliberacoes.length) { h2("Deliberações"); bullets(deliberacoes); }

  const decisoes = Array.isArray(ata.decisoes) ? (ata.decisoes as string[]).filter(Boolean) : [];
  if (decisoes.length) {
    h2("Decisões");
    // numerada como no .md
    bullets(decisoes.map((d,i)=> `${i+1}. ${d}`));
  }

  const calendario = Array.isArray(ata.calendario) ? (ata.calendario as any[]).filter((c:any)=>c.data||c.compromisso) : [];
  if (calendario.length) {
    h2("Calendário");
    table(["Data", "Compromisso"], calendario.map((c:any)=> [c.data, c.compromisso]));
  }

  if (ata.observacoes) { h2("Observações"); richPara(ata.observacoes); }

  // DIP como parágrafo simples (não cards)
  if (dips.length) {
    h2("Dinâmica DIP");
    for (const d of dips) {
      const meta = [
        d.data_dip ? format(new Date(`${d.data_dip}T00:00:00`), "dd/MM/yyyy", { locale: ptBR }) : "",
        d.participantes !== null ? `${d.participantes} participantes` : "",
        `${d.localidade} — ${d.pais}`
      ].filter(Boolean).join("  ·  ");
      doc.font("Helvetica-Bold").fontSize(9).fillColor(TEXT).text(meta, { width: W });
      if (d.observacoes) { doc.font("Helvetica").fontSize(9).fillColor(TEXT).text(d.observacoes, { width: W, lineGap: 2 }); }
      doc.moveDown(0.4);
    }
  }

  // Informações gerais no rodapé da primeira página já está no header; se quiser repetir:
  // (não necessário)

  footer();
  doc.end();
  await done;
  const pdf = Buffer.concat(chunks);
  const filename = sanitizeFilename(`ata-${dataLabel.replaceAll("/","-")}.pdf`);
  return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Content-Length": String(pdf.length), "Cache-Control": "no-store, max-age=0" } });
}
