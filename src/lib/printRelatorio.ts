// Impressão profissional genérica para a página de Relatórios.
// Cabeçalho com logo SMS, CNPJ, instituição, filtros aplicados, emissão e usuário.
// Rodapé com totalizadores e mensagem oficial. Sem expor dados sensíveis.

import { logoSmsImgHtml } from "./logoSMS";
import type { StampData } from "./pdfStampUtils";

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
  rows: string[][]
): string {
  const sistema = cab.sistema || "GestorPlantão SMS Oriximiná";
  const emissao = new Date().toLocaleString("pt-BR");
  const filtros = cab.filtros.filter(f => f.value && f.value !== '—').length
    ? cab.filtros
        .filter(f => f.value && f.value !== '—')
        .map(f => `<span><b>${escapeHtml(f.label)}:</b> ${escapeHtml(f.value)}</span>`)
        .join("")
    : `<span style="color:#777">Nenhum filtro aplicado</span>`;

  const trs = rows.length
    ? rows
        .map(
          r => `<tr>${r.map(c => `<td>${escapeHtml(String(c ?? ""))}</td>`).join("")}</tr>`
        )
        .join("")
    : `<tr><td colspan="${columns.length}" style="text-align:center;color:#777;padding:14px">Nenhum registro encontrado.</td></tr>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(cab.nomeRelatorio)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 22px; }
  .header { border-bottom: 2px solid #0e7490; padding-bottom: 10px; margin-bottom: 12px; display:flex; align-items:center; gap:14px; }
  .header .brand { flex: 1; }
  .header h1 { font-size: 16px; margin: 0; color: #0e7490; }
  .header h2 { font-size: 13px; margin: 2px 0 0; color: #111; font-weight: 600; }
  .meta { font-size: 11px; color: #444; margin-top: 6px; }
  .meta span { display: inline-block; margin-right: 14px; }
  .info { font-size: 11px; color: #333; margin: 8px 0 0; display:grid; grid-template-columns: repeat(2, 1fr); gap: 2px 14px; }
  .filtros { margin-top: 6px; font-size: 11px; color: #333; }
  .filtros span { display:inline-block; margin-right: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 10.5px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; color: #0f172a; font-weight: 700; font-size: 10.5px; }
  tr:nth-child(even) td { background: #fafafa; }
  .totais { margin-top: 14px; font-size: 11px; display:flex; gap:24px; flex-wrap: wrap; }
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
      ${
        cab.instituicao.cnpj || cab.instituicao.endereco
          ? `<div class="meta">${cab.instituicao.cnpj ? `<span>CNPJ: ${escapeHtml(cab.instituicao.cnpj)}</span>` : ""}${cab.instituicao.endereco ? `<span>${escapeHtml(cab.instituicao.endereco)}</span>` : ""}</div>`
          : ""
      }
      <h2>${escapeHtml(cab.nomeRelatorio)}</h2>
      <div class="info">
        ${cab.periodoLabel ? `<div><b>Período:</b> ${escapeHtml(cab.periodoLabel)}</div>` : ""}
        <div><b>Emissão:</b> ${escapeHtml(emissao)}</div>
        ${cab.emitidoPor ? `<div><b>Emitido por:</b> ${escapeHtml(cab.emitidoPor)}</div>` : ""}
        <div><b>Sistema:</b> ${escapeHtml(sistema)}</div>
      </div>
      <div class="filtros"><b>Filtros aplicados:</b> ${filtros}</div>
    </div>
  </div>

  <table>
    <thead><tr>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>
    <tbody>${trs}</tbody>
  </table>

  <div class="totais">
    <div><b>Total de registros:</b> ${cab.totalRegistros}</div>
    ${cab.totalHoras != null ? `<div><b>Total de horas:</b> ${Number(cab.totalHoras).toFixed(1)}h</div>` : ""}
  </div>

  const responsavel = cab.responsavel;
  const responsavelTecnico = cab.responsavelTecnico;

  const assinaturas = cab.incluirAssinatura ? `
    <div class="assinaturas">
      <div class="ass-box">
        ${responsavel?.assinaturaBase64 ? `<img src="${responsavel.assinaturaBase64}" style="height:50px;display:block;margin:0 auto -5px" />` : '<div style="height:50px"></div>'}
        <div class="ass-line"></div>
        <div class="ass-nome"><strong>${escapeHtml(responsavel?.nome || "Gestor / Coordenador")}</strong></div>
        <div class="ass-cargo">${escapeHtml(responsavel?.cargo || "Coordenação")}</div>
        ${responsavel?.conselho ? `<div class="ass-cons">${escapeHtml(responsavel.conselho)}</div>` : ""}
        ${responsavel?.unidade ? `<div class="ass-unid">${escapeHtml(responsavel.unidade)}</div>` : ""}
        ${!responsavel?.assinaturaBase64 ? '<div class="ass-missing">Assinatura não cadastrada</div>' : ''}
      </div>
      <div class="ass-box">
        ${responsavelTecnico?.assinaturaBase64 ? `<img src="${responsavelTecnico.assinaturaBase64}" style="height:50px;display:block;margin:0 auto -5px" />` : '<div style="height:50px"></div>'}
        <div class="ass-line"></div>
        <div class="ass-nome"><strong>${escapeHtml(responsavelTecnico?.nome || "Responsável Técnico")}</strong></div>
        <div class="ass-cargo">${escapeHtml(responsavelTecnico?.cargo || "Responsável Técnico")}</div>
        ${responsavelTecnico?.conselho ? `<div class="ass-cons">${escapeHtml(responsavelTecnico.conselho)}</div>` : ""}
        ${responsavelTecnico?.unidade ? `<div class="ass-unid">${escapeHtml(responsavelTecnico.unidade)}</div>` : ""}
        ${!responsavelTecnico?.assinaturaBase64 ? '<div class="ass-missing">Assinatura não cadastrada</div>' : ''}
      </div>
    </div>` : "";

  <div class="footer">Documento emitido pelo ${escapeHtml(sistema)} • ${escapeHtml(emissao)}</div>
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
