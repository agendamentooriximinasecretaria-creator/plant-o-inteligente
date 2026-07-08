// Documento executivo consolidado — "Relatório Geral" organizado por categoria.

import { DOCUMENT_CSS_BASE } from "./documentStyle";
import { buildHeaderHtml, buildSignatureHtml, buildFooterHtml } from "./documentTemplates";
import type { StampData } from "./pdfStampUtils";
import type { RelatorioGeralData } from "./parecerAutomatico";

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const bar = (value: number, max: number) => {
  const w = max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  return `<div class="bar-track"><div class="bar-fill" style="width:${w.toFixed(1)}%"></div></div>`;
};

const table = (
  cols: { label: string; width?: string; align?: "left" | "right" | "center" }[],
  rowsHtml: string,
  emptyMsg = "Sem dados no período."
) => `<table>
  <colgroup>${cols.map(c => `<col style="width:${c.width || "auto"}"/>`).join("")}</colgroup>
  <thead><tr>${cols.map(c => `<th style="text-align:${c.align || "left"}">${esc(c.label)}</th>`).join("")}</tr></thead>
  <tbody>${rowsHtml || `<tr><td colspan="${cols.length}" class="empty" style="text-align:center">${esc(emptyMsg)}</td></tr>`}</tbody>
</table>`;

const category = (num: number, title: string, subtitle: string, inner: string) => `
  <section class="category" data-pdf-section="cat-${num}">
    <div class="cat-header"><span class="cat-num">${num}</span><div><h2>${esc(title)}</h2><span class="cat-sub">${esc(subtitle)}</span></div></div>
    ${inner}
  </section>`;

const block = (title: string, inner: string) => `
  <div class="block">
    <h3>${esc(title)}</h3>
    ${inner}
  </div>`;

const kv = (items: { label: string; valor: string | number; alerta?: boolean }[]) =>
  `<div class="kv-grid">${items.map(i => `<div class="kv ${i.alerta ? "kv-alert" : ""}">
    <div class="kv-label">${esc(i.label)}</div>
    <div class="kv-value">${esc(i.valor)}</div>
  </div>`).join("")}</div>`;

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

  const kpisHtml = data.kpisPrincipais.map(k => {
    const var_ = typeof k.variacao === "number" && isFinite(k.variacao)
      ? `<div class="kpi-var ${k.variacao >= 0 ? "up" : "down"}">${k.variacao >= 0 ? "+" : ""}${k.variacao.toFixed(1)}% vs anterior</div>`
      : "";
    return `<div class="kpi ${k.alerta ? "kpi-alert" : ""}">
      <div class="kpi-label">${esc(k.label)}</div>
      <div class="kpi-value">${esc(k.valor)}</div>${var_}
    </div>`;
  }).join("");

  const parecer = data.parecer;
  const listOr = (items: string[], empty: string, cls: string) =>
    items.length
      ? `<ul class="${cls}">${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`
      : `<p class="empty">${esc(empty)}</p>`;
  const numberedList = (items: string[]) =>
    items.length
      ? `<ol class="reco-list">${items.map(i => `<li>${esc(i)}</li>`).join("")}</ol>`
      : `<p class="empty">Nenhuma recomendação para este período.</p>`;

  // ===== 1. CADASTROS =====
  const cad = data.cadastros;
  const cadastrosHtml = category(1, "Cadastros", "Base institucional de profissionais, unidades e setores",
    kv([
      { label: "Profissionais (total)", valor: cad.totalProfissionais },
      { label: "Ativos", valor: cad.ativos },
      { label: "Inativos", valor: cad.inativos, alerta: cad.inativos > 0 && cad.inativos / Math.max(1, cad.totalProfissionais) > 0.2 },
      { label: "Unidades", valor: cad.totalUnidades },
      { label: "Setores", valor: cad.totalSetores },
    ]) +
    block("Distribuição por profissão",
      table(
        [{ label: "Profissão", width: "70%" }, { label: "Quantidade", width: "30%", align: "right" }],
        cad.porProfissao.map(p => `<tr><td>${esc(p.nome)}</td><td class="td-num">${p.count}</td></tr>`).join("")
      )
    ) +
    block("Distribuição por status cadastral",
      table(
        [{ label: "Status", width: "70%" }, { label: "Quantidade", width: "30%", align: "right" }],
        cad.porStatus.map(p => `<tr><td>${esc(p.nome)}</td><td class="td-num">${p.count}</td></tr>`).join("")
      )
    ) +
    block("Profissionais por unidade",
      table(
        [{ label: "Unidade", width: "70%" }, { label: "Profissionais", width: "30%", align: "right" }],
        cad.porUnidade.map(p => `<tr><td>${esc(p.nome)}</td><td class="td-num">${p.count}</td></tr>`).join("")
      )
    ) +
    block("Profissionais por setor",
      table(
        [{ label: "Setor", width: "70%" }, { label: "Profissionais", width: "30%", align: "right" }],
        cad.porSetor.map(p => `<tr><td>${esc(p.nome)}</td><td class="td-num">${p.count}</td></tr>`).join("")
      )
    ) +
    block("Cadastro nominal completo de profissionais",
      table(
        [
          { label: "Profissional", width: "20%" },
          { label: "Profissão", width: "13%" },
          { label: "Conselho", width: "12%" },
          { label: "Especialidade", width: "13%" },
          { label: "Unidade", width: "14%" },
          { label: "Setor", width: "14%" },
          { label: "Contato", width: "10%" },
          { label: "Status", width: "4%" },
        ],
        cad.profissionais.map(p => `<tr>
          <td>${esc(p.nome)}</td>
          <td>${esc(p.profissao)}</td>
          <td>${esc(p.conselho)}</td>
          <td>${esc(p.especialidade)}</td>
          <td>${esc(p.unidade)}</td>
          <td>${esc(p.setor)}</td>
          <td>${esc(p.telefone || p.email || "—")}</td>
          <td>${esc(p.status)}</td>
        </tr>`).join("")
      )
    )
  );

  // ===== 2. OPERACIONAL =====
  const op = data.operacional;
  const maxCob = Math.max(1, ...op.coberturaSetor.map(s => s.horas));
  const maxTipo = Math.max(1, ...op.porTipoPlantao.map(t => t.horas));
  const operacionalHtml = category(2, "Operacional", "Plantões, cobertura, distribuição por tipo e por setor",
    kv([
      { label: "Plantões (total)", valor: op.totalPlantoes },
      { label: "Horas contabilizadas", valor: `${op.horasContabilizadas.toFixed(0)}h` },
      { label: "Setores com plantão", valor: op.coberturaSetor.length },
      { label: "Tipos de plantão", valor: op.porTipoPlantao.length },
    ]) +
    block("Plantões por status",
      table(
        [{ label: "Status", width: "70%" }, { label: "Quantidade", width: "30%", align: "right" }],
        op.porStatus.map(s => `<tr><td>${esc(s.nome)}</td><td class="td-num">${s.count}</td></tr>`).join("")
      )
    ) +
    block("Distribuição por tipo de plantão",
      table(
        [{ label: "Tipo", width: "30%" }, { label: "Horas", width: "40%" }, { label: "Horas", width: "15%", align: "right" }, { label: "Qtd", width: "15%", align: "right" }],
        op.porTipoPlantao.map(t => `<tr>
          <td>${esc(t.nome)}</td>
          <td>${bar(t.horas, maxTipo)}</td>
          <td class="td-num">${t.horas.toFixed(0)}h</td>
          <td class="td-num">${t.count}</td>
        </tr>`).join("")
      )
    ) +
    block("Plantões por unidade",
      table(
        [{ label: "Unidade", width: "30%" }, { label: "Horas", width: "40%" }, { label: "Horas", width: "15%", align: "right" }, { label: "Plantões", width: "15%", align: "right" }],
        op.porUnidade.map(u => `<tr>
          <td>${esc(u.nome)}</td>
          <td>${bar(u.horas, Math.max(1, ...op.porUnidade.map(x => x.horas)))}</td>
          <td class="td-num">${u.horas.toFixed(0)}h</td>
          <td class="td-num">${u.count}</td>
        </tr>`).join("")
      )
    ) +
    block("Cobertura por setor",
      table(
        [{ label: "Setor", width: "30%" }, { label: "Horas", width: "40%" }, { label: "Horas", width: "15%", align: "right" }, { label: "Plantões", width: "15%", align: "right" }],
        op.coberturaSetor.map(s => `<tr>
          <td>${esc(s.nome)}</td>
          <td>${bar(s.horas, maxCob)}</td>
          <td class="td-num">${s.horas.toFixed(0)}h</td>
          <td class="td-num">${s.count}</td>
        </tr>`).join("")
      )
    ) +
    block("Top setores por carga operacional",
      table(
        [{ label: "Setor", width: "30%" }, { label: "Carga relativa", width: "40%" }, { label: "Horas", width: "15%", align: "right" }, { label: "Plantões", width: "15%", align: "right" }],
        op.topSetores.map(s => `<tr>
          <td>${esc(s.nome)}</td>
          <td>${bar(s.horas, Math.max(1, ...op.topSetores.map(x => x.horas)))}</td>
          <td class="td-num">${s.horas.toFixed(0)}h</td>
          <td class="td-num">${s.plantoes}</td>
        </tr>`).join("")
      )
    ) +
    block("Plantões detalhados do período",
      table(
        [
          { label: "Profissional", width: "18%" },
          { label: "Conselho", width: "10%" },
          { label: "Unidade", width: "13%" },
          { label: "Setor", width: "13%" },
          { label: "Data", width: "10%" },
          { label: "Horário", width: "10%" },
          { label: "Carga", width: "8%", align: "right" },
          { label: "Tipo", width: "9%" },
          { label: "Status", width: "9%" },
        ],
        op.plantoesDetalhados.map(s => `<tr>
          <td>${esc(s.profissional)}</td>
          <td>${esc(s.conselho)}</td>
          <td>${esc(s.unidade)}</td>
          <td>${esc(s.setor)}</td>
          <td>${esc(s.data)}</td>
          <td>${esc(s.horario)}</td>
          <td class="td-num">${esc(s.carga)}</td>
          <td>${esc(s.tipo)}</td>
          <td>${esc(s.status)}</td>
        </tr>`).join("")
      )
    ) +
    block("Escala consolidada — profissional × dias",
      table(
        [
          { label: "Profissional", width: "22%" },
          { label: "Setor", width: "18%" },
          { label: "Dias / marcações", width: "45%" },
          { label: "Total", width: "15%", align: "right" },
        ],
        op.escalaMensal.map(p => `<tr>
          <td>${esc(p.profissional)}</td>
          <td>${esc(p.setor)}</td>
          <td>${op.escalaDias.filter(d => p.dias[d]).map(d => `${esc(d)}: ${esc(p.dias[d])}`).join(" · ") || "—"}</td>
          <td class="td-num">${p.totalHoras.toFixed(1)}h</td>
        </tr>`).join("")
      )
    )
  );

  // ===== 3. QUALIDADE =====
  const q = data.qualidade;
  const qualidadeHtml = category(3, "Qualidade", "Absenteísmo, pontualidade, compliance e cancelamentos",
    kv([
      { label: "Absenteísmo", valor: `${q.taxaAbsenteismo.toFixed(1)}%`, alerta: q.taxaAbsenteismo > 5 },
      { label: "Faltas registradas", valor: q.faltas },
      { label: "Cancelamentos", valor: `${q.taxaCancelamento.toFixed(1)}%`, alerta: q.taxaCancelamento > 5 },
      { label: "Plantões cancelados", valor: q.cancelados },
      { label: "Compliance check-in", valor: `${q.compliance.pctCheckin.toFixed(1)}%`, alerta: q.compliance.pctCheckin < 70 },
      { label: "Compliance check-out", valor: `${q.compliance.pctCheckout.toFixed(1)}%`, alerta: q.compliance.pctCheckout < 70 },
    ]) +
    block("Top absenteísmo por profissional",
      table(
        [{ label: "Profissional", width: "50%" }, { label: "Plantões", width: "17%", align: "right" }, { label: "Faltas", width: "16%", align: "right" }, { label: "Taxa", width: "17%", align: "right" }],
        q.absenteismoTop.map(p => `<tr>
          <td>${esc(p.nome)}</td>
          <td class="td-num">${p.total}</td>
          <td class="td-num">${p.faltas}</td>
          <td class="td-num ${p.taxa > 5 ? "text-danger" : ""}">${p.taxa.toFixed(1)}%</td>
        </tr>`).join(""),
        "Sem faltas registradas."
      )
    ) +
    block("Pontualidade — atrasos por profissional",
      table(
        [{ label: "Profissional", width: "50%" }, { label: "Ocorrências", width: "17%", align: "right" }, { label: "Total atraso", width: "16%", align: "right" }, { label: "Média", width: "17%", align: "right" }],
        q.atrasos.map(p => `<tr>
          <td>${esc(p.nome)}</td>
          <td class="td-num">${p.qtd}</td>
          <td class="td-num">${p.minutos} min</td>
          <td class="td-num">${p.media.toFixed(1)} min</td>
        </tr>`).join(""),
        "Sem atrasos registrados."
      )
    ) +
    block("Compliance de check-in/check-out por profissional",
      table(
        [
          { label: "Profissional", width: "36%" },
          { label: "Plantões", width: "16%", align: "right" },
          { label: "Com check-in", width: "16%", align: "right" },
          { label: "% Check-in", width: "16%", align: "right" },
          { label: "% Check-out", width: "16%", align: "right" },
        ],
        q.compliancePorProf.map(p => `<tr>
          <td>${esc(p.nome)}</td>
          <td class="td-num">${p.total}</td>
          <td class="td-num">${p.comCheckin}</td>
          <td class="td-num ${p.pctCheckin < 70 ? "text-danger" : ""}">${p.pctCheckin.toFixed(1)}%</td>
          <td class="td-num ${p.pctCheckout < 70 ? "text-danger" : ""}">${p.pctCheckout.toFixed(1)}%</td>
        </tr>`).join(""),
        "Sem plantões contabilizáveis para compliance."
      )
    ) +
    block("Faltas detalhadas",
      table(
        [
          { label: "Profissional", width: "28%" },
          { label: "Unidade", width: "20%" },
          { label: "Setor", width: "20%" },
          { label: "Data", width: "12%" },
          { label: "Horário", width: "12%" },
          { label: "Tipo", width: "8%" },
        ],
        q.faltasDetalhadas.map(s => `<tr>
          <td>${esc(s.profissional)}</td>
          <td>${esc(s.unidade)}</td>
          <td>${esc(s.setor)}</td>
          <td>${esc(s.data)}</td>
          <td>${esc(s.horario)}</td>
          <td>${esc(s.tipo)}</td>
        </tr>`).join(""),
        "Sem faltas registradas."
      )
    ) +
    block("Cancelamentos por profissional",
      table(
        [{ label: "Profissional", width: "75%" }, { label: "Cancelamentos", width: "25%", align: "right" }],
        q.cancelamentosPorProf.map(p => `<tr><td>${esc(p.nome)}</td><td class="td-num">${p.count}</td></tr>`).join(""),
        "Sem cancelamentos no período."
      )
    ) +
    block("Cancelamentos por setor",
      table(
        [{ label: "Setor", width: "75%" }, { label: "Cancelamentos", width: "25%", align: "right" }],
        q.cancelamentosPorSetor.map(p => `<tr><td>${esc(p.nome)}</td><td class="td-num">${p.count}</td></tr>`).join(""),
        "Sem cancelamentos por setor no período."
      )
    ) +
    block("Plantões cancelados detalhados",
      table(
        [
          { label: "Profissional", width: "24%" },
          { label: "Unidade", width: "18%" },
          { label: "Setor", width: "18%" },
          { label: "Data", width: "12%" },
          { label: "Horário", width: "12%" },
          { label: "Carga", width: "8%", align: "right" },
          { label: "Tipo", width: "8%" },
        ],
        q.cancelamentosDetalhados.map(s => `<tr>
          <td>${esc(s.profissional)}</td>
          <td>${esc(s.unidade)}</td>
          <td>${esc(s.setor)}</td>
          <td>${esc(s.data)}</td>
          <td>${esc(s.horario)}</td>
          <td class="td-num">${esc(s.carga)}</td>
          <td>${esc(s.tipo)}</td>
        </tr>`).join(""),
        "Sem plantões cancelados no período."
      )
    )
  );

  // ===== 4. TROCAS =====
  const tr = data.trocas;
  const trocasHtml = category(4, "Trocas", "Análise de solicitações, aprovações e motivos",
    kv([
      { label: "Total", valor: tr.total },
      { label: "Aprovadas", valor: tr.aprovadas },
      { label: "Rejeitadas", valor: tr.rejeitadas },
      { label: "Canceladas", valor: tr.canceladas },
      { label: "Pendentes", valor: tr.pendentes, alerta: tr.pendentes > 5 },
      { label: "Taxa de aprovação", valor: `${tr.taxaAprov.toFixed(1)}%`, alerta: tr.total > 0 && tr.taxaAprov < 70 },
      { label: "Taxa de rejeição", valor: `${tr.taxaRej.toFixed(1)}%`, alerta: tr.taxaRej > 20 },
      { label: "Resolvidas", valor: `${tr.resolvidas}/${tr.total}` },
      { label: "Tempo médio", valor: `${tr.tempoMedioH.toFixed(1)}h` },
    ]) +
    block("Distribuição por status",
      table(
        [{ label: "Status", width: "70%" }, { label: "Quantidade", width: "30%", align: "right" }],
        tr.porStatus.map(s => `<tr><td>${esc(s.nome)}</td><td class="td-num">${s.count}</td></tr>`).join("")
      )
    ) +
    block("Distribuição por tipo",
      table(
        [{ label: "Tipo", width: "70%" }, { label: "Quantidade", width: "30%", align: "right" }],
        `<tr><td>Direta</td><td class="td-num">${tr.porTipo.direta}</td></tr>
         <tr><td>Grupo</td><td class="td-num">${tr.porTipo.grupo}</td></tr>
         <tr><td>Administrativa</td><td class="td-num">${tr.porTipo.administrativa}</td></tr>`
      )
    ) +
    block("Trocas por setor",
      table(
        [{ label: "Setor", width: "35%" }, { label: "Volume", width: "45%" }, { label: "Trocas", width: "20%", align: "right" }],
        tr.porSetor.map(s => `<tr>
          <td>${esc(s.nome)}</td>
          <td>${bar(s.count, Math.max(1, ...tr.porSetor.map(x => x.count)))}</td>
          <td class="td-num">${s.count}</td>
        </tr>`).join(""),
        "Sem trocas por setor no período."
      )
    ) +
    block("Trocas por unidade",
      table(
        [{ label: "Unidade", width: "35%" }, { label: "Volume", width: "45%" }, { label: "Trocas", width: "20%", align: "right" }],
        tr.porUnidade.map(u => `<tr>
          <td>${esc(u.nome)}</td>
          <td>${bar(u.count, Math.max(1, ...tr.porUnidade.map(x => x.count)))}</td>
          <td class="td-num">${u.count}</td>
        </tr>`).join(""),
        "Sem trocas por unidade no período."
      )
    ) +
    block("Trocas por profissão",
      table(
        [{ label: "Profissão", width: "35%" }, { label: "Volume", width: "45%" }, { label: "Trocas", width: "20%", align: "right" }],
        tr.porProfissao.map(p => `<tr>
          <td>${esc(p.nome)}</td>
          <td>${bar(p.count, Math.max(1, ...tr.porProfissao.map(x => x.count)))}</td>
          <td class="td-num">${p.count}</td>
        </tr>`).join(""),
        "Sem dados por profissão."
      )
    ) +
    block("Evolução mensal das trocas",
      table(
        [
          { label: "Mês", width: "16%" },
          { label: "Volume", width: "34%" },
          { label: "Total", width: "12%", align: "right" },
          { label: "Aprovadas", width: "13%", align: "right" },
          { label: "Rejeitadas", width: "13%", align: "right" },
          { label: "Pendentes", width: "12%", align: "right" },
        ],
        tr.evolucaoMensal.map(e => `<tr>
          <td class="td-mes">${esc(e.mes)}</td>
          <td>${bar(e.total, Math.max(1, ...tr.evolucaoMensal.map(x => x.total)))}</td>
          <td class="td-num">${e.total}</td>
          <td class="td-num">${e.aprovadas}</td>
          <td class="td-num">${e.rejeitadas}</td>
          <td class="td-num">${e.pendentes}</td>
        </tr>`).join(""),
        "Sem evolução mensal registrada."
      )
    ) +
    block("Top solicitantes",
      table(
        [{ label: "Profissional", width: "75%" }, { label: "Solicitações", width: "25%", align: "right" }],
        tr.topSolicitantes.map(p => `<tr><td>${esc(p.nome)}</td><td class="td-num">${p.count}</td></tr>`).join(""),
        "Sem solicitações de troca no período."
      )
    ) +
    block("Top destinatários",
      table(
        [{ label: "Profissional", width: "75%" }, { label: "Recebidas", width: "25%", align: "right" }],
        tr.topDestinatarios.map(p => `<tr><td>${esc(p.nome)}</td><td class="td-num">${p.count}</td></tr>`).join(""),
        "Sem destinatários de troca no período."
      )
    ) +
    block("Top motivos de troca",
      table(
        [{ label: "Motivo", width: "75%" }, { label: "Ocorrências", width: "25%", align: "right" }],
        tr.topMotivos.map(m => `<tr><td>${esc(m.nome)}</td><td class="td-num">${m.count}</td></tr>`).join(""),
        "Sem motivos registrados."
      )
    ) +
    block("Trocas por profissional",
      table(
        [
          { label: "Profissional", width: "17%" },
          { label: "Profissão", width: "10%" },
          { label: "Unidade", width: "12%" },
          { label: "Setor", width: "12%" },
          { label: "Sol.", width: "6%", align: "right" },
          { label: "Rec.", width: "6%", align: "right" },
          { label: "Aprov.", width: "7%", align: "right" },
          { label: "Rej.", width: "6%", align: "right" },
          { label: "Pend.", width: "6%", align: "right" },
          { label: "Canc.", width: "6%", align: "right" },
          { label: "Adm.", width: "6%", align: "right" },
          { label: "Horas", width: "6%", align: "right" },
        ],
        tr.porProfissional.map(p => `<tr>
          <td>${esc(p.nome)}</td>
          <td>${esc(p.profissao)}</td>
          <td>${esc(p.unidade)}</td>
          <td>${esc(p.setor)}</td>
          <td class="td-num">${p.solicitadas}</td>
          <td class="td-num">${p.recebidas}</td>
          <td class="td-num">${p.aprovadas}</td>
          <td class="td-num">${p.rejeitadas}</td>
          <td class="td-num">${p.pendentes}</td>
          <td class="td-num">${p.canceladas}</td>
          <td class="td-num">${p.administrativas}</td>
          <td class="td-num">${p.horas.toFixed(1)}h</td>
        </tr>`).join(""),
        "Sem movimentação por profissional."
      )
    ) +
    block("Histórico completo de trocas",
      table(
        [
          { label: "Protocolo", width: "8%" },
          { label: "Tipo", width: "8%" },
          { label: "Solicitante", width: "12%" },
          { label: "Destinatário", width: "12%" },
          { label: "Unidade/Setor", width: "14%" },
          { label: "Plantão", width: "16%" },
          { label: "Motivo", width: "12%" },
          { label: "Status", width: "8%" },
          { label: "Tempo", width: "5%" },
          { label: "Observação", width: "5%" },
        ],
        tr.trocasDetalhadas.map(t => `<tr>
          <td>${esc(t.protocolo)}</td>
          <td>${esc(t.tipo)}</td>
          <td>${esc(t.solicitante)}</td>
          <td>${esc(t.destinatario)}</td>
          <td>${esc(t.unidade)}<br>${esc(t.setor)}</td>
          <td>${esc(t.plantao)}</td>
          <td>${esc(t.motivo)}</td>
          <td>${esc(t.status)}</td>
          <td>${esc(t.tempo)}</td>
          <td>${esc(t.observacao)}</td>
        </tr>`).join(""),
        "Sem trocas no período."
      )
    )
  );

  // ===== 5. ANALÍTICO =====
  const an = data.analitico;
  const maxRank = Math.max(1, ...an.rankingHoras.map(p => p.horas));
  const maxEvol = Math.max(1, ...an.evolucaoMensal.map(e => e.horas));
  const analiticoHtml = category(5, "Analítico", "Produtividade, carga semanal e evolução histórica",
    block("Ranking de horas por profissional",
      table(
        [{ label: "Profissional", width: "34%" }, { label: "Horas", width: "34%" }, { label: "Horas", width: "11%", align: "right" }, { label: "Plantões", width: "11%", align: "right" }, { label: "% Total", width: "10%", align: "right" }],
        an.rankingHoras.map(p => `<tr>
          <td>${esc(p.nome)}</td>
          <td>${bar(p.horas, maxRank)}</td>
          <td class="td-num">${p.horas.toFixed(0)}h</td>
          <td class="td-num">${p.plantoes}</td>
          <td class="td-num">${p.pctTotal.toFixed(1)}%</td>
        </tr>`).join("")
      )
    ) +
    block("Carga horária semanal por profissional",
      table(
        [
          { label: "Profissional", width: "40%" },
          { label: "Semanas", width: "12%", align: "right" },
          { label: "Média/sem", width: "16%", align: "right" },
          { label: "Pico", width: "12%", align: "right" },
          { label: "Status", width: "20%" },
        ],
        an.cargaSemanal.map(p => `<tr>
          <td>${esc(p.nome)}</td>
          <td class="td-num">${p.semanas}</td>
          <td class="td-num">${p.media.toFixed(1)}h</td>
          <td class="td-num ${p.pico > 60 ? "text-danger" : ""}">${p.pico.toFixed(1)}h</td>
          <td>${esc(p.alerta)}</td>
        </tr>`).join("")
      )
    ) +
    (an.cargaPicoAlerta.length ? block("Profissionais com pico semanal acima de 60h",
      table(
        [{ label: "Profissional", width: "70%" }, { label: "Pico", width: "30%", align: "right" }],
        an.cargaPicoAlerta.map(p => `<tr><td>${esc(p.nome)}</td><td class="td-num text-danger">${p.picoH.toFixed(1)}h</td></tr>`).join("")
      )
    ) : "") +
    (an.cargaCLTAlerta.length ? block("Profissionais com média semanal acima de 44h",
      table(
        [{ label: "Profissional", width: "50%" }, { label: "Média semanal", width: "25%", align: "right" }, { label: "Pico semanal", width: "25%", align: "right" }],
        an.cargaCLTAlerta.map(p => `<tr><td>${esc(p.nome)}</td><td class="td-num text-danger">${p.mediaH.toFixed(1)}h</td><td class="td-num">${p.picoH.toFixed(1)}h</td></tr>`).join("")
      )
    ) : "") +
    block("Evolução mensal do período",
      table(
        [{ label: "Mês", width: "14%" }, { label: "Horas realizadas", width: "44%" }, { label: "Horas", width: "14%", align: "right" }, { label: "Plantões", width: "14%", align: "right" }, { label: "Faltas", width: "14%", align: "right" }],
        an.evolucaoMensal.map(e => `<tr>
          <td class="td-mes">${esc(e.mes)}</td>
          <td>${bar(e.horas, maxEvol)}</td>
          <td class="td-num">${e.horas.toFixed(0)}h</td>
          <td class="td-num">${e.plantoes}</td>
          <td class="td-num">${e.faltas}</td>
        </tr>`).join("")
      )
    )
  );

  const custoHtml = typeof data.custoTotal === "number"
    ? `<section class="block" data-pdf-section="custo"><h3>Custo total estimado</h3><p class="custo-valor">${data.custoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></section>`
    : "";

  const assinaturasHtml = incluirAssinatura ? buildSignatureHtml({ responsavel, responsavelTecnico }) : "";
  const footerHtml = buildFooterHtml(sistema);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatório Geral Executivo — ${esc(data.periodo.label)}</title>
<style>
  ${DOCUMENT_CSS_BASE}
  .toolbar { position: sticky; top: 0; background:#fff; padding:12px 0; border-bottom:1px solid #e5e7eb; margin-bottom:16px; display:flex; gap:10px; z-index: 20; }
  .toolbar button { background:#0e7490; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600; }
  .toolbar button.secondary { background:#fff; color:#111; border:1px solid #cbd5e1; }

  .resumo-executivo { background:#f0f9ff; border-left:4px solid #0e7490; padding:12px 16px; border-radius:6px; margin:16px 0; font-size:11pt; line-height:1.6; }
  .resumo-executivo h3 { margin:0 0 6px; font-size:10pt; color:#0e7490; text-transform:uppercase; letter-spacing:.5px; }

  .kpi-grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin:12px 0; }
  .kpi { border:1px solid #e2e8f0; border-radius:8px; padding:10px; background:#fff; page-break-inside:avoid; }
  .kpi-alert { border-color:#f59e0b; background:#fffbeb; }
  .kpi-label { font-size:8pt; text-transform:uppercase; color:#64748b; font-weight:600; }
  .kpi-value { font-size:14pt; font-weight:800; color:#0f172a; margin-top:2px; }
  .kpi-var { font-size:8.5pt; margin-top:2px; font-weight:600; }
  .kpi-var.up { color:#059669; } .kpi-var.down { color:#dc2626; }

  .category { margin-top: 22px; page-break-before: auto; }
  .cat-header { display:flex; align-items:center; gap:10px; border-bottom:2px solid #0e7490; padding-bottom:6px; margin-bottom:10px; }
  .cat-num { display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; background:#0e7490; color:#fff; font-weight:800; font-size:12pt; flex-shrink:0; }
  .cat-header h2 { margin:0; font-size:13pt; color:#0e7490; text-transform:uppercase; letter-spacing:.5px; }
  .cat-sub { font-size:9pt; color:#64748b; }

  .block { margin:12px 0 16px; page-break-inside:auto; }
  .block h3 { font-size:10.5pt; color:#0f172a; text-transform:uppercase; letter-spacing:.4px; margin:8px 0 6px; border-left:3px solid #0e7490; padding-left:8px; }

  .kv-grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin:8px 0 10px; }
  .kv { border:1px solid #e2e8f0; border-radius:6px; padding:8px 10px; background:#f8fafc; }
  .kv-alert { border-color:#f59e0b; background:#fffbeb; }
  .kv-label { font-size:7.5pt; text-transform:uppercase; color:#64748b; font-weight:600; }
  .kv-value { font-size:13pt; font-weight:800; color:#0f172a; margin-top:2px; }

  .atencao-list li { color:#7c2d12; margin-bottom:4px; }
  .positivo-list li { color:#065f46; margin-bottom:4px; }
  .reco-list li { margin-bottom:6px; }
  .empty { color:#94a3b8; font-style:italic; font-size:10pt; }

  .bar-track { background:#e2e8f0; border-radius:4px; height:10px; width:100%; overflow:hidden; }
  .bar-fill { background:linear-gradient(90deg,#0e7490,#2b9a8f); height:100%; border-radius:4px; }
  .td-num { text-align:right; font-variant-numeric:tabular-nums; }
  .td-mes { font-weight:600; text-transform:capitalize; }
  .text-danger { color:#dc2626; font-weight:700; }

  .custo-valor { font-size:18pt; font-weight:800; color:#0e7490; margin:6px 0; }

  @media print { .no-print { display:none !important; } }
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

  ${cadastrosHtml}
  ${operacionalHtml}
  ${qualidadeHtml}
  ${trocasHtml}
  ${analiticoHtml}
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
    html = html.replace("</body>", "<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body>");
  }
  w.document.write(html);
  w.document.close();
  return true;
}
