import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calcula as horas de Adicional Noturno (ADN) em um plantão.
 * Regra: Horas entre 23:00 e 07:00.
 */
export function calculateAdicionalNoturno(
  horaInicio?: string, 
  horaFim?: string, 
  adnStart: string = "23:00", 
  adnEnd: string = "07:00"
): number {
  if (!horaInicio || !horaFim) return 0;

  const toMinutes = (h: string) => {
    if (!h) return 0;
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

  const sMin = toMinutes(adnStart);
  let eMin = toMinutes(adnEnd);

  // Se o fim da faixa ADN é menor ou igual ao início, atravessa a meia-noite
  // Ex: 22:00 até 05:00
  if (eMin <= sMin) {
    eMin += 24 * 60;
  }

  // Definimos intervalos de ADN em janelas de 24h para cobrir plantões longos
  // Cobrimos o dia anterior, o atual e o próximo para garantir captura total.
  const adnRanges = [
    { s: sMin - 24 * 60, e: eMin - 24 * 60 }, // Dia anterior
    { s: sMin, e: eMin },                   // Dia atual
    { s: sMin + 24 * 60, e: eMin + 24 * 60 }, // Dia seguinte
    { s: sMin + 48 * 60, e: eMin + 48 * 60 }  // Dia posterior
  ];

  let totalAdnMinutes = 0;
  for (const range of adnRanges) {
    const overlapStart = Math.max(start, range.s);
    const overlapEnd = Math.min(end, range.e);
    if (overlapStart < overlapEnd) {
      totalAdnMinutes += (overlapEnd - overlapStart);
    }
  }

  return totalAdnMinutes / 60;
}

