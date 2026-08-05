// src/app/api/atas/[id]/pdf/route.ts
// Ata PDF download — server-rendered with pdfkit. Modern, professional
// layout: navy title band, accent-bar section headers, DIP records as
// bordered cards (no forced page break — the old addPage() left a blank
// gap when DIPs followed short content), and a page-number footer on every
// page. Standard WinAnsi fonts (Helvetica) cover pt-BR accents without
// embedding font files. The route is just a download endpoint: the same
// session-bound client and RLS that gate the reunioes table protect the
// read, so a caller outside the authenticated session gets a 401 and RLS
// would return no row for roles without access.
import PDFDocument from "pdfkit";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const ACCENT = "#1e40af"; // blue-800
const TEXT_DARK = "#18181b";
const TEXT_MID = "#52525b";
const TEXT_MUTED = "#a1a1aa";
const RULE = "#e4e4e7";

const MARGIN = 48;

function textBlocks(value: string | null): string[] {
  return (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Não autenticado", { status: 401 });
  }

  if (!Number.isFinite(id)) {
    return new Response("Ata não encontrada", { status: 404 });
  }

  const [ataResult, dipsResult] = await Promise.all([
    supabase
      .from("reunioes")
      .select(
        "titulo, data_reuniao, horario, resumo, participantes, pontos_principais, deliberacoes"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("dips")
      .select("localidade, pais, data_dip, participantes, observacoes")
      .eq("ata_id", id)
      .order("data_dip", { ascending: true }),
  ]);

  if (ataResult.error || !ataResult.data) {
    return new Response("Ata não encontrada", { status: 404 });
  }

  const ata = ataResult.data;
  const dips = dipsResult.data ?? [];
  const dataLabel = format(new Date(`${ata.data_reuniao}T00:00:00`), "dd/MM/yyyy", {
    locale: ptBR,
  });
  // Supabase returns `time` columns as "HH:MM:SS" — trim the seconds.
  const horarioLabel = ata.horario ? ata.horario.slice(0, 5) : null;

  const doc = new PDFDocument({ size: "A4", margin: MARGIN });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  const contentWidth = doc.page.width - MARGIN * 2;

  function drawFooter() {
    const page = doc.page;
    const y = page.height - 34;
    // An explicit `height` (non-null) makes the text wrapper skip its
    // continue-on-new-page logic — without it, text drawn below the bottom
    // margin triggers addPage → pageAdded → drawFooter → infinite recursion
    // (RangeError: Maximum call stack size exceeded).
    const footerOptions = { height: 20, lineBreak: false };

    // pageAdded fires inside continueOnNewPage — mid text-wrap. The line
    // wrapper resumes drawing with the CURRENT doc state, so any change
    // here to x/y, font, size, or fill color would render the continuation
    // off-page: every remaining line got its own near-blank page (the old
    // 43-page bug). Preserve and restore the full text state.
    const state = doc as unknown as {
      x: number;
      y: number;
      _fontSource: string;
      _fontFamily: string | null;
      _fontSize: number;
      _fillColor: [string, number | undefined];
    };
    const prev = {
      x: doc.x,
      y: doc.y,
      fontSource: state._fontSource,
      fontFamily: state._fontFamily,
      fontSize: state._fontSize,
      fillColor: state._fillColor,
    };

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(TEXT_MUTED)
      .text("EctoDash · Atas de Reuniões", page.margins.left, y, footerOptions);
    // bufferedPageRange().start+count = index of the current page: with the
    // default streaming buffer (bufferPages:false) only the current page is
    // kept, so .count alone was always 1 ("Página 1" on every page).
    doc.text(
      `Página ${doc.bufferedPageRange().start + doc.bufferedPageRange().count}`,
      page.width - page.margins.right - 120,
      y,
      { ...footerOptions, width: 120, align: "right" }
    );

    if (prev.fontSource) {
      if (prev.fontFamily) {
        doc.font(prev.fontSource, prev.fontFamily);
      } else {
        doc.font(prev.fontSource);
      }
    }
    doc.fontSize(prev.fontSize);
    doc.fillColor(prev.fillColor[0], prev.fillColor[1]);
    doc.x = prev.x;
    doc.y = prev.y;
  }

  // Footer on every page (pageAdded fires for pages 2+; the last page gets
  // one final drawFooter() before doc.end()).
  doc.on("pageAdded", drawFooter);

  // ---------------------------------------------------------------------
  // Header band
  // ---------------------------------------------------------------------
  const BAND_HEIGHT = 96;
  doc.save();
  doc.rect(0, 0, doc.page.width, BAND_HEIGHT).fill(ACCENT);
  doc.restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(17)
    .fillColor("#ffffff")
    .text(ata.titulo, MARGIN, 30, { width: contentWidth, align: "center" });

  const metaLinha = `Data: ${dataLabel}${horarioLabel ? ` às ${horarioLabel}` : ""}`;
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#dbeafe")
    .text(metaLinha, MARGIN, 66, { width: contentWidth, align: "center" });

  // Thin rule under the band.
  doc.moveDown(0);
  doc.y = BAND_HEIGHT + 10;
  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(doc.page.width - MARGIN, doc.y)
    .lineWidth(0.8)
    .strokeColor(RULE)
    .stroke();
  doc.y += 8;

  // ---------------------------------------------------------------------
  // Section helpers
  // ---------------------------------------------------------------------
  function sectionHeader(title: string) {
    doc.moveDown(0.7);
    const accentY = doc.y + 2.5;
    doc.save();
    doc.roundedRect(doc.x, accentY, 4, 13, 2).fill(ACCENT);
    doc.restore();
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor(TEXT_DARK)
      .text(title, { indent: 12 });
    doc.moveDown(0.2);
    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(doc.page.width - MARGIN, doc.y)
      .lineWidth(0.7)
      .strokeColor(RULE)
      .stroke();
    doc.moveDown(0.45);
  }

  function bulletList(items: string[]) {
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#27272a")
      .list(items, {
        bulletRadius: 1.6,
        bulletIndent: 2,
        textIndent: 14,
        lineGap: 5,
      });
    doc.moveDown(0.4);
  }

  function paragraph(text: string) {
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(TEXT_DARK)
      .text(text, { lineGap: 4, align: "justify" });
    doc.moveDown(0.4);
  }

  function dipCard(dip: {
    localidade: string;
    pais: string;
    data_dip: string | null;
    participantes: number | null;
    observacoes: string | null;
  }) {
    const pad = 12;
    const innerWidth = contentWidth - pad * 2;

    const titleText = `${dip.localidade} — ${dip.pais}`;
    const metaText = [
      dip.data_dip
        ? `Data: ${format(new Date(`${dip.data_dip}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}`
        : "",
      dip.participantes !== null
        ? `Participantes: ${dip.participantes}`
        : "",
    ]
      .filter(Boolean)
      .join("   |   ");

    doc.font("Helvetica-Bold").fontSize(11.5);
    const titleH = doc.heightOfString(titleText, { width: innerWidth });
    doc.font("Helvetica").fontSize(10);
    const metaH = metaText ? doc.heightOfString(metaText, { width: innerWidth }) : 0;
    doc.font("Helvetica").fontSize(10.5);
    const obsH = dip.observacoes
      ? doc.heightOfString(dip.observacoes, { width: innerWidth })
      : 0;

    const gaps = (metaH ? 6 : 0) + (obsH ? 6 : 0);
    const cardH = pad * 2 + titleH + metaH + obsH + gaps;

    // Card fits the current page or starts a fresh one — never a blank gap.
    if (doc.y + cardH + 12 > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
    }

    doc.roundedRect(MARGIN, doc.y, contentWidth, cardH, 8).fillAndStroke(
      "#fafafa",
      RULE
    );

    const textX = MARGIN + pad;
    let textY = doc.y + pad;

    doc.font("Helvetica-Bold").fontSize(11.5).fillColor(TEXT_DARK);
    doc.text(titleText, textX, textY, { width: innerWidth });
    textY += titleH;

    if (metaText) {
      textY += 6;
      doc.font("Helvetica").fontSize(10).fillColor(TEXT_MID);
      doc.text(metaText, textX, textY, { width: innerWidth });
      textY += metaH;
    }

    if (dip.observacoes) {
      textY += 6;
      doc.font("Helvetica").fontSize(10.5).fillColor("#3f3f46");
      doc.text(dip.observacoes, textX, textY, { width: innerWidth });
    }

    doc.y = doc.y + cardH + 10;
  }

  // ---------------------------------------------------------------------
  // Content — participante → resumo → pontos → deliberações → DIPs
  // ---------------------------------------------------------------------
  const participantes = textBlocks(ata.participantes);
  if (participantes.length > 0) {
    sectionHeader("Participantes");
    bulletList(participantes);
  }

  if (ata.resumo) {
    sectionHeader("Resumo");
    paragraph(ata.resumo);
  }

  const pontos = textBlocks(ata.pontos_principais);
  if (pontos.length > 0) {
    sectionHeader("Pontos principais");
    bulletList(pontos);
  }

  const deliberacoes = textBlocks(ata.deliberacoes);
  if (deliberacoes.length > 0) {
    sectionHeader("Deliberações");
    bulletList(deliberacoes);
  }

  if (dips.length > 0) {
    sectionHeader("Dinâmica DIP");
    for (const dip of dips) {
      dipCard(dip);
    }
  }

  drawFooter();
  doc.end();
  await done;

  const pdf = Buffer.concat(chunks);
  const filename = `ata-${dataLabel.replaceAll("/", "-")}.pdf`;

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.length),
      // Never let the browser's PDF viewer or the CDN serve a stale copy
      // (the old file kept reappearing after a redesign).
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
