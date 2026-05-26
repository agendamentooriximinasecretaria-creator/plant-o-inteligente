import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calcula as horas de Adicional Noturno (ADN) em um plantão.
 * Regra: Horas entre 23:00 e 07:00.
 */
export function calculateAdicionalNoturno(horaInicio?: string, horaFim?: string): number {
  if (!horaInicio || !horaFim) return 0;

  const toMinutes = (h: string) => {
    const [hrs, mins] = h.split(':').map(Number);
    if (isNaN(hrs)) return 0;
    return hrs * 60 + (mins || 0);
  };

  let start = toMinutes(horaInicio);
  let end = toMinutes(horaFim);

  // Se o fim é menor ou igual ao início, o plantão atravessa a meia-noite
  if (end <= start) {
    end += 24 * 60;
  }

  // Intervalos de ADN em minutos relativos ao início do dia 0:
  // 1. 23:00 do dia anterior até 07:00 do dia atual
  // 2. 23:00 do dia atual até 07:00 do dia seguinte
  // 3. 23:00 do dia seguinte até 07:00 do dia posterior (para plantões longos)
  const adnRanges = [
    { s: -60, e: 420 },       // -1:00 (23:00 prev) até 7:00
    { s: 1380, e: 1860 },     // 23:00 até 31:00 (7:00 next)
    { s: 2820, e: 3300 }      // 47:00 até 55:00 (7:00 after next)
  ];

  let totalAdnMinutes = 0;
  for (const range of adnRanges) {
    const overlapStart = Math.max(start, range.s);
    const overlapEnd = Math.min(end, range.e);
    if (overlapStart < overlapEnd) {
      totalAdnMinutes += (overlapEnd - overlapStart);
    }
  }

  // Retorna o total em horas (decimais)
  return totalAdnMinutes / 60;
}

