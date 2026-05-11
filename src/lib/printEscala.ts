// Geração de impressão profissional da Escala de Plantões
// - Não expõe CPF, dados bancários, endereço residencial ou informações privadas.
// - Usa apenas dados reais (passados pelo chamador).

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getLogoSmsDataUrl, logoSmsImgHtml } from "./logoSMS";
import type { StampData } from "./pdfStampUtils";

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

  const assinaturas = opts.incluirAssinatura ? `
    <div class="assinaturas">
      <div class="ass-box">
        ${responsavel?.assinaturaBase64 ? `<img src="${responsavel.assinaturaBase64}" style="height:50px;display:block;margin:0 auto -5px" />` : '<div style="height:50px"></div>'}
        <div class="ass-line"></div>
        <div class="ass-nome"><strong>${escapeHtml(responsavel?.nome || "Gestor / Coordenador")}</strong></div>
        <div class="ass-cargo">${escapeHtml(responsavel?.cargo || "Coordenação")}</div>
        ${responsavel?.conselho ? `<div class="ass-cons">${escapeHtml(responsavel.conselho)}</div>` : ""}
        ${responsavel?.unidade ? `<div class="ass-unid">${escapeHtml(responsavel.unidade)}</div>` : ""}
        ${/* !responsavel?.assinaturaBase64 ? '<div class="ass-missing">Assinatura não cadastrada</div>' : '' */ ""}
      </div>
      <div class="ass-box">
        ${responsavelTecnico?.assinaturaBase64 ? `<img src="${responsavelTecnico.assinaturaBase64}" style="height:50px;display:block;margin:0 auto -5px" />` : '<div style="height:50px"></div>'}
        <div class="ass-line"></div>
        <div class="ass-nome"><strong>${escapeHtml(responsavelTecnico?.nome || "Responsável Técnico")}</strong></div>
        <div class="ass-cargo">${escapeHtml(responsavelTecnico?.cargo || "Responsável Técnico")}</div>
        ${responsavelTecnico?.conselho ? `<div class="ass-cons">${escapeHtml(responsavelTecnico.conselho)}</div>` : ""}
        ${responsavelTecnico?.unidade ? `<div class="ass-unid">${escapeHtml(responsavelTecnico.unidade)}</div>` : ""}
        ${/* !responsavelTecnico?.assinaturaBase64 ? '<div class="ass-missing">Assinatura não cadastrada</div>' : '' */ ""}
      </div>
    </div>` : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Escala de Plantões</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; }
  .header { border-bottom: 2px solid #0e7490; padding-bottom: 10px; margin-bottom: 12px; display:flex; align-items:center; gap:14px; }
  .header .brand { flex: 1; }
  .header h1 { font-size: 16px; margin: 0; color: #0e7490; }
  .header h2 { font-size: 13px; margin: 2px 0 0; color: #111; font-weight: 600; }
  .meta { font-size: 11px; color: #444; margin-top: 6px; }
  .meta span { display: inline-block; margin-right: 14px; }
  .info { font-size: 11px; color: #333; margin: 8px 0 0; display:grid; grid-template-columns: repeat(2, 1fr); gap: 2px 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 10.5px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; color: #0f172a; font-weight: 700; font-size: 10.5px; }
  tr:nth-child(even) td { background: #fafafa; }
  .totais { margin-top: 14px; font-size: 11px; display:flex; gap:24px; }
  .totais b { color: #0e7490; }
  .assinaturas { margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; font-size: 11px; }
  .ass-box { text-align: center; }
  .ass-line { border-top: 1px solid #111; padding-top: 4px; text-align: center; width: 100%; margin-top: 5px; }
  .ass-nome { font-size: 10.5px; }
  .ass-cargo, .ass-cons, .ass-unid { font-size: 9px; color: #444; }
  .ass-missing { font-size: 8px; color: #888; margin-top: 2px; }
  .footer { margin-top: 28px; border-top: 1px solid #e5e7eb; padding-top: 6px; font-size: 10px; color: #555; text-align: center; }
  @media print {
    body { margin: 12mm; }
    .no-print { display: none !important; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    .assinaturas { page-break-inside: avoid; }
  }
  .toolbar { position: sticky; top: 0; background: #fff; padding: 8px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 12px; display:flex; gap:8px; }
  .toolbar button { background:#0e7490; color:#fff; border:none; padding: 6px 12px; border-radius: 6px; cursor:pointer; font-size: 12px; }
  .toolbar button.secondary { background:#fff; color:#111; border:1px solid #cbd5e1; }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()">🖨️ Imprimir</button>
    <button class="secondary" onclick="window.close()">Fechar</button>
  </div>

  <div class="header">
    ${logoSmsImgHtml(64)}
    <div class="brand">
    <h1>${escapeHtml(cab.instituicao.nome || "Instituição")}</h1>
    ${cab.instituicao.cnpj ? `<div class="meta"><span>CNPJ: ${escapeHtml(cab.instituicao.cnpj)}</span>${cab.instituicao.endereco ? `<span>${escapeHtml(cab.instituicao.endereco)}</span>` : ""}</div>` : ""}
    <h2>Escala de Plantões</h2>
    <div class="info">
      ${cab.unidade ? `<div><b>Unidade:</b> ${escapeHtml(cab.unidade)}</div>` : ""}
      ${cab.setor ? `<div><b>Setor:</b> ${escapeHtml(cab.setor)}</div>` : ""}
      <div><b>Período:</b> ${escapeHtml(cab.periodoLabel)}</div>
      <div><b>Emissão:</b> ${escapeHtml(emissao)}</div>
      ${cab.emitidoPor ? `<div><b>Emitido por:</b> ${escapeHtml(cab.emitidoPor)}</div>` : ""}
      <div><b>Sistema:</b> ${escapeHtml(sistema)}</div>
    </div>
    </div>
  </div>

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
