import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type TableName =
  | "shifts"
  | "shift_swaps"
  | "notifications"
  | "audit_logs"
  | "professionals"
  | "sectors"
  | "units"
  | "swap_history"
  | "censo_pacientes"
  | "setor_ocupacao";

interface Subscription {
  /** Tabelas a observar via Supabase Realtime. */
  tables: TableName[];
  /** queryKeys (raízes) que devem ser invalidados quando algum evento chegar. */
  invalidate: (string | (string | undefined)[])[];
  /** Janela de debounce (ms). Default 400ms para evitar refetch em rajada. */
  debounceMs?: number;
  /** Identificador opcional do canal (precisa ser único por mount). */
  channelId?: string;
}

/**
 * Assina mudanças em uma ou mais tabelas via Supabase Realtime e invalida
 * queries do React Query com debounce, evitando refetch repetido em rajadas.
 *
 * Uso:
 *   useRealtimeInvalidation({
 *     tables: ['shifts','shift_swaps'],
 *     invalidate: [['dashboard'], ['shifts'], ['reports']],
 *   });
 */
export function useRealtimeInvalidation(sub: Subscription) {
  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subRef = useRef(sub);
  subRef.current = sub;

  useEffect(() => {
    const debounceMs = sub.debounceMs ?? 400;
    const channelName =
      sub.channelId ?? `rt-${sub.tables.join("-")}-${Math.random().toString(36).slice(2, 8)}`;

    const triggerInvalidate = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        for (const key of subRef.current.invalidate) {
          const queryKey = Array.isArray(key) ? key.filter(Boolean) : [key];
          qc.invalidateQueries({ queryKey });
        }
      }, debounceMs);
    };

    let channel: any = supabase.channel(channelName);
    for (const t of sub.tables) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: t },
        triggerInvalidate,
      );
    }
    channel.subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub.tables.join("|")]);
}
