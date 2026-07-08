// Impressão profissional genérica para a página de Relatórios.
// Cabeçalho institucional padronizado. Rodapé com totalizadores e mensagem oficial.

import { logoSmsImgHtml } from "./logoSMS";
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

export function buildRelatorioHtml(
  cab: RelatorioPrintCab,
  columns: string[],
  rows: string[][],
  chartImages: string[] = []
): string {
  const sistema = cab.sistema || "GestorPlantão SMS Oriximiná";
  const emissao = new Date().toLocaleString("pt-BR");
  const filtrosStr = cab.filtros.filter(f => f.value && f.value !== '—').length
    ? cab.filtros
        .filter(f => f.value && f.value !== '—')
        .map(f => `<span><b>${escapeHtml(f.label)}:</b> ${escapeHtml(f.value)}</span>`)
        .join(" | ")
    : `Nenhum filtro aplicado`;

  const trs = rows.length
    ? rows
        .map(
          r => `<tr>${r.map(c => `<td>${escapeHtml(String(c ?? ""))}</td>`).join("")}</tr>`
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
  
  .filtros-area { background: #f8fafc; padding: 10px 15px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 10pt; color: #475569; margin-bottom: 20px; }
  .totais-resumo { margin: 20px 0; font-size: 11pt; font-weight: bold; color: #0e7490; border-top: 2px solid #eee; padding-top: 10px; }
  .charts-area { margin: 20px 0; page-break-inside: avoid; }
  .charts-area h3 { font-size: 11pt; color: #0e7490; margin: 0 0 10px; text-transform: uppercase; letter-spacing: .5px; }
  .charts-area img { max-width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; background: #fff; }
  
  table th { text-transform: uppercase; font-size: 9pt; background: #e2e8f0; }
  table td { font-size: 9pt; }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()">🖨️ Imprimir Relatório</button>
    <button class="secondary" onclick="window.close()">Fechar</button>
  </div>

  ${headerHtml}

  <div class="filtros-area">
    <strong>Filtros aplicados:</strong> ${filtrosStr}
  </div>

  ${chartImages.length ? `<div class="charts-area"><h3>Análise gráfica</h3>${chartImages.map(src => `<img src="${src}" alt="Gráfico do relatório" />`).join("")}</div>` : ""}

  <table>
    <thead><tr>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>
    <tbody>${trs}</tbody>
  </table>

  <div class="totais-resumo">
    <span>Total de registros: ${cab.totalRegistros}</span>
    ${cab.totalHoras != null ? `<span style="margin-left: 30px">Carga horária total: ${Number(cab.totalHoras).toFixed(1)}h</span>` : ""}
  </div>

  ${assinaturasHtml}

  ${footerHtml}
</body>
</html>`;
}



export function abrirVisualizacaoRelatorio(
  cab: RelatorioPrintCab,
  columns: string[],
  rows: string[][],
  autoPrint = false
): boolean {
  const w = window.open("", "_blank", "width=1100,height=780");
  if (!w) return false;
  let html = buildRelatorioHtml(cab, columns, rows);
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
