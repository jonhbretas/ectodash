// src/lib/contratos/pdf.ts
// Geração do PDF do contrato com pdfkit, seguindo o layout do módulo de atas
// (banda #2195B9 no topo, cabeçalhos de seção com barra de acento, rodapé com
// página). Fontes WinAnsi (Helvetica) cobrem os acentos pt-BR sem embutir
// fontes. O conteúdo do modelo já deve estar renderizado (variáveis trocadas).

import PDFDocument from "pdfkit";

const ACCENT = "#2195B9";
const TEXT_DARK = "#18181b";
const TEXT_MID = "#52525b";
const TEXT_MUTED = "#a1a1aa";
const RULE = "#e4e4e7";

const MARGIN = 48;

export type ContratoPdfInput = {
  numero: string;
  modeloTitulo: string;
  categoriaLabel: string;
  conteudo: string;
  alunoNome: string;
  alunoDocumento?: string | null;
  alunoEmail?: string | null;
  alunoTelefone?: string | null;
  valor?: string | null;
  evento?: { titulo: string; data?: string | null; local?: string | null } | null;
  emissao: string;
};

/** Divide o texto do modelo em parágrafos (linhas em branco separam blocos). */
function paragrafos(texto: string): string[] {
  return texto
    .split(/\n{2,}/)
    .map((bloco) => bloco.split("\n").map((l) => l.trim()).filter(Boolean).join(" "))
    .filter(Boolean);
}

export async function buildContratoPdf(input: ContratoPdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: MARGIN });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  const contentWidth = doc.page.width - MARGIN * 2;

  function drawFooter() {
    const page = doc.page;
    const y = page.height - 34;
    const footerOptions = { height: 20, lineBreak: false };

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
      .text("EctoDash · Contratos", page.margins.left, y, footerOptions);
    doc.text(
      `Página ${doc.bufferedPageRange().start + doc.bufferedPageRange().count}`,
      page.width - page.margins.right - 120,
      y,
      { ...footerOptions, width: 120, align: "right" }
    );

    const fontSource = prev.fontSource;
    if (fontSource) {
      if (prev.fontFamily) {
        doc.font(fontSource, prev.fontFamily);
      } else {
        doc.font(fontSource);
      }
    }
    doc.fontSize(prev.fontSize);
    doc.fillColor(prev.fillColor[0], prev.fillColor[1]);
    doc.x = prev.x;
    doc.y = prev.y;
  }

  doc.on("pageAdded", drawFooter);

  // ── Banda do cabeçalho ───────────────────────────────────────────────
  const BAND_HEIGHT = 96;
  doc.save();
  doc.rect(0, 0, doc.page.width, BAND_HEIGHT).fill(ACCENT);
  doc.restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(17)
    .fillColor("#ffffff")
    .text(input.modeloTitulo, MARGIN, 28, { width: contentWidth, align: "center" });

  const metaLinha = [
    input.categoriaLabel,
    input.numero ? `Contrato nº ${input.numero}` : "",
    `Emissão: ${input.emissao}`,
  ]
    .filter(Boolean)
    .join("  ·  ");
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#dbeafe")
    .text(metaLinha, MARGIN, 64, { width: contentWidth, align: "center" });

  doc.moveDown(0);
  doc.y = BAND_HEIGHT + 10;
  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(doc.page.width - MARGIN, doc.y)
    .lineWidth(0.8)
    .strokeColor(RULE)
    .stroke();
  doc.y += 8;

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

  function paragraph(text: string) {
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(TEXT_DARK)
      .text(text, { lineGap: 4, align: "justify" });
    doc.moveDown(0.4);
  }

  function infoCard() {
    const linhas: Array<[string, string]> = [
      ["Aluno", input.alunoNome],
      ...(input.alunoDocumento ? ([["Documento", input.alunoDocumento]] as Array<[string, string]>) : []),
      ...(input.alunoEmail ? ([["E-mail", input.alunoEmail]] as Array<[string, string]>) : []),
      ...(input.alunoTelefone ? ([["Telefone", input.alunoTelefone]] as Array<[string, string]>) : []),
      ...(input.evento
        ? ([
            ["Evento", input.evento.titulo],
            ...(input.evento.data ? ([["Data do evento", input.evento.data]] as Array<[string, string]>) : []),
            ...(input.evento.local ? ([["Local", input.evento.local]] as Array<[string, string]>) : []),
          ] as Array<[string, string]>)
        : []),
      ...(input.valor ? ([["Valor", input.valor]] as Array<[string, string]>) : []),
    ];

    const pad = 12;
    const innerWidth = contentWidth - pad * 2;

    doc.font("Helvetica-Bold").fontSize(11);
    const heights = linhas.map(([rotulo, valor]) =>
      Math.max(
        doc.heightOfString(rotulo, { width: innerWidth / 2 - 8 }),
        doc.heightOfString(valor, { width: innerWidth / 2 - 8 })
      )
    );
    const rowH = heights.reduce((a, b) => a + b, 0);
    const cardH = pad * 2 + rowH + (linhas.length - 1) * 6;

    doc.roundedRect(MARGIN, doc.y, contentWidth, cardH, 8).fillAndStroke(
      "#fafafa",
      RULE
    );

    const textX = MARGIN + pad;
    let textY = doc.y + pad;
    doc.font("Helvetica-Bold").fontSize(11).fillColor(TEXT_DARK);
    for (let i = 0; i < linhas.length; i += 1) {
      const [rotulo, valor] = linhas[i];
      doc.text(rotulo, textX, textY, { width: innerWidth / 2 - 8 });
      doc.font("Helvetica").fontSize(10.5).fillColor(TEXT_MID);
      doc.text(valor, textX + innerWidth / 2, textY, { width: innerWidth / 2 - 8 });
      doc.font("Helvetica-Bold").fontSize(11).fillColor(TEXT_DARK);
      textY += heights[i] + 6;
    }

    doc.y = doc.y + cardH + 10;
  }

  function signatureBlock() {
    if (doc.y + 170 > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
    }
    sectionHeader("Assinaturas");

    doc.moveDown(1);
    const halfWidth = (contentWidth - 40) / 2;
    const lineY = doc.y;

    for (const [x, quem] of [
      [MARGIN, "Assinatura do aluno"],
      [MARGIN + halfWidth + 40, "Assinatura da instituição"],
    ] as const) {
      doc
        .moveTo(x, lineY)
        .lineTo(x + halfWidth, lineY)
        .lineWidth(1)
        .strokeColor("#71717a")
        .stroke();
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(TEXT_MID)
        .text(quem, x, lineY + 8, { width: halfWidth, align: "center" });
    }

    doc.y = lineY + 34;
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(TEXT_MUTED)
      .text(
        "Assinatura eletrônica com validade jurídica (Assinafy / ICP-Brasil) ou assinatura manual do documento impresso.",
        { width: contentWidth, align: "center", lineGap: 2 }
      );
    doc.moveDown(0.4);
  }

  // ── Conteúdo ─────────────────────────────────────────────────────────
  sectionHeader("Partes do contrato");
  infoCard();

  sectionHeader("Cláusulas");
  const blocos = paragrafos(input.conteudo);
  for (const bloco of blocos) {
    paragraph(bloco);
  }

  const cidadeData = `Ectolab — ${input.emissao}`;
  doc.moveDown(1);
  doc
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor(TEXT_DARK)
    .text(cidadeData, { align: "right" });
  doc.moveDown(2);

  signatureBlock();

  drawFooter();
  doc.end();
  await done;

  return Buffer.concat(chunks);
}
