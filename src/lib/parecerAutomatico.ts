// Motor de parecer automático baseado em regras (determinístico, auditável).
// Todo texto gerado deve ser rastreável a um número do RelatorioGeralData.

export interface RelatorioGeralData {
  periodo: { label: string; ini: string; fim: string };
  kpisPrincipais: { label: string; valor: string; variacao?: number; alerta?: boolean }[];
  evolucaoMensal: { mes: string; horas: number; plantoes: number; faltas: number }[];
  topSetores: { nome: string; horas: number; plantoes: number }[];
  absenteismoTop: { nome: string; taxa: number; faltas: number; total: number }[];
  coberturaSetor: { nome: string; count: number; horas: number }[];
  cargaPicoAlerta: { nome: string; picoH: number }[];
  trocasResumo: { total: number; taxaAprov: number; pendentes: number; tempoMedioH: number };
  totais: {
    plantoes: number;
    horas: number;
    horasPrev: number;
    variacaoHoras: number;
    profAtivos: number;
    taxaAbsenteismo: number;
    taxaAbsenteismoPrev: number;
    taxaCancelamento: number;
    faltas: number;
    cancelados: number;
  };
  custoTotal?: number;
  parecer: ParecerAutomatico;
}

export interface ParecerAutomatico {
  resumoExecutivo: string;
  pontosAtencao: string[];
  pontosPositivos: string[];
  recomendacoes: string[];
}

const pct = (n: number) => `${n.toFixed(1)}%`;

export function gerarParecer(
  data: Omit<RelatorioGeralData, "parecer">
): ParecerAutomatico {
  const t = data.totais;
  const pontosAtencao: string[] = [];
  const pontosPositivos: string[] = [];
  const recomendacoes: string[] = [];

  // Tendência de horas
  const tendencia =
    t.variacaoHoras > 5 ? "alta" : t.variacaoHoras < -5 ? "baixa" : "estável";

  const resumoExecutivo =
    `No período de ${data.periodo.label}, foram registrados ${t.plantoes} plantões ` +
    `totalizando ${t.horas.toFixed(0)}h realizadas, envolvendo ${t.profAtivos} profissionais ativos. ` +
    `A taxa de absenteísmo foi de ${pct(t.taxaAbsenteismo)} (${t.faltas} faltas), ` +
    `com tendência ${tendencia} em relação ao período anterior (${t.horasPrev.toFixed(0)}h). ` +
    `Foram solicitadas ${data.trocasResumo.total} trocas de plantão, das quais ` +
    `${pct(data.trocasResumo.taxaAprov)} aprovadas, com tempo médio de resolução ` +
    `de ${data.trocasResumo.tempoMedioH.toFixed(1)}h.`;

  // Regras de risco
  if (t.taxaAbsenteismo > 5) {
    const topAbs = data.absenteismoTop.slice(0, 3).map(p => `${p.nome} (${pct(p.taxa)})`).join(", ");
    pontosAtencao.push(
      `Taxa de absenteísmo de ${pct(t.taxaAbsenteismo)} está acima do limite aceitável de 5%${topAbs ? `, concentrada em: ${topAbs}` : ""}.`
    );
    recomendacoes.push(
      `Investigar causas das faltas junto aos profissionais com maior taxa e reforçar comunicação de escala.`
    );
  } else if (t.taxaAbsenteismo <= 2) {
    pontosPositivos.push(`Taxa de absenteísmo controlada em ${pct(t.taxaAbsenteismo)}, abaixo do limite institucional.`);
  }

  if (t.variacaoHoras > 20) {
    pontosAtencao.push(
      `Aumento de ${pct(t.variacaoHoras)} nas horas realizadas em relação ao período anterior pode indicar sobrecarga ou expansão de cobertura.`
    );
    recomendacoes.push(`Investigar causa do aumento de carga e avaliar necessidade de novas contratações ou redistribuição.`);
  } else if (t.variacaoHoras < -20) {
    pontosAtencao.push(
      `Queda de ${pct(Math.abs(t.variacaoHoras))} nas horas realizadas — verificar se há desfalque de cobertura ou plantões não preenchidos.`
    );
    recomendacoes.push(`Revisar plantões em aberto e reforçar convocação para preenchimento das lacunas.`);
  }

  if (data.cargaPicoAlerta.length > 0) {
    const top = data.cargaPicoAlerta.slice(0, 3).map(p => `${p.nome} (${p.picoH.toFixed(0)}h)`).join(", ");
    pontosAtencao.push(
      `${data.cargaPicoAlerta.length} profissional(is) ultrapassaram 60h semanais no período — risco de esgotamento e não conformidade: ${top}.`
    );
    recomendacoes.push(`Revisar distribuição de carga desses profissionais na próxima escala e limitar plantões extras.`);
  }

  if (data.trocasResumo.total > 0 && data.trocasResumo.taxaAprov < 70) {
    pontosAtencao.push(
      `Taxa de aprovação de trocas de ${pct(data.trocasResumo.taxaAprov)} está baixa — pode indicar processo de aprovação lento ou critérios pouco claros.`
    );
    recomendacoes.push(`Rever critérios de aprovação de trocas e agilizar análise pelos coordenadores.`);
  }

  if (data.trocasResumo.pendentes > 5) {
    pontosAtencao.push(`${data.trocasResumo.pendentes} trocas aguardando análise — acúmulo acima do esperado.`);
    recomendacoes.push(`Priorizar análise das trocas pendentes para desbloqueio operacional.`);
  }

  if (t.taxaCancelamento > 5) {
    pontosAtencao.push(
      `Taxa de cancelamento de plantões de ${pct(t.taxaCancelamento)} (${t.cancelados} plantões) merece investigação de causa raiz.`
    );
    recomendacoes.push(`Analisar motivos dos cancelamentos e implementar plano de contenção.`);
  }

  const totalHorasSetor = data.coberturaSetor.reduce((a, s) => a + s.horas, 0);
  if (totalHorasSetor > 0) {
    const top = [...data.coberturaSetor].sort((a, b) => b.horas - a.horas)[0];
    const perc = (top.horas / totalHorasSetor) * 100;
    if (perc > 40) {
      pontosAtencao.push(
        `Setor ${top.nome} concentra ${pct(perc)} de todas as horas do período — avaliar redistribuição.`
      );
      recomendacoes.push(`Reavaliar dimensionamento entre setores para reduzir concentração excessiva em ${top.nome}.`);
    }
  }

  if (data.trocasResumo.total > 0 && data.trocasResumo.taxaAprov >= 85) {
    pontosPositivos.push(`Alta taxa de aprovação de trocas (${pct(data.trocasResumo.taxaAprov)}) indica processo ágil de gestão.`);
  }

  if (pontosAtencao.length === 0) {
    pontosPositivos.push("Nenhum indicador crítico identificado neste período.");
  }

  return { resumoExecutivo, pontosAtencao, pontosPositivos, recomendacoes };
}
