import { useState, useMemo } from "react";
import { addDays, startOfWeek, format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";

/* ── Style map per sigla (uses semantic tokens where possible) ── */
const SIGLA_STYLES: Record<string, string> = {
  D:  "bg-info/15 text-info",
  N:  "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  M:  "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  T:  "bg-success/15 text-success",
  No: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  "24": "bg-destructive/10 text-destructive",
  SA: "bg-warning/15 text-warning",
  F:  "bg-muted text-muted-foreground",
};

export interface GridShift {
  id: string;
  sigla: string;
  tipo: string;
  horario: string;
  setor: string;
  status: string;
  hasConflict?: boolean;
}

export interface ProfRow {
  id: string;
  nome: string;
  profissao: string;
  escala: Record<string, GridShift[]>; // key = "yyyy-MM-dd"
}

interface WeeklyGridProps {
  profissionais: ProfRow[];
  coberturaMinima: number;
  onCellClick: (profId: string, dateStr: string, shift: GridShift | null) => void;
  onCreateClick: (dateStr: string) => void;
}

export function WeeklyGrid({
  profissionais,
  coberturaMinima,
  onCellClick,
  onCreateClick,
}: WeeklyGridProps) {
  const [baseDate, setBaseDate] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(baseDate, i)),
    [baseDate]
  );

  const coberturaPorDia = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of days) {
      const key = format(d, "yyyy-MM-dd");
      const ids = new Set<string>();
      for (const p of profissionais) {
        const shifts = p.escala[key];
        if (shifts?.some(s => s.sigla !== "F")) ids.add(p.id);
      }
      map[key] = ids.size;
    }
    return map;
  }, [days, profissionais]);

  const initials = (nome: string) =>
    nome
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0])
      .join("")
      .toUpperCase();

  return (
    <div className="space-y-3">
      {/* Nav header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setBaseDate(d => addDays(d, -7))}
          className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm text-muted-foreground flex-1 text-center font-medium">
          {format(days[0], "dd/MM", { locale: ptBR })} –{" "}
          {format(days[6], "dd/MM/yyyy", { locale: ptBR })}
        </span>
        <button
          onClick={() => setBaseDate(d => addDays(d, 7))}
          className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => setBaseDate(startOfWeek(new Date(), { weekStartsOn: 0 }))}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
        >
          Hoje
        </button>
      </div>

      {/* Grid table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="table-header text-xs">
              <th className="text-left px-3 py-2.5 w-40 min-w-[140px]">Profissional</th>
              {days.map(d => {
                const today = isToday(d);
                return (
                  <th
                    key={d.toISOString()}
                    className={`px-2 py-2.5 text-center font-medium min-w-[90px] ${
                      today ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <span className="capitalize">
                      {format(d, "EEE", { locale: ptBR })}
                    </span>
                    <br />
                    <span className="font-normal text-muted-foreground">
                      {format(d, "dd/MM")}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {profissionais.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="p-8 text-center text-muted-foreground"
                >
                  Nenhum profissional com plantão nesta semana.
                </td>
              </tr>
            )}

            {profissionais.map(prof => (
              <tr
                key={prof.id}
                className="border-t border-border hover:bg-muted/30 transition-colors"
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                      {initials(prof.nome)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-xs text-foreground truncate">
                        {prof.nome}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {prof.profissao}
                      </p>
                    </div>
                  </div>
                </td>

                {days.map(d => {
                  const key = format(d, "yyyy-MM-dd");
                  const shifts = prof.escala[key] ?? [];
                  const today = isToday(d);

                  return (
                    <td
                      key={key}
                      className={`px-1 py-1.5 text-center align-top ${
                        today ? "bg-primary/5" : ""
                      }`}
                    >
                      {shifts.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {shifts.map(s => (
                            <button
                              key={s.id}
                              onClick={() => onCellClick(prof.id, key, s)}
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold truncate transition-opacity hover:opacity-80 flex items-center justify-center gap-1 ${
                                s.hasConflict ? "ring-1 ring-destructive bg-destructive/10 text-destructive" :
                                (SIGLA_STYLES[s.sigla] ?? "bg-muted text-muted-foreground")
                              }`}
                              title={`${s.tipo} · ${s.horario} · ${s.setor}${s.hasConflict ? ' · CONFLITO DETECTADO' : ''}`}
                            >
                              {s.hasConflict && <AlertTriangle className="h-2.5 w-2.5 shrink-0" />}
                              {s.sigla}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={() => onCreateClick(key)}
                          className="w-6 h-6 mx-auto rounded border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors inline-flex items-center justify-center text-muted-foreground hover:text-primary text-[10px]"
                          title="Criar plantão"
                        >
                          +
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Coverage row */}
            <tr className="border-t border-border bg-muted/30">
              <td className="px-3 py-2 text-xs font-medium text-muted-foreground">
                Cobertura
              </td>
              {days.map(d => {
                const key = format(d, "yyyy-MM-dd");
                const atual = coberturaPorDia[key] ?? 0;
                const min = coberturaMinima || 2;
                const pct = Math.min(100, Math.round((atual / min) * 100));
                const barColor =
                  atual >= min
                    ? "bg-success"
                    : atual >= min * 0.5
                    ? "bg-warning"
                    : "bg-destructive";

                return (
                  <td key={key} className="px-2 py-2 text-center">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {atual}/{min}
                    </span>
                    <div className="h-1.5 bg-muted rounded-full mt-1 mx-1">
                      <div
                        className={`h-1.5 rounded-full transition-all ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
