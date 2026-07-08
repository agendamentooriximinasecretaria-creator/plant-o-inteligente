// Documento executivo consolidado — "Relatório Geral".
// Reaproveita cabeçalho/rodapé/assinatura e CSS base institucional.

import { DOCUMENT_CSS_BASE } from "./documentStyle";
import { buildHeaderHtml, buildSignatureHtml, buildFooterHtml } from "./documentTemplates";
import type { StampData } from "./pdfStampUtils";
import type { RelatorioGeralData } from "./parecerAutomatico";

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const bar = (value: number, max: number) => {
  const w = max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  return `<div class="bar-track"><div class="bar-fill" style="width:${w.toFixed(1)}%"></div></div>`;
};

export interface RelatorioGeralPrintOptions {
  data: RelatorioGeralData;
  emitidoPor?: string;
  incluirAssinatura?: boolean;
  responsavel?: StampData;
  responsavelTecnico?: StampData;
  autoPrint?: boolean;
  sistema?: string;
}

export function buildRelatorioGeralHtml(opts: RelatorioGeralPrintOptions): string {
  const { data, emitidoPor, incluirAssinatura, responsavel, responsavelTecnico } = opts;
  const sistema = opts.sistema || "GestorPlantão SMS Oriximiná";
  const emissao = new Date().toLocaleString("pt-BR");

  const headerHtml = buildHeaderHtml({
    title: "Relatório Geral Executivo",
    period: data.periodo.label,
    emission: emissao,
    issuer: emitidoPor,
  });

  const kpisHtml = data.kpisPrincipais
    .map(k => {
      const var_ =
        typeof k.variacao === "number" && isFinite(k.variacao)
          ? `<div class="kpi-var ${k.variacao >= 0 ? "up" : "down"}">${k.variacao >= 0 ? "+" : ""}${k.variacao.toFixed(1)}% vs anterior</div>`
          : "";
      return `<div class="kpi ${k.alerta ? "kpi-alert" : ""}">
        <div class="kpi-label">${esc(k.label)}</div>
        <div class="kpi-value">${esc(k.valor)}</div>
        ${var_}
      </div>`;
    })
    .join("");

  const maxEvolH = Math.max(1, ...data.evolucaoMensal.map(e => e.horas));
  const evolucaoHtml = data.evolucaoMensal
    .map(
      e => `<tr>
        <td class="td-mes">${esc(e.mes)}</td>
        <td>${bar(e.horas, maxEvolH)}</td>
        <td class="td-num">${e.horas.toFixed(0)}h</td>
        <td class="td-num">${e.plantoes}</td>
        <td class="td-num">${e.faltas}</td>
      </tr>`
    )
    .join("");

  const maxSetorH = Math.max(1, ...data.coberturaSetor.map(s => s.horas));
  const coberturaHtml = data.coberturaSetor
    .slice(0, 10)
    .map(
      s => `<tr>
        <td>${esc(s.nome)}</td>
        <td>${bar(s.horas, maxSetorH)}</td>
        <td class="td-num">${s.horas.toFixed(0)}h</td>
        <td class="td-num">${s.count}</td>
      </tr>`
    )
    .join("");

  const absHtml = data.absenteismoTop
    .slice(0, 8)
    .map(
      p => `<tr>
        <td>${esc(p.nome)}</td>
        <td class="td-num">${p.total}</td>
        <td class="td-num">${p.faltas}</td>
        <td class="td-num ${p.taxa > 5 ? "text-danger" : ""}">${p.taxa.toFixed(1)}%</td>
      </tr>`
    )
    .join("");

  const parecer = data.parecer;
  const listOr = (items: string[], empty: string, cls: string) =>
    items.length
      ? `<ul class="${cls}">${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`
      : `<p class="empty">${esc(empty)}</p>`;

  const numberedList = (items: string[]) =>
    items.length
      ? `<ol class="reco-list">${items.map(i => `<li>${esc(i)}</li>`).join("")}</ol>`
      : `<p class="empty">Nenhuma recomendação para este período.</p>`;

  const assinaturasHtml = incluirAssinatura
    ? buildSignatureHtml({ responsavel, responsavelTecnico })
    : "";

  const footerHtml = buildFooterHtml(sistema);
  const custoHtml =
    typeof data.custoTotal === "number"
      ? `<section class="block" data-pdf-section="custo">
          <h3>Custo total estimado</h3>
          <p class="custo-valor">${data.custoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
        </section>`
      : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatório Geral Executivo — ${esc(data.periodo.label)}</title>
<style>
  ${DOCUMENT_CSS_BASE}
  .toolbar { position: sticky; top: 0; background:#fff; padding:12px 0; border-bottom:1px solid #e5e7eb; margin-bottom:16px; display:flex; gap:10px; }
  .toolbar button { background:#0e7490; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600; }
  .toolbar button.secondary { background:#fff; color:#111; border:1px solid #cbd5e1; }

  .resumo-executivo { background:#f0f9ff; border-left:4px solid #0e7490; padding:12px 16px; border-radius:6px; margin:16px 0; font-size:11pt; line-height:1.6; }
  .resumo-executivo h3 { margin:0 0 6px; font-size:10pt; color:#0e7490; text-transform:uppercase; letter-spacing:.5px; }

  .kpi-grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin:12px 0; }
  .kpi { border:1px solid #e2e8f0; border-radius:8px; padding:10px; background:#fff; page-break-inside:avoid; }
  .kpi-alert { border-color:#f59e0b; background:#fffbeb; }
  .kpi-label { font-size:8pt; text-transform:uppercase; color:#64748b; font-weight:600; }
  .kpi-value { font-size:15pt; font-weight:800; color:#0f172a; margin-top:2px; }
  .kpi-var { font-size:8.5pt; margin-top:2px; font-weight:600; }
  .kpi-var.up { color:#059669; }
  .kpi-var.down { color:#dc2626; }

  .block { margin:16px 0; page-break-inside:avoid; }
  .block h3 { font-size:11pt; color:#0e7490; text-transform:uppercase; letter-spacing:.5px; border-bottom:1px solid #e2e8f0; padding-bottom:4px; margin:0 0 8px; }

  .atencao-list li { color:#7c2d12; margin-bottom:4px; }
  .positivo-list li { color:#065f46; margin-bottom:4px; }
  .reco-list li { margin-bottom:6px; }
  .empty { color:#94a3b8; font-style:italic; font-size:10pt; }

  .bar-track { background:#e2e8f0; border-radius:4px; height:10px; width:100%; overflow:hidden; }
  .bar-fill { background:linear-gradient(90deg,#0e7490,#2b9a8f); height:100%; border-radius:4px; }
  .td-num { text-align:right; font-variant-numeric:tabular-nums; }
  .td-mes { font-weight:600; text-transform:capitalize; }
  .text-danger { color:#dc2626; font-weight:700; }

  .trocas-grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; }
  .trocas-grid .kpi-value { font-size:14pt; }

  .custo-valor { font-size:18pt; font-weight:800; color:#0e7490; margin:6px 0; }

  @media print {
    .no-print { display:none !important; }
    .kpi-grid { grid-template-columns:repeat(4, 1fr); }
  }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()">🖨️ Imprimir</button>
    <button class="secondary" onclick="window.close()">Fechar</button>
  </div>

  <section data-pdf-section="cabecalho">${headerHtml}</section>

  <section class="resumo-executivo" data-pdf-section="resumo">
    <h3>Resumo Executivo</h3>
    <p>${esc(parecer.resumoExecutivo)}</p>
  </section>

  <section class="block" data-pdf-section="kpis">
    <h3>Indicadores principais</h3>
    <div class="kpi-grid">${kpisHtml}</div>
  </section>

  <section class="block" data-pdf-section="evolucao">
    <h3>Evolução mensal (últimos 6 meses)</h3>
    <table>
      <colgroup><col style="width:14%"/><col style="width:44%"/><col style="width:14%"/><col style="width:14%"/><col style="width:14%"/></colgroup>
      <thead><tr><th>Mês</th><th>Horas realizadas</th><th>Horas</th><th>Plantões</th><th>Faltas</th></tr></thead>
      <tbody>${evolucaoHtml || `<tr><td colspan="5" class="empty" style="text-align:center">Sem dados no período.</td></tr>`}</tbody>
    </table>
  </section>

  <section class="block" data-pdf-section="atencao">
    <h3>Pontos de atenção</h3>
    ${listOr(parecer.pontosAtencao, "Nenhum ponto crítico identificado neste período.", "atencao-list")}
  </section>

  <section class="block" data-pdf-section="positivos">
    <h3>Pontos positivos</h3>
    ${listOr(parecer.pontosPositivos, "Sem destaques positivos neste período.", "positivo-list")}
  </section>

  <section class="block" data-pdf-section="recomendacoes">
    <h3>Recomendações</h3>
    ${numberedList(parecer.recomendacoes)}
  </section>

  <section class="block" data-pdf-section="setores">
    <h3>Cobertura por setor</h3>
    <table>
      <colgroup><col style="width:30%"/><col style="width:40%"/><col style="width:15%"/><col style="width:15%"/></colgroup>
      <thead><tr><th>Setor</th><th>Horas totais</th><th>Horas</th><th>Plantões</th></tr></thead>
      <tbody>${coberturaHtml || `<tr><td colspan="4" class="empty" style="text-align:center">Sem dados de setores.</td></tr>`}</tbody>
    </table>
  </section>

  <section class="block" data-pdf-section="absenteismo">
    <h3>Top absenteísmo</h3>
    <table>
      <colgroup><col style="width:50%"/><col style="width:17%"/><col style="width:16%"/><col style="width:17%"/></colgroup>
      <thead><tr><th>Profissional</th><th>Plantões</th><th>Faltas</th><th>Taxa</th></tr></thead>
      <tbody>${absHtml || `<tr><td colspan="4" class="empty" style="text-align:center">Sem faltas registradas.</td></tr>`}</tbody>
    </table>
  </section>

  <section class="block" data-pdf-section="trocas">
    <h3>Resumo de trocas</h3>
    <div class="trocas-grid">
      <div class="kpi"><div class="kpi-label">Total</div><div class="kpi-value">${data.trocasResumo.total}</div></div>
      <div class="kpi"><div class="kpi-label">Taxa aprovação</div><div class="kpi-value">${data.trocasResumo.taxaAprov.toFixed(1)}%</div></div>
      <div class="kpi ${data.trocasResumo.pendentes > 5 ? "kpi-alert" : ""}"><div class="kpi-label">Pendentes</div><div class="kpi-value">${data.trocasResumo.pendentes}</div></div>
      <div class="kpi"><div class="kpi-label">Tempo médio</div><div class="kpi-value">${data.trocasResumo.tempoMedioH.toFixed(1)}h</div></div>
    </div>
  </section>

  ${custoHtml}

  ${assinaturasHtml ? `<section data-pdf-section="assinaturas">${assinaturasHtml}</section>` : ""}

  <section data-pdf-section="rodape">${footerHtml}</section>
</body>
</html>`;
}

export function abrirRelatorioGeral(opts: RelatorioGeralPrintOptions): boolean {
  const w = window.open("", "_blank", "width=1100,height=780");
  if (!w) return false;
  let html = buildRelatorioGeralHtml(opts);
  if (opts.autoPrint) {
    html = html.replace(
      "</body>",
      "<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body>"
    );
  }
  w.document.write(html);
  w.document.close();
  return true;
}
