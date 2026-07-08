// Motor de parecer automático + tipos consolidados do Relatório Geral.
// Todo texto gerado deve ser rastreável a um número do RelatorioGeralData.

export interface KV { label: string; valor: string | number; }
export interface NamedCount { nome: string; count: number; }

export interface CadastrosData {
  totalProfissionais: number;
  ativos: number;
  inativos: number;
  porProfissao: NamedCount[];
  porStatus: NamedCount[];
  porUnidade: NamedCount[];
  porSetor: NamedCount[];
  profissionais: {
    nome: string;
    profissao: string;
    conselho: string;
    especialidade: string;
    email: string;
    telefone: string;
    status: string;
    unidade: string;
    setor: string;
  }[];
  totalUnidades: number;
  totalSetores: number;
}

export interface OperacionalData {
  totalPlantoes: number;
  horasContabilizadas: number;
  porStatus: NamedCount[];
  porUnidade: { nome: string; count: number; horas: number }[];
  porTipoPlantao: { nome: string; count: number; horas: number }[];
  coberturaSetor: { nome: string; count: number; horas: number }[];
  topSetores: { nome: string; horas: number; plantoes: number }[];
  plantoesDetalhados: {
    profissional: string;
    conselho: string;
    setor: string;
    unidade: string;
    data: string;
    horario: string;
    carga: string;
    tipo: string;
    status: string;
  }[];
  escalaMensal: {
    profissional: string;
    setor: string;
    totalHoras: number;
    dias: Record<string, string>;
  }[];
  escalaDias: string[];
}

export interface QualidadeData {
  taxaAbsenteismo: number;
  faltas: number;
  taxaCancelamento: number;
  cancelados: number;
  absenteismoTop: { nome: string; taxa: number; faltas: number; total: number }[];
  atrasos: { nome: string; qtd: number; minutos: number; media: number }[];
  compliance: { totalPlantoes: number; comCheckin: number; comCheckout: number; pctCheckin: number; pctCheckout: number };
  compliancePorProf: { nome: string; total: number; comCheckin: number; comCheckout: number; pctCheckin: number; pctCheckout: number }[];
  cancelamentosPorProf: NamedCount[];
  faltasDetalhadas: { profissional: string; setor: string; unidade: string; data: string; horario: string; tipo: string }[];
  cancelamentosDetalhados: { profissional: string; setor: string; unidade: string; data: string; horario: string; carga: string; tipo: string }[];
}

export interface TrocasData {
  total: number;
  aprovadas: number;
  rejeitadas: number;
  canceladas: number;
  pendentes: number;
  taxaAprov: number;
  taxaRej: number;
  resolvidas: number;
  tempoMedioH: number;
  porStatus: NamedCount[];
  porTipo: { direta: number; grupo: number; administrativa: number };
  topSolicitantes: NamedCount[];
  topMotivos: NamedCount[];
  porProfissional: {
    nome: string;
    profissao: string;
    unidade: string;
    setor: string;
    solicitadas: number;
    recebidas: number;
    aprovadas: number;
    rejeitadas: number;
    pendentes: number;
    canceladas: number;
    administrativas: number;
    horas: number;
    taxaAprov: number;
  }[];
  trocasDetalhadas: {
    protocolo: string;
    tipo: string;
    solicitante: string;
    destinatario: string;
    unidade: string;
    setor: string;
    plantao: string;
    motivo: string;
    status: string;
    criacao: string;
    resolucao: string;
    tempo: string;
    observacao: string;
  }[];
}

export interface AnaliticoData {
  rankingHoras: { nome: string; horas: number; plantoes: number }[];
  cargaSemanal: { nome: string; semanas: number; media: number; pico: number; alerta: string }[];
  cargaPicoAlerta: { nome: string; picoH: number }[];
  evolucaoMensal: { mes: string; horas: number; plantoes: number; faltas: number }[];
}

export interface RelatorioGeralData {
  periodo: { label: string; ini: string; fim: string };
  kpisPrincipais: { label: string; valor: string; variacao?: number; alerta?: boolean }[];
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
  cadastros: CadastrosData;
  operacional: OperacionalData;
  qualidade: QualidadeData;
  trocas: TrocasData;
  analitico: AnaliticoData;
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
  const q = data.qualidade;
  const tr = data.trocas;
  const pontosAtencao: string[] = [];
  const pontosPositivos: string[] = [];
  const recomendacoes: string[] = [];

  const tendencia =
    t.variacaoHoras > 5 ? "alta" : t.variacaoHoras < -5 ? "baixa" : "estável";

  const resumoExecutivo =
    `No período de ${data.periodo.label}, foram registrados ${t.plantoes} plantões ` +
    `totalizando ${t.horas.toFixed(0)}h realizadas, envolvendo ${t.profAtivos} profissionais ativos ` +
    `de um total de ${data.cadastros.totalProfissionais} cadastrados em ${data.cadastros.totalSetores} setores. ` +
    `A taxa de absenteísmo foi de ${pct(t.taxaAbsenteismo)} (${t.faltas} faltas) ` +
    `com tendência ${tendencia} em relação ao período anterior (${t.horasPrev.toFixed(0)}h). ` +
    `Foram solicitadas ${tr.total} trocas de plantão, das quais ${pct(tr.taxaAprov)} aprovadas, ` +
    `com tempo médio de resolução de ${tr.tempoMedioH.toFixed(1)}h. ` +
    `Compliance de check-in: ${pct(q.compliance.pctCheckin)} · check-out: ${pct(q.compliance.pctCheckout)}.`;

  // Regras
  if (q.taxaAbsenteismo > 5) {
    const top = q.absenteismoTop.slice(0, 3).map(p => `${p.nome} (${pct(p.taxa)})`).join(", ");
    pontosAtencao.push(`Taxa de absenteísmo de ${pct(q.taxaAbsenteismo)} acima do limite de 5%${top ? `, concentrada em: ${top}` : ""}.`);
    recomendacoes.push(`Investigar causas das faltas junto aos profissionais com maior taxa e reforçar comunicação de escala.`);
  } else if (q.taxaAbsenteismo <= 2) {
    pontosPositivos.push(`Taxa de absenteísmo controlada em ${pct(q.taxaAbsenteismo)}.`);
  }

  if (t.variacaoHoras > 20) {
    pontosAtencao.push(`Aumento de ${pct(t.variacaoHoras)} nas horas realizadas vs período anterior — pode indicar sobrecarga ou expansão de cobertura.`);
    recomendacoes.push(`Avaliar necessidade de novas contratações ou redistribuição de carga.`);
  } else if (t.variacaoHoras < -20) {
    pontosAtencao.push(`Queda de ${pct(Math.abs(t.variacaoHoras))} nas horas realizadas — verificar desfalque de cobertura.`);
    recomendacoes.push(`Revisar plantões em aberto e reforçar convocação para preenchimento das lacunas.`);
  }

  if (data.analitico.cargaPicoAlerta.length > 0) {
    const top = data.analitico.cargaPicoAlerta.slice(0, 3).map(p => `${p.nome} (${p.picoH.toFixed(0)}h)`).join(", ");
    pontosAtencao.push(`${data.analitico.cargaPicoAlerta.length} profissional(is) ultrapassaram 60h semanais — risco de esgotamento: ${top}.`);
    recomendacoes.push(`Revisar distribuição de carga desses profissionais na próxima escala e limitar plantões extras.`);
  }

  if (tr.total > 0 && tr.taxaAprov < 70) {
    pontosAtencao.push(`Taxa de aprovação de trocas de ${pct(tr.taxaAprov)} está baixa — processo lento ou critérios pouco claros.`);
    recomendacoes.push(`Rever critérios de aprovação de trocas e agilizar análise pelos coordenadores.`);
  }

  if (tr.pendentes > 5) {
    pontosAtencao.push(`${tr.pendentes} trocas aguardando análise — acúmulo acima do esperado.`);
    recomendacoes.push(`Priorizar análise das trocas pendentes para desbloqueio operacional.`);
  }

  if (q.taxaCancelamento > 5) {
    pontosAtencao.push(`Taxa de cancelamento de plantões de ${pct(q.taxaCancelamento)} (${q.cancelados} plantões) merece investigação de causa raiz.`);
    recomendacoes.push(`Analisar motivos dos cancelamentos e implementar plano de contenção.`);
  }

  if (q.compliance.totalPlantoes > 0 && q.compliance.pctCheckin < 70) {
    pontosAtencao.push(`Compliance de check-in de apenas ${pct(q.compliance.pctCheckin)} — dificulta auditoria e comprovação de presença.`);
    recomendacoes.push(`Reforçar orientação sobre uso obrigatório do check-in/check-out no início e fim do plantão.`);
  }

  const totalHorasSetor = data.operacional.coberturaSetor.reduce((a, s) => a + s.horas, 0);
  if (totalHorasSetor > 0 && data.operacional.coberturaSetor.length > 0) {
    const top = [...data.operacional.coberturaSetor].sort((a, b) => b.horas - a.horas)[0];
    const perc = (top.horas / totalHorasSetor) * 100;
    if (perc > 40) {
      pontosAtencao.push(`Setor ${top.nome} concentra ${pct(perc)} das horas do período — avaliar redistribuição.`);
      recomendacoes.push(`Reavaliar dimensionamento entre setores para reduzir concentração em ${top.nome}.`);
    }
  }

  if (tr.total > 0 && tr.taxaAprov >= 85) {
    pontosPositivos.push(`Alta taxa de aprovação de trocas (${pct(tr.taxaAprov)}) indica processo ágil.`);
  }
  if (q.compliance.totalPlantoes > 0 && q.compliance.pctCheckin >= 90) {
    pontosPositivos.push(`Excelente compliance de check-in (${pct(q.compliance.pctCheckin)}).`);
  }
  if (data.cadastros.inativos > 0 && data.cadastros.inativos / Math.max(1, data.cadastros.totalProfissionais) > 0.2) {
    pontosAtencao.push(`${data.cadastros.inativos} profissionais inativos (${pct((data.cadastros.inativos / data.cadastros.totalProfissionais) * 100)} do cadastro) — revisar necessidade de reativação ou limpeza cadastral.`);
    recomendacoes.push(`Revisar cadastro de profissionais inativos e limpar registros obsoletos.`);
  }

  if (pontosAtencao.length === 0) {
    pontosPositivos.push("Nenhum indicador crítico identificado neste período.");
  }

  return { resumoExecutivo, pontosAtencao, pontosPositivos, recomendacoes };
}
