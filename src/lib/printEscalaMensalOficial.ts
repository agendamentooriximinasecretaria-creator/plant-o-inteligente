// ===============================================================
// Modelo de impressão: "Escala Mensal Oficial"
// ---------------------------------------------------------------
// Layout inspirado na escala em papel hospitalar:
//   - cabeçalho centralizado (Prefeitura > Secretaria > Unidade)
//   - tabela: Profissional × dias do mês (1..30/31) + Total
//   - células com siglas (D, N, M, T, 24, SA, F, LP, FE, A...)
//   - legenda automática a partir dos tipos de plantão configurados
//   - assinatura no canto inferior direito
//   - A4 landscape, CSS @media print sem sidebar/header/botões
//
// Sem dados sensíveis (CPF, banco, endereço residencial, observações privadas).
// ===============================================================

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getLogoSmsDataUrl, logoSmsImgHtml } from "./logoSMS";
import type { StampData } from "./pdfStampUtils";

export interface MensalInstituicao {
  prefeitura?: string;       // ex: "Prefeitura Municipal de Oriximiná"
  secretaria?: string;       // ex: "Secretaria Municipal de Saúde"
  unidade?: string;          // ex: "Hospital Municipal de Oriximiná"
  cnpj?: string;
}

export interface MensalTipoLegenda {
  sigla: string;             // D, N, M, T, 24, SA, F, LP, FE, A...
  nome: string;              // "Diurno 12h", "Noturno 12h"...
  start?: string;            // "07:00"
  end?: string;              // "19:00"
  carga?: number;
}

export interface MensalShift {
  dia: number;               // 1..31
  sigla: string;             // sigla do plantão
  tipo?: string;             // nome do tipo
  hora_inicio?: string;
  hora_fim?: string;
  carga?: number;
  status?: string;
}

export interface MensalProfissional {
  id: string;
  nome: string;
  profissao?: string;
  conselho?: string;         // ex: "CRM 12345" (opcional)
  porDia: Record<number, MensalShift[]>;
  totalHoras: number;
  totalPlantoes: number;
}

export interface MensalCabecalho {
  instituicao: MensalInstituicao;
  ano: number;
  mes: number;               // 1..12
  setor?: string;            // ex: "UCE / INTERNAÇÃO"
  profissaoLabel?: string;   // ex: "FISIOTERAPEUTAS"
  emitidoPor?: string;
  sistema?: string;
}

export interface MensalResponsavel {
  nome: string;
  cargo: string;
  conselho: string;
  unidade: string;
  assinaturaBase64?: string;
}

export interface MensalOpts {
  incluirLogo: boolean;
  incluirAssinatura: boolean;
  incluirTotalHoras: boolean;
  incluirObservacoesRodape: boolean;
  totalLabel?: "TOTAL" | "ADN";
  responsavel?: MensalResponsavel;
  responsavelTecnico?: MensalResponsavel;
}

const DIAS_PT_FULL = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const DIAS_SEM_ABREV = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

// Categorização por tipo de plantão -> cores suaves (RGB para jsPDF e hex para HTML)
function getCategoryColor(tipo: string, status: string): { bg: [number, number, number], hex: string, text: [number, number, number] } {
  const t = (tipo || "").toLowerCase();
  const s = (status || "").toLowerCase();

  if (s === "cancelado") return { bg: [254, 226, 226], hex: "#fee2e2", text: [153, 27, 27] };
  if (s === "pendente") return { bg: [254, 249, 195], hex: "#fef9c3", text: [133, 77, 14] };

  if (t.includes("férias") || t.includes("ferias")) return { bg: [204, 251, 241], hex: "#ccfbf1", text: [15, 118, 110] };
  if (t.includes("licença") || t.includes("licenca") || t.includes("lp")) return { bg: [207, 250, 254], hex: "#cffafe", text: [14, 116, 144] };
  if (t.includes("atestado")) return { bg: [255, 228, 230], hex: "#ffe4e6", text: [190, 18, 60] };
  if (t.includes("folga") || t.includes("indispon")) return { bg: [255, 247, 237], hex: "#fff7ed", text: [194, 65, 12] };
  if (t.includes("sobreaviso")) return { bg: [241, 245, 249], hex: "#f1f5f9", text: [51, 65, 85] };
  if (t.includes("24")) return { bg: [209, 250, 229], hex: "#d1fae5", text: [6, 95, 70] };
  if (t.includes("manh")) return { bg: [254, 243, 199], hex: "#fef3c7", text: [146, 64, 14] };
  if (t.includes("tarde")) return { bg: [255, 237, 213], hex: "#ffedd5", text: [154, 52, 18] };
  if (t.includes("not")) return { bg: [237, 233, 254], hex: "#ede9fe", text: [91, 33, 182] };
  if (t.includes("diurn")) return { bg: [224, 242, 254], hex: "#e0f2fe", text: [7, 89, 133] };

  return { bg: [255, 255, 255], hex: "#ffffff", text: [0, 0, 0] };
}

function escapeHtml(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function diasDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

function diaSemana(ano: number, mes: number, dia: number): number {
  return new Date(ano, mes - 1, dia).getDay();
}

function buildSubtituloTabela(cab: MensalCabecalho): string {
  const setor = cab.setor ? cab.setor.toUpperCase() : "";
  const prof = cab.profissaoLabel ? cab.profissaoLabel.toUpperCase() : "";
  const left = [prof, setor ? `(${setor})` : ""].filter(Boolean).join(" ");
  const periodo = `${DIAS_PT_FULL[cab.mes - 1]} ${cab.ano}`;
  return left ? `${left} - ${periodo}` : `ESCALA - ${periodo}`;
}

// ---------------------------------------------------------------
// HTML (Visualizar / Imprimir via window.print)
// ---------------------------------------------------------------
function buildHtml(cab: MensalCabecalho, profs: MensalProfissional[], tipos: MensalTipoLegenda[], opts: MensalOpts): string {
  const totalDias = diasDoMes(cab.ano, cab.mes);
  const totalLabel = opts.totalLabel || "TOTAL";
  const sistema = cab.sistema || "GestorPlantão SMS Oriximiná";
  const emissao = new Date().toLocaleString("pt-BR");

  const colDiaTh = Array.from({ length: totalDias }, (_, i) => {
    const d = i + 1;
    const dow = diaSemana(cab.ano, cab.mes, d);
    const fds = dow === 0 || dow === 6;
    return `<th class="dia ${fds ? "fds" : ""}"><div class="d">${d}</div><div class="dw">${DIAS_SEM_ABREV[dow]}</div></th>`;
  }).join("");

  const linhasTr = profs.length === 0
    ? `<tr><td colspan="${totalDias + 2}" class="empty">Nenhum profissional/plantão para os filtros selecionados.</td></tr>`
    : profs.map((p) => {
        const cells = Array.from({ length: totalDias }, (_, i) => {
          const d = i + 1;
          const lista = p.porDia[d] || [];
          const dow = diaSemana(cab.ano, cab.mes, d);
          const fds = dow === 0 || dow === 6;
          if (lista.length === 0) return `<td class="dia ${fds ? "fds" : ""}"></td>`;
          const siglas = lista.map((s) => s.sigla).join("/");
          const status = lista[0].status || "";
          const cls = status === "cancelado" ? "cancel" : status === "pendente" ? "pend" : "";
          const tooltip = lista.map((l) => `${l.tipo || l.sigla} ${(l.hora_inicio || "").slice(0, 5)}-${(l.hora_fim || "").slice(0, 5)}`).join(" | ");
          return `<td class="dia ${fds ? "fds" : ""} ${cls}" title="${escapeHtml(tooltip)}">${escapeHtml(siglas)}</td>`;
        }).join("");
        const total = opts.incluirTotalHoras ? `${p.totalHoras}h` : `${p.totalPlantoes}`;
        const conselho = p.conselho ? ` <span class="cons">${escapeHtml(p.conselho)}</span>` : "";
        return `<tr>
          <td class="nome">${escapeHtml(p.nome)}${conselho}</td>
          ${cells}
          <td class="total">${escapeHtml(total)}</td>
        </tr>`;
      }).join("");

  const legendaTipos = tipos.map((t) => {
    const horario = t.start && t.end ? `${t.start}h às ${t.end}h` : (t.nome || "");
    return `<span class="lg-item"><b>${escapeHtml(t.sigla)}</b> = ${escapeHtml(horario)}</span>`;
  }).join("");

  const subtitulo = buildSubtituloTabela(cab);

  const responsavel = opts.responsavel;
  const responsavelTecnico = opts.responsavelTecnico;
  
  const respHtml = opts.incluirAssinatura ? `
    <div class="ass-wrap">
      <div class="ass-box">
        ${responsavel?.assinaturaBase64 ? `<img src="${responsavel.assinaturaBase64}" class="ass-img" />` : '<div class="ass-img-placeholder"></div>'}
        <div class="ass-line"></div>
        <div class="ass-nome">${escapeHtml(responsavel?.nome || "Responsável pela Escala")}</div>
        <div class="ass-cargo">${escapeHtml(responsavel?.cargo || "Gestor / Coordenador")}</div>
        ${responsavel?.conselho ? `<div class="ass-cons">${escapeHtml(responsavel.conselho)}</div>` : ""}
        ${responsavel?.unidade ? `<div class="ass-unid">${escapeHtml(responsavel.unidade)}</div>` : ""}
        ${/* !responsavel?.assinaturaBase64 ? '<div class="ass-missing">Assinatura não cadastrada</div>' : '' */ ""}
      </div>
      <div class="ass-box">
        ${responsavelTecnico?.assinaturaBase64 ? `<img src="${responsavelTecnico.assinaturaBase64}" class="ass-img" />` : '<div class="ass-img-placeholder"></div>'}
        <div class="ass-line"></div>
        <div class="ass-nome">${escapeHtml(responsavelTecnico?.nome || "Responsável Técnico")}</div>
        <div class="ass-cargo">${escapeHtml(responsavelTecnico?.cargo || "Responsável Técnico")}</div>
        ${responsavelTecnico?.conselho ? `<div class="ass-cons">${escapeHtml(responsavelTecnico.conselho)}</div>` : ""}
        ${responsavelTecnico?.unidade ? `<div class="ass-unid">${escapeHtml(responsavelTecnico.unidade)}</div>` : ""}
        ${/* !responsavelTecnico?.assinaturaBase64 ? '<div class="ass-missing">Assinatura não cadastrada</div>' : '' */ ""}
      </div>
    </div>` : "";

  const obsRodape = opts.incluirObservacoesRodape ? `
    <div class="obs-rodape">
      <p>Escala sujeita a alteração.</p>
      <p>Troca de plantão comunicar à coordenação.</p>
      <p><b>OBS:</b> Qualquer troca de plantão, comunicar à coordenação.</p>
    </div>` : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Escala Mensal Oficial</title>
<style>
  * { box-sizing: border-box; }
  @page { size: A4 landscape; margin: 8mm; }
  html, body { background:#fff; }
  body { font-family: Arial, Helvetica, sans-serif; color:#111; margin: 10mm; font-size: 10px; }

  /* Cabeçalho institucional centralizado */
  .header-oficial { text-align:center; margin-bottom: 6px; }
  .header-oficial .logo { float:left; margin-right: 8px; }
  .header-oficial h1 { font-size: 12px; margin: 0; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; }
  .header-oficial h2 { font-size: 11px; margin: 1px 0; font-weight: 600; text-transform: uppercase; }
  .header-oficial h3 { font-size: 11px; margin: 1px 0; font-weight: 700; text-transform: uppercase; }
  .header-oficial .titulo { font-size: 13px; margin-top: 4px; font-weight: 800; letter-spacing: .5px; }
  .header-oficial .periodo { font-size: 11px; margin-top: 2px; font-weight: 700; }
  .clear { clear: both; }

  /* Bloco título da tabela */
  .tabela-titulo {
    border: 1.2px solid #111; border-bottom: none;
    padding: 4px 8px; display:flex; align-items:center; gap:8px;
    background: #f5f5f5;
  }
  .tabela-titulo .logo-mini { width: 28px; height: 28px; object-fit: contain; }
  .tabela-titulo .center { flex:1; text-align:center; }
  .tabela-titulo .center .t1 { font-size: 11px; font-weight: 800; letter-spacing:.5px; }
  .tabela-titulo .center .t2 { font-size: 10px; font-weight: 700; margin-top: 1px; }

  /* Tabela */
  table.escala { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.escala th, table.escala td {
    border: 0.6px solid #111; padding: 2px 1px; text-align: center; vertical-align: middle;
    font-size: 8.5px; line-height: 1.05;
  }
  table.escala thead th { background: #e8e8e8; font-weight: 700; }
  table.escala th.nome, table.escala td.nome {
    text-align: left; padding-left: 5px; font-size: 9px; min-width: 130px; width: 130px;
    font-weight: 600;
  }
  table.escala td.nome .cons { font-weight: 400; color: #555; font-size: 7.5px; display:block; }
  table.escala th.dia { padding: 1px 0; }
  table.escala th.dia .d { font-weight: 800; font-size: 9px; }
  table.escala th.dia .dw { font-size: 7px; color: #444; }
  table.escala th.fds, table.escala td.fds { background: #f1f1f1; }
  table.escala td.dia { font-weight: 700; font-size: 9px; }
  table.escala td.cancel { color:#b00020; text-decoration: line-through; }
  table.escala td.pend { color:#9a6b00; }
  table.escala th.total, table.escala td.total {
    background:#f1f5f9; font-weight: 800; min-width: 42px; width: 50px; font-size: 9px;
  }
  table.escala td.empty { text-align:center; padding: 14px; color:#777; font-style: italic; }

  /* Legenda */
  .legenda { margin-top: 6px; padding: 4px 6px; border: 0.6px solid #555; font-size: 9px; }
  .legenda b { display:inline-block; min-width: 16px; }
  .legenda .lg-item { display:inline-block; margin-right: 12px; white-space:nowrap; }
  .legenda .lg-title { font-weight: 700; margin-right: 6px; text-transform: uppercase; }

  /* Observações */
  .obs-rodape { margin-top: 6px; font-size: 9px; line-height: 1.3; }
  .obs-rodape p { margin: 1px 0; }

  /* Assinatura lado a lado */
  .ass-wrap { display:flex; justify-content: space-between; margin-top: 24px; gap: 40px; padding: 0 40px; }
  .ass-box { text-align:center; min-width: 280px; flex: 1; display: flex; flex-direction: column; align-items: center; }
  .ass-img { height: 50px; object-fit: contain; margin-bottom: -5px; }
  .ass-img-placeholder { height: 50px; }
  .ass-line { border-top: 1px solid #111; margin-bottom: 3px; width: 100%; }
  .ass-nome { font-size: 10px; font-weight: 700; }
  .ass-cargo, .ass-cons, .ass-unid { font-size: 9px; color:#333; }

  /* Rodapé de emissão (não aparece no papel se não quiser) */
  .doc-footer { margin-top: 10px; font-size: 8px; color:#777; text-align:center; border-top: 0.4px dashed #ccc; padding-top: 3px; }

  /* Toolbar (oculta na impressão) */
  .toolbar { position: sticky; top: 0; background:#fff; padding: 6px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 8px; display:flex; gap:6px; }
  .toolbar button { background:#0e7490; color:#fff; border:none; padding: 6px 12px; border-radius: 4px; cursor:pointer; font-size: 11px; }
  .toolbar button.secondary { background:#fff; color:#111; border:1px solid #cbd5e1; }

  /* Regras de impressão: tira toolbar e qualquer chrome */
  @media print {
    body { margin: 6mm; }
    .no-print, .toolbar { display:none !important; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr, td, th { page-break-inside: avoid; }
    .ass-wrap { page-break-inside: avoid; }
    table.escala { font-size: 8.5px; }
  }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()">🖨️ Imprimir</button>
    <button class="secondary" onclick="window.close()">Fechar</button>
  </div>

  <div class="header-oficial">
    ${opts.incluirLogo ? `<div class="logo">${logoSmsImgHtml(56)}</div>` : ""}
    ${cab.instituicao.prefeitura ? `<h1>${escapeHtml(cab.instituicao.prefeitura)}</h1>` : ""}
    ${cab.instituicao.secretaria ? `<h2>${escapeHtml(cab.instituicao.secretaria)}</h2>` : ""}
    ${cab.instituicao.unidade ? `<h3>${escapeHtml(cab.instituicao.unidade)}</h3>` : ""}
    <div class="titulo">ESCALA DE SERVIÇO</div>
    <div class="periodo">Mês: ${escapeHtml(DIAS_PT_FULL[cab.mes - 1])} &nbsp;&nbsp; Ano: ${cab.ano}</div>
    <div class="clear"></div>
  </div>

  <div class="tabela-titulo">
    ${opts.incluirLogo ? `<div>${logoSmsImgHtml(28)}</div>` : ""}
    <div class="center">
      <div class="t1">ESCALA DE SERVIÇO</div>
      <div class="t2">${escapeHtml(subtitulo)}</div>
    </div>
    <div style="width:28px"></div>
  </div>

  <table class="escala">
    <thead>
      <tr>
        <th class="nome">NOMES</th>
        ${colDiaTh}
        <th class="total">${escapeHtml(totalLabel)}</th>
      </tr>
    </thead>
    <tbody>${linhasTr}</tbody>
  </table>

  <div class="legenda">
    <span class="lg-title">Legenda:</span>
    ${legendaTipos}
  </div>

  ${obsRodape}
  ${respHtml}

  <div class="doc-footer">Documento emitido pelo ${escapeHtml(sistema)} • ${escapeHtml(emissao)}${cab.emitidoPor ? ` • Emitido por: ${escapeHtml(cab.emitidoPor)}` : ""}</div>
</body>
</html>`;
}

export function abrirEscalaMensalOficial(
  cab: MensalCabecalho,
  profs: MensalProfissional[],
  tipos: MensalTipoLegenda[],
  opts: MensalOpts,
  autoPrint = false,
): boolean {
  const w = window.open("", "_blank", "width=1280,height=820");
  if (!w) return false;
  let html = buildHtml(cab, profs, tipos, opts);
  if (autoPrint) {
    html = html.replace("</body>", "<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body>");
  }
  w.document.write(html);
  w.document.close();

  // Registra documento versionado (silencioso)
  import("./registrarDocumento").then(({ registrarDocumentoGerado }) => {
    registrarDocumentoGerado({
      tipo: "escala_mensal",
      titulo: `Escala Mensal Oficial — ${cab.mes}/${cab.ano} ${cab.setor ?? ""}`.trim(),
      conteudoHtml: html,
      dadosGeracao: {
        cabecalho: { mes: cab.mes, ano: cab.ano, setor: cab.setor, profissao: cab.profissaoLabel },
        totalProfissionais: profs.length,
      },
    });
  });

  return true;
}


// ---------------------------------------------------------------
// PDF (jsPDF + autoTable)
// ---------------------------------------------------------------
export async function gerarPdfEscalaMensalOficial(
  cab: MensalCabecalho,
  profs: MensalProfissional[],
  tipos: MensalTipoLegenda[],
  opts: MensalOpts,
  filename: string,
  modo: "save" | "open" = "save"
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const totalDias = diasDoMes(cab.ano, cab.mes);
  const totalLabel = opts.totalLabel || "TOTAL";

  // Margens: 10mm em todos os lados para aproveitar o máximo do espaço
  const margin = 10;

  // ===== Cabeçalho =====
  let y = margin;
  if (opts.incluirLogo) {
    try {
      const logo = await getLogoSmsDataUrl();
      if (logo) {
        doc.addImage(logo, "JPEG", margin, y - 2, 14, 14);
      }
    } catch { /* ignora */ }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0);
  const headerTextX = opts.incluirLogo ? margin + 18 : margin;
  
  if (cab.instituicao.prefeitura) {
    doc.text(cab.instituicao.prefeitura.toUpperCase(), headerTextX, y);
    y += 4;
  }
  doc.setFontSize(9);
  if (cab.instituicao.secretaria) {
    doc.text(cab.instituicao.secretaria.toUpperCase(), headerTextX, y);
    y += 4;
  }
  if (cab.instituicao.unidade) {
    doc.text(cab.instituicao.unidade.toUpperCase(), headerTextX, y);
    y += 4;
  }
  
  // Título: "Escala Mensal Consolidada — [Mês/Ano]"
  y = Math.max(y, margin + 12);
  doc.setFontSize(11);
  const mesLabel = DIAS_PT_FULL[cab.mes - 1];
  doc.text(`Escala Mensal Consolidada — ${mesLabel} / ${cab.ano}`, margin, y);
  y += 5;

  // Linha com: Unidade • Setor • Período • Emissão • Emitido por
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80);
  const emissao = new Date().toLocaleString("pt-BR");
  const infoParts = [
    cab.instituicao.unidade ? `Unidade: ${cab.instituicao.unidade}` : null,
    cab.setor ? `Setor: ${cab.setor}` : null,
    `Período: ${mesLabel}/${cab.ano}`,
    `Emissão: ${emissao}`,
    cab.emitidoPor ? `Emitido por: ${cab.emitidoPor}` : null
  ].filter(Boolean);
  doc.text(infoParts.join("  •  "), margin, y);
  y += 5;

  // ===== Tabela Principal — Formato Horizontal =====
  const headDias = Array.from({ length: totalDias }, (_, i) => {
    const d = i + 1;
    const dow = diaSemana(cab.ano, cab.mes, d);
    return { 
      content: `${d}\n${DIAS_SEM_ABREV[dow]}`, 
      styles: { halign: "center" as const, fontStyle: "bold" as const, fontSize: 6.5 } 
    };
  });

  const head = [[
    { content: "Profissional", styles: { halign: "left" as const, fontStyle: "bold" as const } },
    ...headDias,
    { content: "Total", styles: { halign: "center" as const, fontStyle: "bold" as const } }
  ]];

  const body = profs.map((p) => {
    const nomeCol = {
      content: `${p.nome}\n${p.profissao || ""}`,
      styles: { halign: "left" as const, fontSize: 7 }
    };

    const diaCols = Array.from({ length: totalDias }, (_, i) => {
      const d = i + 1;
      const lista = p.porDia[d] || [];
      if (lista.length === 0) return "—";
      
      const siglas = lista.map((s) => s.sigla).join("/");
      const status = lista[0].status || "";
      
      // Letras abreviadas exatamente como na tela
      // O conteúdo já vem com as siglas corretas (D, N, M, T, Nt, 24, SA, F, !, *)
      return siglas;
    });

    const total = opts.incluirTotalHoras ? `${p.totalHoras}h` : `${p.totalPlantoes}`;
    
    return [nomeCol, ...diaCols, { content: total, styles: { halign: "center" as const, fontStyle: "bold" as const } }];
  });

  // Cálculo de larguras
  const availW = pageW - (margin * 2);
  const nomeW = 40; // Espaço para nome + profissão
  const totalW = 12;
  const diaW = (availW - nomeW - totalW) / totalDias;

  autoTable(doc, {
    head,
    body,
    startY: y,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7,
      cellPadding: 0.8,
      valign: "middle",
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
      textColor: 0,
      overflow: "hidden"
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: 0,
      fontStyle: "bold",
      lineWidth: 0.2
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250] // Zebra (linhas alternadas com fundo levemente cinza)
    },
    columnStyles: {
      0: { cellWidth: nomeW },
      [totalDias + 1]: { cellWidth: totalW }
    },
    didParseCell: (data) => {
      const ci = data.column.index;
      if (ci > 0 && ci <= totalDias) {
        data.cell.styles.cellWidth = diaW;
        data.cell.styles.halign = "center";
        
        // Cores de fundo suaves por tipo de plantão (baseado na sigla)
        if (data.section === "body") {
          const sigla = String(data.cell.raw || "");
          if (sigla.includes("D")) data.cell.styles.fillColor = [224, 242, 254]; // sky-100
          else if (sigla.includes("N")) data.cell.styles.fillColor = [237, 233, 254]; // violet-100
          else if (sigla.includes("M")) data.cell.styles.fillColor = [254, 243, 199]; // amber-100
          else if (sigla.includes("T")) data.cell.styles.fillColor = [255, 237, 213]; // orange-100
          else if (sigla.includes("24")) data.cell.styles.fillColor = [209, 250, 229]; // emerald-100
          else if (sigla.includes("SA")) data.cell.styles.fillColor = [241, 245, 249]; // slate-100
          else if (sigla.includes("F")) data.cell.styles.fillColor = [255, 247, 237]; // orange-50
          else if (sigla === "!") data.cell.styles.fillColor = [254, 249, 195]; // yellow-100
          else if (sigla === "*") data.cell.styles.fillColor = [254, 226, 226]; // red-100
        }
      }
    }
  });

  let finalY = (doc as any).lastAutoTable?.finalY || (y + 20);

  // ===== Legenda compacta =====
  doc.setFontSize(7);
  doc.setTextColor(100);
  const legendaText = "Legenda: D=Diurno 07-19h  |  N=Noturno 18-07h  |  M=Manhã 07-13h  |  T=Tarde 13-19h  |  Nt=Noturno 19-01h  |  24=24h  |  SA=Sobreaviso  |  F=Folga  |  !=Pendente  |  *=Cancelado";
  doc.text(legendaText, margin, finalY + 5);
  finalY += 8;

  // ===== Totais =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0);
  const totalPlantoes = profs.reduce((acc, p) => acc + p.totalPlantoes, 0);
  const totalHorasGeral = profs.reduce((acc, p) => acc + p.totalHoras, 0);
  doc.text(`Total de plantões: ${totalPlantoes}    Total de horas: ${totalHorasGeral}h`, margin, finalY + 5);
  finalY += 15;

  // ===== Rodapé — Carimbo e Assinatura =====
  if (opts.incluirAssinatura) {
    const r1 = opts.responsavel;
    const r2 = opts.responsavelTecnico;
    const assY = Math.max(finalY + 15, pageH - 35);
    const lineLen = 70;
    const gap = (availW - (lineLen * 2)) / 3;

    // Bloco Esquerdo — Gestor Master / Coordenador
    const xL = margin + gap + lineLen / 2;
    const startXL = margin + gap;
    
    if (r1?.assinaturaBase64) {
      try {
        doc.addImage(r1.assinaturaBase64, "PNG", startXL + 5, assY - 12, lineLen - 10, 10);
      } catch { /* ignora */ }
    }
    doc.setLineWidth(0.2);
    doc.line(startXL, assY, startXL + lineLen, assY);
    doc.setFontSize(8);
    doc.text(r1?.nome || "Gestor / Coordenador", xL, assY + 4, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(r1?.cargo || "Coordenação", xL, assY + 7.5, { align: "center" });
    if (r1?.conselho && r1.conselho !== "Não informado") {
      doc.text(r1.conselho, xL, assY + 10.5, { align: "center" });
    }
    if (r1?.unidade) {
      doc.text(r1.unidade, xL, assY + 13.5, { align: "center" });
    }

    // Bloco Direito — Responsável Técnico
    const startXR = pageW - margin - gap - lineLen;
    const xR = startXR + lineLen / 2;
    
    if (r2?.assinaturaBase64) {
      try {
        doc.addImage(r2.assinaturaBase64, "PNG", startXR + 5, assY - 12, lineLen - 10, 10);
      } catch { /* ignora */ }
    }
    doc.line(startXR, assY, startXR + lineLen, assY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(r2?.nome || "Responsável Técnico", xR, assY + 4, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Responsável Técnico", xR, assY + 7.5, { align: "center" });
    if (r2?.conselho && r2.conselho !== "Não informado") {
      doc.text(r2.conselho, xR, assY + 10.5, { align: "center" });
    }
  }

  // ===== Rodapé Inferior =====
  doc.setFontSize(7);
  doc.setTextColor(150);
  const footerText = `Documento emitido pelo ${cab.sistema || "GestorPlantão SMS Oriximiná"} • ${emissao}`;
  doc.text(footerText, pageW / 2, pageH - 5, { align: "center" });

  if (modo === "save") {
    doc.save(`${filename}.pdf`);
  } else {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }
}
