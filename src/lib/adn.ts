import { calculateAdicionalNoturno } from "@/lib/utils";
import type { AdnConfig } from "@/components/AdnSettingsManager";

/** Modo de geração de ADN definido no cadastro do Tipo de Plantão. */
export type AdnModo = 'nunca' | 'auto' | 'sempre';

export const ADN_MODO_OPTIONS: { value: AdnModo; label: string; hint: string }[] = [
  { value: 'nunca', label: 'Nunca gerar ADN', hint: 'Ignora o tipo no cálculo, mesmo cruzando a madrugada (ex.: Feriado, Folga, Sobreaviso).' },
  { value: 'auto', label: 'Automático pelo horário', hint: 'Soma apenas as horas dentro da faixa noturna configurada.' },
  { value: 'sempre', label: 'Sempre gerar ADN', hint: 'Considera o plantão inteiro como noturno.' },
];

/** Normaliza o modo a partir do tipo (compatível com registros antigos). */
export function normalizeAdnModo(t?: { adn_modo?: string | null; gera_adicional_noturno?: boolean | null } | null): AdnModo {
  const m = t?.adn_modo;
  if (m === 'nunca' || m === 'auto' || m === 'sempre') return m;
  return t?.gera_adicional_noturno ? 'auto' : 'nunca';
}

export interface CalcAdnInput {
  hora_inicio?: string;
  hora_fim?: string;
  carga?: number;
  tipo_plantao?: string;
  adn_modo?: AdnModo | string | null;
  adnConfig?: AdnConfig;
}

/**
 * Fonte única de cálculo de ADN por plantão.
 * Retorna o valor a somar (horas, quantidade de plantões ou valor fixo, conforme config).
 */
export function calcularAdnPlantao({ hora_inicio, hora_fim, carga = 0, tipo_plantao, adn_modo, adnConfig }: CalcAdnInput): number {
  if (carga <= 0) return 0;

  const modo = normalizeAdnModo({ adn_modo: adn_modo as string | null | undefined });
  if (modo === 'nunca') return 0;

  // Filtro opcional por tipos de plantão nas configurações administrativas
  if (adnConfig?.shift_types?.length && (!tipo_plantao || !adnConfig.shift_types.includes(tipo_plantao))) {
    return 0;
  }

  const start = adnConfig?.start_time || "23:00";
  const end = adnConfig?.end_time || "07:00";

  const horasNoturnas = modo === 'sempre'
    ? carga
    : calculateAdicionalNoturno(hora_inicio, hora_fim, start, end);

  const tipoCalc = adnConfig?.calculation_type || 'hours';

  if (tipoCalc === 'hours') return horasNoturnas;
  if (tipoCalc === 'shifts') return horasNoturnas > 0 ? 1 : 0;
  if (tipoCalc === 'fixed_per_shift') return horasNoturnas > 0 ? (adnConfig?.fixed_value || 0) : 0;
  return 0; // fixed_total é aplicado depois, por profissional
}

export interface ElegibilidadeInput {
  /** Valor puro do cadastro do profissional. */
  recebeAdn?: boolean | null;
  /** Critério adicional: flag is_plantonista ou cargo "plantonista". */
  plantonista?: boolean;
  cargo?: string | null;
  profissao?: string | null;
  setor?: string | null;
  adnConfig?: AdnConfig;
}

const norm = (v?: string | null) =>
  (v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();

/** Elegibilidade ao ADN. O desmarcado no cadastro do profissional é veto absoluto. */
export function isElegivelAdn({ recebeAdn, plantonista, cargo, profissao, setor, adnConfig }: ElegibilidadeInput): boolean {
  // Veto absoluto: profissional explicitamente desmarcado nunca recebe ADN
  if (recebeAdn === false) return false;

  if (adnConfig && adnConfig.enabled) {
    const byFlag = !!adnConfig.eligibility.by_flag && (!!recebeAdn || !!plantonista);
    const byRole = !!adnConfig.eligibility.by_role && (adnConfig.eligibility.roles || []).some(r => norm(r) === norm(cargo));
    const byProfession = !!adnConfig.eligibility.by_profession && (adnConfig.eligibility.professions || []).includes(profissao || '');
    const bySector = !!adnConfig.eligibility.by_sector && (adnConfig.eligibility.sectors || []).includes(setor || '');
    return byFlag || byRole || byProfession || bySector;
  }

  if (!adnConfig) return !!recebeAdn || !!plantonista;
  return false;
}
