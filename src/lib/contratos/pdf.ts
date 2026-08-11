// src/lib/contratos/pdf.ts
// Geração do PDF do contrato com pdfkit, layout profissional com logo,
// bandas de destaque, tipografia clara e assinatura eletrônica.

import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";

const ACCENT = "#2195B9";
const ACCENT_LIGHT = "#e8f4f8";
const ACCENT_DARK = "#1a7a94";
const TEXT_DARK = "#18181b";
const TEXT_MID = "#52525b";
const TEXT_MUTED = "#a1a1aa";
const RULE = "#e4e4e7";
const RULE_DARK = "#d4d4d8";
const BG_LIGHT = "#fafafa";
const WHITE = "#ffffff";

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
    .map((bloco) =>
      bloco
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .join(" ")
    )
    .filter(Boolean);
}

/** Caminho absoluto para a logo em public/. */
const LOGO_PATH = path.join(process.cwd(), "public", "logo-ectolab.png");

function logoExists(): boolean {
  try {
    fs.accessSync(LOGO_PATH, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function buildContratoPdf(
  input: ContratoPdfInput
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: MARGIN });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  const contentWidth = doc.page.width - MARGIN * 2;

  // ── Rodapé ─────────────────────────────────────────────────────────
  function drawFooter() {
    const page = doc.page;
    const y = page.height - 34;
    const footerOpts = { height: 20, lineBreak: false };

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

    // Linha separadora do rodapé
    doc
      .moveTo(MARGIN, y - 8)
      .lineTo(page.width - MARGIN, y - 8)
      .lineWidth(0.5)
      .strokeColor(RULE)
      .stroke();

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(TEXT_MUTED)
      .text("Ectolab · Contratos", MARGIN, y, footerOpts);
    doc.text(
      `Página ${doc.bufferedPageRange().start + doc.bufferedPageRange().count}`,
      page.width - page.margins.right - 120,
      y,
      { ...footerOpts, width: 120, align: "right" }
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

  // ── Banda do cabeçalho com logo ───────────────────────────────────
  const BAND_HEIGHT = 110;
  doc.save();
  // Fundo da banda
  doc.rect(0, 0, doc.page.width, BAND_HEIGHT).fill(ACCENT);
  // Barra decorativa inferior da banda
  doc.rect(0, BAND_HEIGHT - 4, doc.page.width, 4).fill(ACCENT_DARK);
  doc.restore();

  // Logo (se existir)
  const hasLogo = logoExists();
  const logoW = hasLogo ? 40 : 0;
  const logoH = hasLogo ? 40 : 0;
  const logoX = MARGIN + 8;
  const logoY = 18;

  if (hasLogo) {
    try {
      doc.image(LOGO_PATH, logoX, logoY, {
        width: logoW,
        height: logoH,
        fit: [logoW, logoH],
      });
    } catch {
      // Ignora erro de logo
    }
  }

  // Título ao lado da logo ou centralizado
  const titleX = hasLogo ? logoX + logoW + 12 : MARGIN;
  const titleWidth = hasLogo ? contentWidth - logoW - 12 : contentWidth;
  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor(WHITE)
    .text(input.modeloTitulo, titleX, 26, {
      width: titleWidth,
      align: hasLogo ? "left" : "center",
    });

  // Linha de metadata abaixo do título
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
    .fillColor("#c7e6f0")
    .text(metaLinha, titleX, 56, {
      width: titleWidth,
      align: hasLogo ? "left" : "center",
    });

  // ── Posição inicial do conteúdo ────────────────────────────────────
  doc.y = BAND_HEIGHT + 16;

  // ── Helpers de seção ──────────────────────────────────────────────
  function sectionHeader(title: string) {
    if (doc.y + 60 > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
    }
    doc.moveDown(0.5);

    // Barra lateral de destaque
    const accentY = doc.y + 2;
    doc.save();
    doc.roundedRect(doc.x, accentY, 4, 15, 2).fill(ACCENT);
    doc.restore();

    // Título da seção
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(TEXT_DARK)
      .text(title, { indent: 14 });

    doc.moveDown(0.15);

    // Linha separadora
    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(doc.page.width - MARGIN, doc.y)
      .lineWidth(0.8)
      .strokeColor(RULE_DARK)
      .stroke();
    doc.moveDown(0.5);
  }

  function paragraph(text: string) {
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(TEXT_DARK)
      .text(text, { lineGap: 5, align: "justify" });
    doc.moveDown(0.45);
  }

  // ── Card de informações ────────────────────────────────────────────
  function infoCard() {
    const linhas: Array<[string, string]> = [
      ["Aluno", input.alunoNome],
      ...(input.alunoDocumento
        ? [["Documento", input.alunoDocumento] as [string, string]]
        : []),
      ...(input.alunoEmail
        ? [["E-mail", input.alunoEmail] as [string, string]]
        : []),
      ...(input.alunoTelefone
        ? [["Telefone", input.alunoTelefone] as [string, string]]
        : []),
      ...(input.evento
        ? [
            ["Evento", input.evento.titulo] as [string, string],
            ...(input.evento.data
              ? [["Data do evento", input.evento.data] as [string, string]]
              : []),
            ...(input.evento.local
              ? [["Local", input.evento.local] as [string, string]]
              : []),
          ]
        : []),
      ...(input.valor ? [["Valor", input.valor] as [string, string]] : []),
    ];

    const pad = 14;
    const innerWidth = contentWidth - pad * 2;
    const labelWidth = innerWidth * 0.35;
    const valueWidth = innerWidth * 0.65;

    // Calcular alturas das linhas
    doc.font("Helvetica-Bold").fontSize(10.5);
    const heights = linhas.map(([rotulo, valor]) =>
      Math.max(
        doc.heightOfString(rotulo, { width: labelWidth }),
        doc.heightOfString(valor, { width: valueWidth })
      )
    );
    const totalRowsHeight = heights.reduce((a, b) => a + b, 0);
    const cardH = pad * 2 + totalRowsHeight + (linhas.length - 1) * 8;

    // Fundo do card
    doc.roundedRect(MARGIN, doc.y, contentWidth, cardH, 6).fillAndStroke(
      BG_LIGHT,
      RULE
    );

    // Borda esquerda colorida do card
    doc.save();
    doc.roundedRect(MARGIN, doc.y, 4, cardH, 2).fill(ACCENT);
    doc.restore();

    const textX = MARGIN + pad + 4;
    let textY = doc.y + pad;

    for (let i = 0; i < linhas.length; i++) {
      const [rotulo, valor] = linhas[i];

      // Rótulo (negrito)
      doc
        .font("Helvetica-Bold")
        .fontSize(10.5)
        .fillColor(TEXT_DARK)
        .text(rotulo, textX, textY, { width: labelWidth });

      // Valor (regular)
      doc
        .font("Helvetica")
        .fontSize(10.5)
        .fillColor(TEXT_MID)
        .text(valor, textX + labelWidth + 8, textY, { width: valueWidth });

      textY += heights[i] + 8;
    }

    doc.y = doc.y + cardH + 12;
  }

  // ── Bloco de assinaturas ──────────────────────────────────────────
  function signatureBlock() {
    if (doc.y + 200 > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
    }
    sectionHeader("Assinaturas");

    doc.moveDown(1.5);
    const halfWidth = (contentWidth - 60) / 2;
    const lineY = doc.y;

    const signatures = [
      [MARGIN, "Assinatura do aluno"],
      [MARGIN + halfWidth + 60, "Assinatura da instituição"],
    ] as const;

    for (const [x, quem] of signatures) {
      // Linha de assinatura
      doc
        .moveTo(x, lineY)
        .lineTo(x + halfWidth, lineY)
        .lineWidth(1.2)
        .strokeColor(TEXT_DARK)
        .stroke();

      // Texto abaixo da linha
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(TEXT_MID)
        .text(quem, x, lineY + 10, {
          width: halfWidth,
          align: "center",
        });
    }

    doc.y = lineY + 40;

    // Nota sobre assinatura eletrônica
    doc.moveDown(1.5);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(TEXT_MUTED)
      .text(
        "Assinatura eletrônica com validade jurídica (Assinafy / ICP-Brasil) ou assinatura manual do documento impresso.",
        { width: contentWidth, align: "center", lineGap: 2 }
      );
    doc.moveDown(0.5);
  }

  // ── Conteúdo do contrato ──────────────────────────────────────────
  sectionHeader("Partes do contrato");
  infoCard();

  sectionHeader("Cláusulas");
  const blocos = paragrafos(input.conteudo);
  for (const bloco of blocos) {
    paragraph(bloco);
  }

  // Local e data
  doc.moveDown(1.5);
  doc
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor(TEXT_DARK)
    .text(`Ectolab — ${input.emissao}`, { align: "right" });
  doc.moveDown(2);

  signatureBlock();

  drawFooter();
  doc.end();
  await done;

  return Buffer.concat(chunks);
}
