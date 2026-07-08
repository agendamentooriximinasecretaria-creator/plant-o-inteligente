// Impressão profissional genérica para a página de Relatórios.
// Cabeçalho institucional padronizado. Rodapé com totalizadores e mensagem oficial.

import type { StampData } from "./pdfStampUtils";
import { DOCUMENT_CSS_BASE } from "./documentStyle";
import { buildHeaderHtml, buildSignatureHtml, buildFooterHtml } from "./documentTemplates";

export interface RelatorioFiltroAplicado {
  label: string;
  value: string;
}

export interface RelatorioPrintCab {
  instituicao: { nome: string; cnpj?: string; endereco?: string };
  nomeRelatorio: string;
  periodoLabel?: string;
  filtros: RelatorioFiltroAplicado[];
  emitidoPor?: string;
  totalRegistros: number;
  totalHoras?: number | null;
  incluirAssinatura?: boolean;
  responsavel?: StampData;
  responsavelTecnico?: StampData;
  sistema?: string;
}

const escapeHtml = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isWideReport = (columns: string[]) => columns.length > 8 || columns.some(c => /^\d{1,2}$/.test(c));

const normalizeColumn = (column: string) => column
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

const columnClass = (column: string) => {
  const n = normalizeColumn(column);
  if (/^\d{1,2}$/.test(column) || /^(tipo|carga|status|tempo)$/.test(n)) return "col-compact";
  if (/motivo|observacao|solicitante|destinatario|unidade|setor|profissional/.test(n)) return "col-long";
  return "col-text";
};

const buildColGroup = (columns: string[]) => {
  const normalized = columns.map(normalizeColumn).join("|");
  const specificWidths = normalized === "protocolo|tipo|solicitante / destinatario|unidade / setor|plantao|motivo|status|criacao / resolucao|tempo|observacao"
    ? [7, 5, 17, 13, 13, 15, 7, 13, 5, 15]
    : null;

  if (specificWidths) {
    const total = specificWidths.reduce((a, b) => a + b, 0);
    return `<colgroup>${specificWidths.map(w => `<col style="width:${(w / total * 100).toFixed(2)}%" />`).join("")}</colgroup>`;
  }

  if (columns.some(c => /^\d{1,2}$/.test(c))) {
    const fixed = columns.map(column => {
      const n = normalizeColumn(column);
      if (n === "profissional") return 16;
      if (n === "setor") return 14;
      if (n === "total") return 7;
      return 0;
    });
    const used = fixed.reduce((a, b) => a + b, 0);
    const dayCount = columns.filter(c => /^\d{1,2}$/.test(c)).length || 1;
    const dayW = Math.max(1.7, (100 - used) / dayCount);
    return `<colgroup>${columns.map((column, index) => {
      const width = fixed[index] || (/^\d{1,2}$/.test(column) ? dayW : undefined);
      return width ? `<col style="width:${width.toFixed(2)}%" />` : `<col />`;
    }).join("")}</colgroup>`;
  }

  return "";
};

export function buildRelatorioHtml(
  cab: RelatorioPrintCab,
  columns: string[],
  rows: string[][],
  chartImages: string[] = []
): string {
  const sistema = cab.sistema || "GestorPlantão SMS Oriximiná";
  const emissao = new Date().toLocaleString("pt-BR");
  const wide = isWideReport(columns);
  const filtrosStr = cab.filtros.filter(f => f.value && f.value !== '—').length
    ? cab.filtros
        .filter(f => f.value && f.value !== '—')
        .map(f => `<span><b>${escapeHtml(f.label)}:</b> ${escapeHtml(f.value)}</span>`)
        .join(" | ")
    : `Nenhum filtro aplicado`;

  const trs = rows.length
    ? rows
        .map(
          r => `<tr>${r.map((c, i) => `<td class="${columnClass(columns[i] || "")}">${escapeHtml(String(c ?? ""))}</td>`).join("")}</tr>`
        )
        .join("")
    : `<tr><td colspan="${columns.length}" style="text-align:center;color:#777;padding:20px">Nenhum registro encontrado.</td></tr>`;

  const headerHtml = buildHeaderHtml({
    title: cab.nomeRelatorio,
    period: cab.periodoLabel,
    emission: emissao,
    issuer: cab.emitidoPor
  });

  const assinaturasHtml = cab.incluirAssinatura ? buildSignatureHtml({
    responsavel: cab.responsavel,
    responsavelTecnico: cab.responsavelTecnico
  }) : "";

  const footerHtml = buildFooterHtml(sistema);
  const colGroup = buildColGroup(columns);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(cab.nomeRelatorio)}</title>
<style>
  ${DOCUMENT_CSS_BASE}
  .toolbar { position: sticky; top: 0; background: #fff; padding: 12px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px; display:flex; gap:10px; }
  .toolbar button { background:#0e7490; color:#fff; border:none; padding: 8px 16px; border-radius: 6px; cursor:pointer; font-size: 13px; font-weight: 600; }
  .toolbar button.secondary { background:#fff; color:#111; border:1px solid #cbd5e1; }
  
  .filtros-area { background: #f8fafc; padding: 10px 15px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 10pt; color: #475569; margin-bottom: 14px; }
  .totais-resumo { margin: 16px 0; font-size: 11pt; font-weight: bold; color: #0e7490; border-top: 2px solid #eee; padding-top: 10px; }
  .charts-area { margin: 12px 0 16px; }
  .charts-area h3 { font-size: 11pt; color: #0e7490; margin: 0 0 10px; text-transform: uppercase; letter-spacing: .5px; }
  .charts-area figure { margin: 0 0 10px; page-break-inside: avoid; break-inside: avoid; text-align: center; }
  .charts-area img { display: block; max-width: 100%; max-height: 170mm; width: auto; height: auto; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; background: #fff; object-fit: contain; }
  .relatorio-wide .charts-area img { max-height: 145mm; }
  
  table { table-layout: fixed; width: 100%; }
  table th { text-transform: uppercase; font-size: 8.5pt; background: #e2e8f0; word-wrap: break-word; overflow-wrap: anywhere; }
  table td { font-size: 8.5pt; word-wrap: break-word; overflow-wrap: anywhere; white-space: normal; }
  .relatorio-wide table th { font-size: 6.4pt; }
  .relatorio-wide table td { font-size: 6.4pt; }
</style>
</head>
<body class="${wide ? "relatorio-wide" : ""}">
  <div class="toolbar no-print">
    <button onclick="window.print()">🖨️ Imprimir Relatório</button>
    <button class="secondary" onclick="window.close()">Fechar</button>
  </div>

  <section data-pdf-section="cabecalho">${headerHtml}</section>

  <section class="filtros-area" data-pdf-section="filtros">
    <strong>Filtros aplicados:</strong> ${filtrosStr}
  </section>

  ${chartImages.length ? `<section class="charts-area" data-pdf-section="graficos"><h3>Análise gráfica</h3>${chartImages.map((src, index) => `<figure data-pdf-section="grafico-${index + 1}"><img src="${src}" alt="Gráfico do relatório" /></figure>`).join("")}</section>` : ""}

  <section data-pdf-section="tabela">
  <table>
    ${colGroup}
    <thead><tr>${columns.map(c => `<th class="${columnClass(c)}">${escapeHtml(c)}</th>`).join("")}</tr></thead>
    <tbody>${trs}</tbody>
  </table>
  </section>

  <section class="totais-resumo" data-pdf-section="totais">
    <span>Total de registros: ${cab.totalRegistros}</span>
    ${cab.totalHoras != null ? `<span style="margin-left: 30px">Carga horária total: ${Number(cab.totalHoras).toFixed(1)}h</span>` : ""}
  </section>

  ${assinaturasHtml ? `<section data-pdf-section="assinaturas">${assinaturasHtml}</section>` : ""}

  <section data-pdf-section="rodape">${footerHtml}</section>
</body>
</html>`;
}



export function abrirVisualizacaoRelatorio(
  cab: RelatorioPrintCab,
  columns: string[],
  rows: string[][],
  autoPrint = false,
  chartImages: string[] = []
): boolean {
  const w = window.open("", "_blank", "width=1100,height=780");
  if (!w) return false;
  let html = buildRelatorioHtml(cab, columns, rows, chartImages);
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
