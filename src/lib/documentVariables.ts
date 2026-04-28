import { supabase } from '@/integrations/supabase/client';

export type VariableCategory =
  | 'institucional'
  | 'profissional'
  | 'plantao'
  | 'escala'
  | 'troca'
  | 'assinatura';

export interface VariableDef {
  key: string;            // sem chaves: ex. "profissional_nome"
  label: string;          // título curto
  description: string;    // explicação 1 linha
  category: VariableCategory;
  sensitive?: boolean;    // requer permissão para resolver com dado real
  example?: string;       // amostra apenas para preview
}

export const CATEGORY_LABEL: Record<VariableCategory, string> = {
  institucional: 'Institucional',
  profissional: 'Profissional',
  plantao: 'Plantão',
  escala: 'Escala',
  troca: 'Troca',
  assinatura: 'Assinatura & Validação',
};

/**
 * Catálogo único de variáveis suportadas pelo sistema.
 * Use isto para validação, menu "Inserir variável" e amostras de preview.
 */
export const VARIABLE_CATALOG: VariableDef[] = [
  // Institucional
  { key: 'instituicao_nome', label: 'Nome da instituição', description: 'Nome da instituição configurada (Configurações → Hospital).', category: 'institucional', example: 'SMS Oriximiná' },
  { key: 'instituicao_cnpj', label: 'CNPJ da instituição', description: 'CNPJ formatado.', category: 'institucional', example: '05.131.081/0001-82' },
  { key: 'instituicao_endereco', label: 'Endereço da instituição', description: 'Endereço cadastrado nas configurações.', category: 'institucional', example: 'Rua dois de Junho, s/n — Oriximiná/PA' },
  { key: 'sistema_nome', label: 'Nome do sistema', description: 'Nome do sistema (GestorPlantão).', category: 'institucional', example: 'GestorPlantão' },
  { key: 'data_emissao', label: 'Data de emissão', description: 'Data atual no formato dd/mm/aaaa.', category: 'institucional' },
  { key: 'hora_emissao', label: 'Hora de emissão', description: 'Hora atual HH:mm.', category: 'institucional' },
  { key: 'usuario_emissor', label: 'Usuário emissor', description: 'Nome do usuário autenticado que está emitindo o documento.', category: 'institucional' },
  { key: 'unidade_nome', label: 'Nome da unidade', description: 'Unidade vinculada ao contexto (escala, plantão ou modelo).', category: 'institucional' },
  { key: 'unidade_endereco', label: 'Endereço da unidade', description: 'Endereço da unidade vinculada.', category: 'institucional' },
  { key: 'setor_nome', label: 'Nome do setor', description: 'Setor vinculado ao contexto.', category: 'institucional' },

  // Profissional
  { key: 'profissional_nome', label: 'Nome do profissional', description: 'Nome completo do profissional do contexto.', category: 'profissional' },
  { key: 'profissional_profissao', label: 'Profissão', description: 'Médico, Enfermeiro, Técnico, etc.', category: 'profissional' },
  { key: 'profissional_especialidade', label: 'Especialidade', description: 'Especialidade declarada.', category: 'profissional' },
  { key: 'profissional_conselho', label: 'Conselho', description: 'Sigla do conselho (CRM, COREN, CREFITO...).', category: 'profissional' },
  { key: 'profissional_registro', label: 'Registro', description: 'Número do conselho.', category: 'profissional' },
  { key: 'profissional_cbo', label: 'CBO', description: 'Código Brasileiro de Ocupações (se cadastrado).', category: 'profissional' },
  { key: 'profissional_cns', label: 'CNS', description: 'Cartão Nacional de Saúde — apenas com permissão.', category: 'profissional', sensitive: true },
  { key: 'profissional_carimbo', label: 'Bloco de carimbo', description: 'Linhas tradicionais de carimbo (nome / conselho).', category: 'profissional' },
  { key: 'profissional_assinatura_visual', label: 'Linha de assinatura', description: 'Linha pontilhada com nome abaixo.', category: 'profissional' },

  // Plantão
  { key: 'plantao_data', label: 'Data do plantão', description: 'Data dd/mm/aaaa do plantão do contexto.', category: 'plantao' },
  { key: 'plantao_dia_semana', label: 'Dia da semana', description: 'Dia da semana por extenso.', category: 'plantao' },
  { key: 'plantao_horario', label: 'Horário', description: 'HH:mm às HH:mm.', category: 'plantao' },
  { key: 'plantao_tipo', label: 'Tipo do plantão', description: 'Diurno, Noturno, 12h, 24h, Sobreaviso.', category: 'plantao' },
  { key: 'plantao_status', label: 'Status', description: 'Status atual (confirmado, realizado, etc).', category: 'plantao' },
  { key: 'plantao_unidade', label: 'Unidade do plantão', description: 'Unidade vinculada ao plantão.', category: 'plantao' },
  { key: 'plantao_setor', label: 'Setor do plantão', description: 'Setor vinculado ao plantão.', category: 'plantao' },
  { key: 'plantao_total_horas', label: 'Total de horas', description: 'Carga horária do plantão.', category: 'plantao' },

  // Escala
  { key: 'escala_mes', label: 'Mês de referência', description: 'Mês por extenso.', category: 'escala' },
  { key: 'escala_ano', label: 'Ano', description: 'Ano (4 dígitos).', category: 'escala' },
  { key: 'escala_periodo', label: 'Período', description: 'Período da escala (ex: 01/06/2026 a 30/06/2026).', category: 'escala' },
  { key: 'escala_tabela_mensal', label: 'Tabela mensal', description: 'Tabela HTML profissional × dia (substituída na geração).', category: 'escala' },
  { key: 'escala_legenda', label: 'Legenda dos plantões', description: 'Legenda dos tipos usados (D/N/12/24/SA).', category: 'escala' },
  { key: 'escala_total_plantoes', label: 'Total de plantões', description: 'Quantidade total de plantões na escala.', category: 'escala' },
  { key: 'escala_total_horas', label: 'Total de horas', description: 'Soma de horas de todos os plantões.', category: 'escala' },
  { key: 'escala_observacoes', label: 'Observações', description: 'Observações inseridas na exportação.', category: 'escala' },

  // Troca
  { key: 'troca_solicitante', label: 'Solicitante', description: 'Profissional que solicitou a troca.', category: 'troca' },
  { key: 'troca_substituto', label: 'Substituto', description: 'Profissional que aceitou a troca.', category: 'troca' },
  { key: 'troca_data', label: 'Data da troca', description: 'Data do plantão trocado.', category: 'troca' },
  { key: 'troca_horario', label: 'Horário', description: 'Horário do plantão trocado.', category: 'troca' },
  { key: 'troca_setor', label: 'Setor', description: 'Setor do plantão envolvido.', category: 'troca' },
  { key: 'troca_unidade', label: 'Unidade', description: 'Unidade do plantão envolvido.', category: 'troca' },
  { key: 'troca_motivo', label: 'Motivo', description: 'Motivo informado.', category: 'troca' },
  { key: 'troca_status', label: 'Status', description: 'Status da troca (solicitada, aprovada, recusada...).', category: 'troca' },
  { key: 'troca_responsavel_aprovacao', label: 'Responsável aprovação', description: 'Quem aprovou/recusou.', category: 'troca' },
  { key: 'troca_data_aprovacao', label: 'Data da decisão', description: 'Data da aprovação/recusa.', category: 'troca' },
  { key: 'troca_historico', label: 'Histórico', description: 'Linhas com o histórico cronológico (ações registradas).', category: 'troca' },

  // Assinatura
  { key: 'assinatura_profissional', label: 'Assinatura profissional', description: 'Bloco de assinatura do profissional do contexto.', category: 'assinatura' },
  { key: 'assinatura_coordenador', label: 'Assinatura coordenador', description: 'Bloco de assinatura do coordenador da unidade.', category: 'assinatura' },
  { key: 'assinatura_gestor_master', label: 'Assinatura gestor master', description: 'Bloco de assinatura do gestor master.', category: 'assinatura' },
  { key: 'carimbo_profissional', label: 'Carimbo profissional', description: 'Carimbo (nome + conselho) do profissional.', category: 'assinatura' },
  { key: 'carimbo_coordenador', label: 'Carimbo coordenador', description: 'Carimbo do coordenador.', category: 'assinatura' },
  { key: 'carimbo_gestor_master', label: 'Carimbo gestor master', description: 'Carimbo do gestor master.', category: 'assinatura' },
  { key: 'hash_documento', label: 'Hash do documento', description: 'SHA-256 truncado do conteúdo final (após variáveis).', category: 'assinatura' },
  { key: 'codigo_validacao', label: 'Código de validação', description: 'Código curto único para validação manual.', category: 'assinatura' },
  { key: 'qr_code_validacao', label: 'QR Code de validação', description: 'QR Code (imagem) com link para validação.', category: 'assinatura' },
];

export const VARIABLE_KEYS = new Set(VARIABLE_CATALOG.map(v => v.key));

export function getVariableDef(key: string): VariableDef | undefined {
  return VARIABLE_CATALOG.find(v => v.key === key);
}

/** Extrai todas as ocorrências {{nome}} do HTML/markdown */
export function extractVariables(html: string): string[] {
  const re = /\{\{\s*([\w_]+)\s*\}\}/g;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) set.add(m[1]);
  return Array.from(set);
}

/** Variáveis usadas que NÃO existem no catálogo */
export function findUnknownVariables(html: string): string[] {
  return extractVariables(html).filter(k => !VARIABLE_KEYS.has(k));
}

// ============== RESOLVER ==============

export interface ResolveContext {
  /** Quando definido, busca dados reais do profissional */
  profissionalId?: string | null;
  /** Quando definido, busca dados reais do plantão */
  shiftId?: string | null;
  /** Quando definido, busca dados reais da troca */
  swapId?: string | null;
  /** Mês/ano para escalas (1-12 e ano completo) */
  mes?: number | null;
  ano?: number | null;
  /** Unidade/setor para contexto manual */
  unidadeId?: string | null;
  setorId?: string | null;
  /** Permitir resolver dados sensíveis (CNS) — somente managers */
  allowSensitive?: boolean;
  /** Observações para escala */
  observacoesEscala?: string | null;
}

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function fmtDate(s?: string | Date | null): string {
  if (!s) return '';
  const d = typeof s === 'string' ? new Date(s + (s.length === 10 ? 'T00:00:00' : '')) : s;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
}
function fmtTime(s?: string | null): string {
  if (!s) return '';
  return s.slice(0, 5);
}
function diaSemana(s?: string | null): string {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return DIAS_SEMANA[d.getDay()];
}

async function sha256Truncated(text: string): Promise<string> {
  try {
    const buf = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16).toUpperCase();
  } catch { return ''; }
}

function blocoCarimbo(nome?: string, conselho?: string, registro?: string, profissao?: string): string {
  const linhas = [nome, [conselho, registro].filter(Boolean).join(' '), profissao].filter(Boolean);
  return `<div style="text-align:center;font-family:Times,serif;border:1px dashed #888;padding:8px 12px;display:inline-block">${linhas.join('<br/>')}</div>`;
}
function blocoAssinatura(nome?: string, cargo?: string): string {
  return `<div style="margin-top:48px;text-align:center"><div style="border-top:1px solid #000;width:280px;margin:0 auto"></div><div style="margin-top:4px"><strong>${nome || '____________________'}</strong></div>${cargo ? `<div style="font-size:90%">${cargo}</div>` : ''}</div>`;
}

/** Renderiza a assinatura/carimbo personalizado armazenado em professional_stamps. */
async function blocoCarimboPersonalizado(profissionalId: string, fallback: { nome?: string; profissao?: string; conselho?: string; registro?: string }): Promise<{ assinatura?: string; carimbo?: string }> {
  try {
    const { data: stamp } = await supabase.from('professional_stamps' as any).select('*').eq('profissional_id', profissionalId).maybeSingle();
    if (!stamp) return {};
    const s: any = stamp;
    const align = s.assinatura_posicao || 'centro';
    const textAlign = align === 'esquerda' ? 'left' : align === 'direita' ? 'right' : 'center';

    let assinaturaImg = '';
    if (s.assinatura_path) {
      const { data: signed } = await supabase.storage.from('professional-documents').createSignedUrl(s.assinatura_path, 3600);
      if (signed?.signedUrl) {
        assinaturaImg = `<img src="${signed.signedUrl}" alt="assinatura" style="width:${s.assinatura_tamanho || 180}px;max-width:100%"/>`;
      }
    }
    let carimboImg = '';
    if (s.carimbo_path) {
      const { data: signed } = await supabase.storage.from('professional-documents').createSignedUrl(s.carimbo_path, 3600);
      if (signed?.signedUrl) {
        carimboImg = `<img src="${signed.signedUrl}" alt="carimbo" style="width:${s.carimbo_tamanho || 140}px;max-width:100%"/>`;
      }
    }

    const linhas: string[] = [];
    if (fallback.nome) linhas.push(`<strong>${fallback.nome}</strong>`);
    if (s.cargo) linhas.push(s.cargo);
    else if (fallback.profissao) linhas.push(fallback.profissao);
    if (s.mostrar_conselho && (fallback.conselho || fallback.registro)) linhas.push(`${fallback.conselho || ''} ${fallback.registro || ''}`.trim());
    if (s.mostrar_cbo && s.cbo) linhas.push(`CBO: ${s.cbo}`);
    if (s.mostrar_cns && s.cns) linhas.push(`CNS: ${s.cns}`);
    if (s.texto_personalizado) linhas.push(s.texto_personalizado);

    const cor = s.cor_texto || '#000';
    const linhasHtml = `<div style="color:${cor};font-family:Times,serif;font-size:13px;line-height:1.4">${linhas.join('<br/>')}</div>`;
    const linhaPontilhada = `<div style="border-top:1px solid #000;width:280px;margin:${align === 'centro' ? '4px auto' : (align === 'esquerda' ? '4px 0' : '4px 0 4px auto')}"></div>`;

    const assinaturaBlock = `<div style="margin-top:36px;text-align:${textAlign}">${assinaturaImg}${linhaPontilhada}${linhasHtml}${carimboImg ? `<div style="margin-top:6px">${carimboImg}</div>` : ''}</div>`;
    const carimboBlock = `<div style="text-align:${textAlign};display:inline-block;border:1px dashed #888;padding:8px 12px">${linhasHtml}${carimboImg ? `<div style="margin-top:6px">${carimboImg}</div>` : ''}</div>`;
    return { assinatura: assinaturaBlock, carimbo: carimboBlock };
  } catch { return {}; }
}

/**
 * Resolve as variáveis do catálogo a partir do contexto.
 * Variáveis sem dado retornam string vazia (regra: variáveis inexistentes ficam vazias).
 */
export async function resolveVariables(ctx: ResolveContext): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const now = new Date();

  // 1) Settings (instituição)
  try {
    const { data: settings } = await supabase.from('system_settings').select('key,value').in('key', ['hospital']);
    const hospital: any = settings?.find(s => s.key === 'hospital')?.value || {};
    out.instituicao_nome = hospital.nome || '';
    out.instituicao_cnpj = hospital.cnpj || '';
    out.instituicao_endereco = hospital.endereco || '';
  } catch { /* noop */ }

  out.sistema_nome = 'GestorPlantão';
  out.data_emissao = fmtDate(now);
  out.hora_emissao = now.toTimeString().slice(0, 5);

  // 2) Usuário emissor
  try {
    const { data: u } = await supabase.auth.getUser();
    if (u?.user?.id) {
      const { data: prof } = await supabase.from('profiles').select('nome,email').eq('user_id', u.user.id).maybeSingle();
      out.usuario_emissor = prof?.nome || u.user.email || '';
    }
  } catch { /* noop */ }

  // 3) Unidade/setor manual
  if (ctx.unidadeId) {
    const { data: un } = await supabase.from('units').select('nome,endereco').eq('id', ctx.unidadeId).maybeSingle();
    if (un) {
      out.unidade_nome = un.nome || '';
      out.unidade_endereco = un.endereco || '';
    }
  }
  if (ctx.setorId) {
    const { data: st } = await supabase.from('sectors').select('nome,unidade_id').eq('id', ctx.setorId).maybeSingle();
    if (st) {
      out.setor_nome = st.nome || '';
      if (!out.unidade_nome && st.unidade_id) {
        const { data: un } = await supabase.from('units').select('nome,endereco').eq('id', st.unidade_id).maybeSingle();
        if (un) { out.unidade_nome = un.nome || ''; out.unidade_endereco = un.endereco || ''; }
      }
    }
  }

  // 4) Profissional
  let profissional: any = null;
  if (ctx.profissionalId) {
    const cols = 'id,nome,profissao,especialidade,conselho,registro,documento_conselho,documento_numero';
    const { data } = await supabase.from('professionals').select(cols).eq('id', ctx.profissionalId).maybeSingle();
    profissional = data;
    if (profissional) {
      out.profissional_nome = profissional.nome || '';
      out.profissional_profissao = profissional.profissao || '';
      out.profissional_especialidade = profissional.especialidade || '';
      out.profissional_conselho = profissional.conselho || profissional.documento_conselho || '';
      out.profissional_registro = profissional.registro || profissional.documento_numero || '';
      out.profissional_cbo = '';
      // CNS é sensível — só preenche se autorizado e existir uma futura coluna; por ora vazio.
      out.profissional_cns = ctx.allowSensitive ? '' : '';
      out.profissional_carimbo = blocoCarimbo(out.profissional_nome, out.profissional_conselho, out.profissional_registro, out.profissional_profissao);
      out.profissional_assinatura_visual = blocoAssinatura(out.profissional_nome, out.profissional_profissao);
      // Sobrescreve com carimbo personalizado se existir
      const personalizado = await blocoCarimboPersonalizado(profissional.id, {
        nome: out.profissional_nome, profissao: out.profissional_profissao,
        conselho: out.profissional_conselho, registro: out.profissional_registro,
      });
      if (personalizado.assinatura) out.profissional_assinatura_visual = personalizado.assinatura;
      if (personalizado.carimbo) out.profissional_carimbo = personalizado.carimbo;
      out.assinatura_profissional = out.profissional_assinatura_visual;
      out.carimbo_profissional = out.profissional_carimbo;
    }
  }

  // 5) Plantão
  if (ctx.shiftId) {
    const { data: sh } = await supabase.from('shifts')
      .select('id,data,hora_inicio,hora_fim,tipo_plantao,status,carga_horaria,unidade_id,setor_id,profissional_id')
      .eq('id', ctx.shiftId).maybeSingle();
    if (sh) {
      out.plantao_data = fmtDate(sh.data);
      out.plantao_dia_semana = diaSemana(sh.data);
      out.plantao_horario = `${fmtTime(sh.hora_inicio)} às ${fmtTime(sh.hora_fim)}`;
      out.plantao_tipo = sh.tipo_plantao || '';
      out.plantao_status = sh.status || '';
      out.plantao_total_horas = String(sh.carga_horaria ?? '');

      if (sh.unidade_id) {
        const { data: un } = await supabase.from('units').select('nome').eq('id', sh.unidade_id).maybeSingle();
        out.plantao_unidade = un?.nome || '';
      }
      if (sh.setor_id) {
        const { data: st } = await supabase.from('sectors').select('nome').eq('id', sh.setor_id).maybeSingle();
        out.plantao_setor = st?.nome || '';
      }
      // Auto-resolver profissional do plantão se não foi passado
      if (!profissional && sh.profissional_id) {
        const { data: p } = await supabase.from('professionals')
          .select('nome,profissao,conselho,registro,especialidade')
          .eq('id', sh.profissional_id).maybeSingle();
        if (p) {
          out.profissional_nome = p.nome || '';
          out.profissional_profissao = p.profissao || '';
          out.profissional_conselho = p.conselho || '';
          out.profissional_registro = p.registro || '';
          out.profissional_especialidade = p.especialidade || '';
          out.profissional_carimbo = blocoCarimbo(p.nome, p.conselho, p.registro, p.profissao);
          out.profissional_assinatura_visual = blocoAssinatura(p.nome, p.profissao);
          const personalizado = await blocoCarimboPersonalizado(sh.profissional_id, {
            nome: p.nome, profissao: p.profissao, conselho: p.conselho, registro: p.registro,
          });
          if (personalizado.assinatura) out.profissional_assinatura_visual = personalizado.assinatura;
          if (personalizado.carimbo) out.profissional_carimbo = personalizado.carimbo;
          out.assinatura_profissional = out.profissional_assinatura_visual;
          out.carimbo_profissional = out.profissional_carimbo;
        }
      }
    }
  }

  // 6) Escala
  if (ctx.mes && ctx.ano) {
    out.escala_mes = MESES[(ctx.mes - 1)] || String(ctx.mes);
    out.escala_ano = String(ctx.ano);
    const ini = new Date(ctx.ano, ctx.mes - 1, 1);
    const fim = new Date(ctx.ano, ctx.mes, 0);
    out.escala_periodo = `${fmtDate(ini)} a ${fmtDate(fim)}`;

    // Totais reais (filtra por unidade/setor/profissional se houver)
    let q = supabase.from('shifts').select('id,carga_horaria', { count: 'exact' })
      .gte('data', `${ctx.ano}-${String(ctx.mes).padStart(2, '0')}-01`)
      .lte('data', `${ctx.ano}-${String(ctx.mes).padStart(2, '0')}-${String(fim.getDate()).padStart(2, '0')}`);
    if (ctx.unidadeId) q = q.eq('unidade_id', ctx.unidadeId);
    if (ctx.setorId) q = q.eq('setor_id', ctx.setorId);
    if (ctx.profissionalId) q = q.eq('profissional_id', ctx.profissionalId);
    const { data: rows, count } = await q;
    out.escala_total_plantoes = String(count ?? rows?.length ?? 0);
    out.escala_total_horas = String((rows || []).reduce((s, r: any) => s + Number(r.carga_horaria || 0), 0));
  }
  out.escala_legenda = 'D = Diurno · N = Noturno · 12 = 12h · 24 = 24h · SA = Sobreaviso · F = Folga';
  out.escala_tabela_mensal = '<!-- A tabela mensal é renderizada na exportação Escala Mensal Oficial -->';
  out.escala_observacoes = ctx.observacoesEscala || '';

  // 7) Troca
  if (ctx.swapId) {
    const { data: sw } = await supabase.from('shift_swaps')
      .select('id,solicitante_id,destinatario_id,motivo,status,aprovado_em,rejeitado_em,shift_id,shift_id_destino')
      .eq('id', ctx.swapId).maybeSingle();
    if (sw) {
      out.troca_motivo = sw.motivo || '';
      out.troca_status = sw.status || '';
      out.troca_data_aprovacao = fmtDate(sw.aprovado_em || sw.rejeitado_em);

      if (sw.solicitante_id) {
        const { data: p } = await supabase.from('professionals').select('nome').eq('id', sw.solicitante_id).maybeSingle();
        out.troca_solicitante = p?.nome || '';
      }
      if (sw.destinatario_id) {
        const { data: p } = await supabase.from('professionals').select('nome').eq('id', sw.destinatario_id).maybeSingle();
        out.troca_substituto = p?.nome || '';
      }
      if (sw.shift_id) {
        const { data: sh } = await supabase.from('shifts').select('data,hora_inicio,hora_fim,unidade_id,setor_id').eq('id', sw.shift_id).maybeSingle();
        if (sh) {
          out.troca_data = fmtDate(sh.data);
          out.troca_horario = `${fmtTime(sh.hora_inicio)} às ${fmtTime(sh.hora_fim)}`;
          if (sh.unidade_id) {
            const { data: un } = await supabase.from('units').select('nome').eq('id', sh.unidade_id).maybeSingle();
            out.troca_unidade = un?.nome || '';
          }
          if (sh.setor_id) {
            const { data: st } = await supabase.from('sectors').select('nome').eq('id', sh.setor_id).maybeSingle();
            out.troca_setor = st?.nome || '';
          }
        }
      }
      // Histórico
      const { data: hist } = await supabase.from('swap_history')
        .select('acao,usuario,detalhes,created_at')
        .eq('swap_id', sw.id).order('created_at', { ascending: true });
      if (hist?.length) {
        out.troca_historico = '<ul style="margin:0;padding-left:18px">' +
          hist.map((h: any) => `<li>${fmtDate(h.created_at)} ${new Date(h.created_at).toLocaleTimeString('pt-BR').slice(0,5)} — <strong>${h.acao}</strong> por ${h.usuario}${h.detalhes ? ` (${h.detalhes})` : ''}</li>`).join('') +
          '</ul>';
        // Responsável aprovação = último user da ação aprovada/recusada
        const dec = [...hist].reverse().find((h: any) => /aprov|recus/i.test(h.acao));
        if (dec) out.troca_responsavel_aprovacao = (dec as any).usuario || '';
      }
    }
  }

  // 8) Assinaturas coordenador / gestor — usam usuário autenticado se ele tiver o role
  try {
    const { data: u } = await supabase.auth.getUser();
    if (u?.user?.id) {
      const { data: prof } = await supabase.from('profiles').select('nome,role').eq('user_id', u.user.id).maybeSingle();
      if (prof) {
        if (prof.role === 'coordenador') {
          out.assinatura_coordenador = blocoAssinatura(prof.nome, 'Coordenador');
          out.carimbo_coordenador = blocoCarimbo(prof.nome, undefined, undefined, 'Coordenador');
        }
        if (prof.role === 'gestor_master') {
          out.assinatura_gestor_master = blocoAssinatura(prof.nome, 'Gestor Master');
          out.carimbo_gestor_master = blocoCarimbo(prof.nome, undefined, undefined, 'Gestor Master');
        }
      }
    }
  } catch { /* noop */ }

  // 9) Hash + código de validação
  const baseHash = `${ctx.profissionalId || ''}|${ctx.shiftId || ''}|${ctx.swapId || ''}|${out.data_emissao}|${out.hora_emissao}`;
  out.hash_documento = await sha256Truncated(baseHash);
  out.codigo_validacao = (out.hash_documento || '').slice(0, 8);
  // QR aponta para futura rota de validação. Usa quickchart como gerador estável (pode ser trocado).
  const validateUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/validar/${out.codigo_validacao}`;
  out.qr_code_validacao = out.codigo_validacao
    ? `<img alt="QR ${out.codigo_validacao}" src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(validateUrl)}" style="width:96px;height:96px"/>`
    : '';

  // Garante que TODAS as variáveis do catálogo existem (ainda que vazias)
  for (const v of VARIABLE_CATALOG) {
    if (!(v.key in out)) out[v.key] = '';
  }
  return out;
}

/** Amostras determinísticas para preview sem contexto real */
export function getSampleVariables(): Record<string, string> {
  const now = new Date();
  const out: Record<string, string> = {};
  for (const v of VARIABLE_CATALOG) out[v.key] = v.example || `[${v.label}]`;
  out.data_emissao = fmtDate(now);
  out.hora_emissao = now.toTimeString().slice(0, 5);
  out.sistema_nome = 'GestorPlantão';
  out.escala_legenda = 'D = Diurno · N = Noturno · 12 = 12h · 24 = 24h · SA = Sobreaviso · F = Folga';
  out.profissional_carimbo = blocoCarimbo('[Nome]', 'CRM', '12345', 'Médico');
  out.profissional_assinatura_visual = blocoAssinatura('[Nome do profissional]', 'Médico');
  return out;
}
