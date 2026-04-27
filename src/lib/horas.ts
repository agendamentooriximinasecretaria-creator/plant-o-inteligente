/**
 * Fonte única de verdade para cálculo de horas dos profissionais.
 *
 * Regras de negócio (alinhadas em todo o sistema):
 *  - Plantões com status 'cancelado' NÃO contam (nem realizado, nem previsto).
 *  - Plantões com tipo_plantao 'folga' ou 'indisponibilidade' NÃO contam como hora trabalhada.
 *  - Plantão marcado como falta (faltou=true) NÃO conta como realizado.
 *  - Carga horária usada é sempre o campo `carga_horaria` já calculado (que respeita
 *    o tipo do plantão, inclusive sobreaviso).
 *  - Trocas aprovadas/concluídas atualizam `profissional_id` no próprio plantão,
 *    portanto a soma por `profissional_id` reflete automaticamente o titular correto.
 *  - Trocas recusadas/canceladas não alteram `profissional_id`, logo a soma permanece.
 *  - Realizado = plantões com data <= hoje (que já ocorreram ou ocorrem hoje).
 *  - Previsto = plantões com data > hoje (futuros).
 *  - Mês = soma de realizado + previsto dentro do mês.
 *  - Semana = janela de segunda a domingo contendo a data de referência.
 */

export interface ShiftLike {
  profissional_id?: string;
  setor_id?: string | null;
  data: string;                 // 'YYYY-MM-DD'
  carga_horaria: number | string;
  status?: string | null;       // 'confirmado' | 'realizado' | 'cancelado' | ...
  tipo_plantao?: string | null; // 'regular' | 'folga' | 'indisponibilidade' | 'sobreaviso' | ...
  faltou?: boolean | null;
}

const NAO_CONTABILIZAVEIS_TIPO = new Set(['folga', 'indisponibilidade']);

const todayStr = (ref?: Date): string => {
  const d = ref ?? new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Determina se um plantão é "contabilizável" como hora de trabalho. */
export function isPlantaoContabilizavel(s: ShiftLike): boolean {
  if (!s) return false;
  if ((s.status || '').toLowerCase() === 'cancelado') return false;
  const tipo = (s.tipo_plantao || '').toLowerCase();
  if (NAO_CONTABILIZAVEIS_TIPO.has(tipo)) return false;
  return true;
}

const toNum = (v: number | string | null | undefined) => Number(v || 0);

/** Soma carga_horaria de uma lista de plantões já filtrados como contabilizáveis. */
function somar(shifts: ShiftLike[]): number {
  return shifts.reduce((acc, s) => acc + toNum(s.carga_horaria), 0);
}

/** Filtra plantões contabilizáveis de um profissional específico (opcional). */
function filtrarBase(shifts: ShiftLike[], profissionalId?: string): ShiftLike[] {
  return shifts.filter(s => {
    if (!isPlantaoContabilizavel(s)) return false;
    if (profissionalId && s.profissional_id !== profissionalId) return false;
    return true;
  });
}

/** Total de horas de um profissional em um conjunto arbitrário de plantões. */
export function calcularHorasProfissional(shifts: ShiftLike[], profissionalId?: string): number {
  return somar(filtrarBase(shifts, profissionalId));
}

/** Horas no mês indicado por `monthPrefix` ('YYYY-MM'). Se omitido, usa mês atual. */
export function calcularHorasMes(shifts: ShiftLike[], profissionalId?: string, monthPrefix?: string): number {
  const prefix = monthPrefix ?? todayStr().substring(0, 7);
  const list = filtrarBase(shifts, profissionalId).filter(s => s.data.startsWith(prefix));
  return somar(list);
}

/** Horas na semana (segunda a domingo) que contém `refDate`. */
export function calcularHorasSemana(shifts: ShiftLike[], profissionalId?: string, refDate?: Date): number {
  const ref = refDate ?? new Date();
  const dow = ref.getDay();             // 0=dom
  const diffToMon = (dow + 6) % 7;
  const ini = new Date(ref); ini.setDate(ref.getDate() - diffToMon); ini.setHours(0, 0, 0, 0);
  const fim = new Date(ini); fim.setDate(ini.getDate() + 6); fim.setHours(23, 59, 59, 999);
  const iniStr = todayStr(ini);
  const fimStr = todayStr(fim);
  const list = filtrarBase(shifts, profissionalId).filter(s => s.data >= iniStr && s.data <= fimStr);
  return somar(list);
}

/**
 * Horas REALIZADAS: plantões já cumpridos (data <= hoje), excluindo faltas confirmadas.
 * Considera também `status='realizado'` quando presente.
 */
export function calcularHorasRealizadas(shifts: ShiftLike[], profissionalId?: string, monthPrefix?: string): number {
  const hoje = todayStr();
  const list = filtrarBase(shifts, profissionalId).filter(s => {
    if (s.faltou === true) return false;
    if (monthPrefix && !s.data.startsWith(monthPrefix)) return false;
    return s.data <= hoje;
  });
  return somar(list);
}

/** Horas PREVISTAS: plantões futuros (data > hoje). */
export function calcularHorasPrevistas(shifts: ShiftLike[], profissionalId?: string, monthPrefix?: string): number {
  const hoje = todayStr();
  const list = filtrarBase(shifts, profissionalId).filter(s => {
    if (monthPrefix && !s.data.startsWith(monthPrefix)) return false;
    return s.data > hoje;
  });
  return somar(list);
}

/** Distribuição de horas por setor_id em um conjunto de plantões. */
export function calcularHorasPorSetor(shifts: ShiftLike[], profissionalId?: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of filtrarBase(shifts, profissionalId)) {
    const k = s.setor_id || 'sem_setor';
    out[k] = (out[k] || 0) + toNum(s.carga_horaria);
  }
  return out;
}

/**
 * Percentual de carga em relação a um limite (default 220h CLT mensal).
 * Útil para barras de progresso. Retorna valor entre 0 e 100.
 */
export function calcularCargaPercentual(horas: number, limite: number = 220): number {
  if (limite <= 0) return 0;
  return Math.min(100, (horas / limite) * 100);
}

/** Soma horas por profissional (usado em listagens com vários profissionais). */
export function calcularHorasPorProfissional(shifts: ShiftLike[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of shifts) {
    if (!isPlantaoContabilizavel(s) || !s.profissional_id) continue;
    out[s.profissional_id] = (out[s.profissional_id] || 0) + toNum(s.carga_horaria);
  }
  return out;
}

export const CLT_LIMITE_MENSAL = 220;
