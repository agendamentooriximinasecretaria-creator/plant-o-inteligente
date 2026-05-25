// Geração de impressão profissional da Escala de Plantões
// - Não expõe CPF, dados bancários, endereço residencial ou informações privadas.
// - Usa apenas dados reais (passados pelo chamador).

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getLogoSmsDataUrl, logoSmsImgHtml } from "./logoSMS";
import type { StampData } from "./pdfStampUtils";
import { DOCUMENT_CSS_BASE } from "./documentStyle";
import { buildHeaderHtml, buildSignatureHtml, buildFooterHtml } from "./documentTemplates";

export interface PrintInstituicao {
  nome?: string;
  cnpj?: string;
  endereco?: string;
}

export interface PrintCabecalho {
  instituicao: PrintInstituicao;
  unidade?: string;
  setor?: string;
  periodoLabel: string;
  emitidoPor?: string;
  sistema?: string;
}

export interface PrintLinha {
  profissional: string;
  profissao: string;
  conselho?: string; // ex: "CRM 12345" — só se incluirConselho=true
  unidade?: string;
  setor: string;
  data: string; // dd/mm/aaaa
  diaSemana: string;
  tipo: string;
  horario: string; // 07:00 - 19:00
  status: string;
  cargaHoras: number;
  observacoes?: string;
}

export interface PrintOptions {
  incluirObservacoes: boolean;
  incluirAssinatura: boolean;
  incluirTotalHoras: boolean;
  incluirConselho: boolean;
  responsavel?: StampData;
  responsavelTecnico?: StampData;
}

const DIAS_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function diaSemanaPt(dataIso: string): string {
  const d = new Date(dataIso + "T12:00:00");
  return DIAS_PT[d.getDay()];
}

function escapeHtml(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(
  cab: PrintCabecalho,
  linhas: PrintLinha[],
  opts: PrintOptions
): string {
  const totalPlantoes = linhas.length;
  const totalHoras = linhas.reduce((a, l) => a + (Number(l.cargaHoras) || 0), 0);
  const emissao = new Date().toLocaleString("pt-BR");

  const colunas = [
    "Profissional",
    "Profissão",
    ...(opts.incluirConselho ? ["Conselho"] : []),
    "Setor",
    "Data",
    "Dia",
    "Tipo",
    "Horário",
    "Status",
    ...(opts.incluirTotalHoras ? ["Horas"] : []),
    ...(opts.incluirObservacoes ? ["Observações"] : []),
  ];

  const trs = linhas
    .map(
      (l) => `
    <tr>
      <td>${escapeHtml(l.profissional)}</td>
      <td>${escapeHtml(l.profissao)}</td>
      ${opts.incluirConselho ? `<td>${escapeHtml(l.conselho || "Não informado")}</td>` : ""}
      <td>${escapeHtml(l.setor)}</td>
      <td>${escapeHtml(l.data)}</td>
      <td>${escapeHtml(l.diaSemana)}</td>
      <td>${escapeHtml(l.tipo)}</td>
      <td>${escapeHtml(l.horario)}</td>
      <td>${escapeHtml(l.status)}</td>
      ${opts.incluirTotalHoras ? `<td style="text-align:right">${l.cargaHoras}h</td>` : ""}
      ${opts.incluirObservacoes ? `<td>${escapeHtml(l.observacoes || "")}</td>` : ""}
    </tr>`
    )
    .join("");

  const sistema = cab.sistema || "GestorPlantão SMS Oriximiná";
  const responsavel = opts.responsavel;
  const responsavelTecnico = opts.responsavelTecnico;

  const headerHtml = buildHeaderHtml({
    title: "Escala de Plantões",
    unit: cab.unidade,
    sector: cab.setor,
    period: cab.periodoLabel,
    emission: emissao,
    issuer: cab.emitidoPor
  });

  const assinaturasHtml = opts.incluirAssinatura ? buildSignatureHtml({
    responsavel,
    responsavelTecnico
  }) : "";

  const footerHtml = buildFooterHtml(sistema);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Escala de Plantões</title>
<style>
  ${DOCUMENT_CSS_BASE}
  .toolbar { position: sticky; top: 0; background: #fff; padding: 12px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px; display:flex; gap:10px; }
  .toolbar button { background:#0e7490; color:#fff; border:none; padding: 8px 16px; border-radius: 6px; cursor:pointer; font-size: 13px; font-weight: 600; }
  .toolbar button.secondary { background:#fff; color:#111; border:1px solid #cbd5e1; }
  
  /* Ajustes específicos para esta tabela */
  table { margin-top: 5px; }
  th { text-transform: uppercase; font-size: 9pt; }
  td { font-size: 9pt; }
  .totais-resumo { margin: 15px 0; font-size: 10pt; font-weight: 700; color: #0e7490; }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()">🖨️ Imprimir Escala</button>
    <button class="secondary" onclick="window.close()">Fechar Janela</button>
  </div>

  ${headerHtml}

  <table>
    <thead>
      <tr>${colunas.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr>
    </thead>
    <tbody>${trs || `<tr><td colspan="${colunas.length}" style="text-align:center;color:#777">Nenhum plantão no período/filtros selecionados.</td></tr>`}</tbody>
  </table>

  <div class="totais-resumo">
    <span>Total de plantões: ${totalPlantoes}</span>
    ${opts.incluirTotalHoras ? `<span style="margin-left: 30px">Total de horas: ${totalHoras}h</span>` : ""}
  </div>

  ${assinaturasHtml}

  ${footerHtml}
</body>
</html>`;
}


  <table>
    <thead>
      <tr>${colunas.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr>
    </thead>
    <tbody>${trs || `<tr><td colspan="${colunas.length}" style="text-align:center;color:#777">Nenhum plantão no período/filtros selecionados.</td></tr>`}</tbody>
  </table>

  <div class="totais">
    <div><b>Total de plantões:</b> ${totalPlantoes}</div>
    ${opts.incluirTotalHoras ? `<div><b>Total de horas:</b> ${totalHoras}h</div>` : ""}
  </div>

  ${assinaturas}

  <div class="footer">Documento emitido pelo ${escapeHtml(sistema)} • ${escapeHtml(emissao)}</div>
</body>
</html>`;
}

export function abrirVisualizacaoImpressao(
  cab: PrintCabecalho,
  linhas: PrintLinha[],
  opts: PrintOptions,
  autoPrint = false
): boolean {
  const w = window.open("", "_blank", "width=1100,height=780");
  if (!w) return false;
  let html = buildHtml(cab, linhas, opts);
  if (autoPrint) {
    html = html.replace(
      "</body>",
      "<script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body>"
    );
  }
  w.document.write(html);
  w.document.close();
  return true;
}

export async function gerarPdfEscala(
  cab: PrintCabecalho,
  linhas: PrintLinha[],
  opts: PrintOptions,
  filename: string,
  modo: "save" | "open" = "save"
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Logo redonda no canto superior esquerdo
  const logo = await getLogoSmsDataUrl();
  const logoSize = 18; // mm
  const headerLeft = logo ? 14 + logoSize + 4 : 14;
  if (logo) {
    try {
      // Desenha círculo branco de fundo + clip visual via borda
      doc.setFillColor(255, 255, 255);
      doc.circle(14 + logoSize / 2, 14 + logoSize / 2 - 4, logoSize / 2 + 0.5, "F");
      doc.addImage(logo, "JPEG", 14, 14 - 4, logoSize, logoSize);
      doc.setDrawColor(14, 116, 144);
      doc.setLineWidth(0.4);
      doc.circle(14 + logoSize / 2, 14 + logoSize / 2 - 4, logoSize / 2, "S");
    } catch { /* ignora se a imagem falhar */ }
  }

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(14, 116, 144);
  doc.text(cab.instituicao.nome || "Instituição", headerLeft, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  let metaY = 19;
  const metaParts: string[] = [];
  if (cab.instituicao.cnpj) metaParts.push(`CNPJ: ${cab.instituicao.cnpj}`);
  if (cab.instituicao.endereco) metaParts.push(cab.instituicao.endereco);
  if (metaParts.length) {
    doc.text(metaParts.join("  •  "), headerLeft, metaY);
    metaY += 5;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text("Escala de Plantões", headerLeft, metaY + 2);

  const infoParts: string[] = [];
  if (cab.unidade) infoParts.push(`Unidade: ${cab.unidade}`);
  if (cab.setor) infoParts.push(`Setor: ${cab.setor}`);
  infoParts.push(`Período: ${cab.periodoLabel}`);
  infoParts.push(`Emissão: ${new Date().toLocaleString("pt-BR")}`);
  if (cab.emitidoPor) infoParts.push(`Emitido por: ${cab.emitidoPor}`);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  const infoText = infoParts.join("  •  ");
  const wrapped = doc.splitTextToSize(infoText, pageW - 28);
  doc.text(wrapped, 14, metaY + 7);

  const startY = metaY + 7 + wrapped.length * 4 + 2;

  const headers = [
    "Profissional",
    "Profissão",
    ...(opts.incluirConselho ? ["Conselho"] : []),
    "Setor",
    "Data",
    "Dia",
    "Tipo",
    "Horário",
    "Status",
    ...(opts.incluirTotalHoras ? ["Horas"] : []),
    ...(opts.incluirObservacoes ? ["Observações"] : []),
  ];

  const body = linhas.map((l) => [
    l.profissional,
    l.profissao,
    ...(opts.incluirConselho ? [l.conselho || "Não informado"] : []),
    l.setor,
    l.data,
    l.diaSemana,
    l.tipo,
    l.horario,
    l.status,
    ...(opts.incluirTotalHoras ? [`${l.cargaHoras}h`] : []),
    ...(opts.incluirObservacoes ? [l.observacoes || ""] : []),
  ]);

  autoTable(doc, {
    head: [headers],
    body,
    startY,
    styles: { fontSize: 7.5, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: [14, 116, 144], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 10, right: 10 },
    didDrawPage: () => {
      doc.setFontSize(7.5);
      doc.setTextColor(120);
      doc.text(
        `Documento emitido pelo ${cab.sistema || "GestorPlantão SMS Oriximiná"}  •  ${new Date().toLocaleString("pt-BR")}`,
        pageW / 2,
        pageH - 6,
        { align: "center" }
      );
    },
  });

  // Totais e assinatura
  const finalY = (doc as any).lastAutoTable?.finalY || startY + 10;
  const totalHoras = linhas.reduce((a, l) => a + (Number(l.cargaHoras) || 0), 0);
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text(`Total de plantões: ${linhas.length}`, 14, finalY + 8);
  if (opts.incluirTotalHoras) {
    doc.text(`Total de horas: ${totalHoras}h`, 70, finalY + 8);
  }

  // ===== Assinatura (Lado a lado) =====
  if (opts.incluirAssinatura) {
    const r1 = opts.responsavel;
    const r2 = opts.responsavelTecnico;
    const assY = Math.min(finalY + 25, pageH - 25);
    const lineLen = 75;
    const marginSide = 25;

    // Bloco Esquerdo - Gestor/Coordenador
    const xL = marginSide + lineLen / 2;
    if (r1?.assinaturaBase64) {
      try {
        doc.addImage(r1.assinaturaBase64, "PNG", marginSide + 5, assY - 14, lineLen - 10, 12);
    } catch { /* ignora */ }
    }
    doc.setLineWidth(0.3);
    doc.setDrawColor(0);
    doc.setTextColor(0);
    doc.line(marginSide, assY, marginSide + lineLen, assY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(r1?.nome || "Gestor / Coordenador", xL, assY + 3.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(r1?.cargo || "Coordenação", xL, assY + 6.5, { align: "center" });
    let curY1 = assY + 9.5;
    if (r1?.conselho) { doc.text(r1.conselho, xL, curY1, { align: "center" }); curY1 += 3; }
    if (r1?.unidade) { doc.text(r1.unidade, xL, curY1, { align: "center" }); }

    // Bloco Direito - Responsável Técnico
    const xR = pageW - marginSide - lineLen / 2;
    const marginR = pageW - marginSide - lineLen;
    if (r2?.assinaturaBase64) {
      try {
        doc.addImage(r2.assinaturaBase64, "PNG", marginR + 5, assY - 14, lineLen - 10, 12);
      } catch { /* ignora */ }
    }
    doc.setDrawColor(0);
    doc.setTextColor(0);
    doc.line(marginR, assY, pageW - marginSide, assY);
    doc.setFont("helvetica", "bold");
    doc.text(r2?.nome || "Responsável Técnico", xR, assY + 3.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text(r2?.cargo || "Responsável Técnico", xR, assY + 6.5, { align: "center" });
    let curY2 = assY + 9.5;
    if (r2?.conselho) { doc.text(r2.conselho, xR, curY2, { align: "center" }); curY2 += 3; }
    if (r2?.unidade) { doc.text(r2.unidade, xR, curY2, { align: "center" }); }
  }

  if (modo === "save") {
    doc.save(`${filename}.pdf`);
  } else {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }
}
