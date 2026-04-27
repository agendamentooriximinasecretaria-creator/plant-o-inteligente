import { QueryClient } from "@tanstack/react-query";

/**
 * Invalida todas as queries afetadas por mudanças em plantões/trocas.
 * Cobre dashboard, escala, profissionais, relatórios e auditoria.
 */
export function invalidateCrossShifts(qc: QueryClient) {
  // Chaves explícitas
  qc.invalidateQueries({ queryKey: ["shifts"] });
  qc.invalidateQueries({ queryKey: ["swaps"] });
  qc.invalidateQueries({ queryKey: ["professionals"] });
  qc.invalidateQueries({ queryKey: ["professionals-month-shifts"] });
  qc.invalidateQueries({ queryKey: ["shifts-report"] });
  qc.invalidateQueries({ queryKey: ["swaps-report"] });
  // Prefixos (dashboard-*, audit-logs-*)
  qc.invalidateQueries({
    predicate: (q) => {
      const k = q.queryKey?.[0];
      if (typeof k !== "string") return false;
      return k.startsWith("dashboard-") || k.startsWith("audit-logs") || k.startsWith("professional-");
    },
  });
}

export function invalidateCrossSwaps(qc: QueryClient) {
  // Trocas afetam plantões + dashboards + auditoria
  invalidateCrossShifts(qc);
  qc.invalidateQueries({ queryKey: ["swap-histories"] });
}
