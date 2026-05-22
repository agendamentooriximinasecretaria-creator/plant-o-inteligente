import { useMemo, useState, memo } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertTriangle } from "lucide-react";

export interface MonthlyShift {
  id: string;
  profissional_id: string;
  profissional_nome: string;
  profissao?: string;
  unidade_nome?: string;
  setor_nome?: string;
  data: string; // YYYY-MM-DD
  tipo_plantao?: string;
  hora_inicio?: string;
  hora_fim?: string;
  carga_horaria?: number;
  status?: string;
}

export interface TipoPlantaoLegenda {
  value: string;
  sigla: string;
  start?: string;
  end?: string;
  carga?: number;
}

interface Props {
  shifts: MonthlyShift[];
  tipos: TipoPlantaoLegenda[];
  /** Mês de referência YYYY-MM. Se não informado, usa o mês atual. */
  initialMonth?: string;
}

const DIA_SEMANA_ABREV = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

// Categorização por tipo de plantão -> classe de cor (suave)
function categoryFromTipo(tipo: string): "diurno" | "noturno" | "manha" | "tarde" | "24h" | "sobreaviso" | "folga" | "ferias" | "lp" | "atestado" | "outro" {
  const t = (tipo || "").toLowerCase();
  if (t.includes("férias") || t.includes("ferias")) return "ferias";
  if (t.includes("licença") || t.includes("licenca") || t.includes("lp")) return "lp";
  if (t.includes("atestado")) return "atestado";
  if (t.includes("folga") || t.includes("indispon")) return "folga";
  if (t.includes("sobreaviso")) return "sobreaviso";
  if (t.includes("24")) return "24h";
  if (t.includes("manh")) return "manha";
  if (t.includes("tarde")) return "tarde";
  if (t.includes("not")) return "noturno";
  if (t.includes("diurn")) return "diurno";
  return "outro";
}

const CAT_CLASS: Record<string, string> = {
  diurno: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-900",
  noturno: "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300 border-violet-200 dark:border-violet-900",
  manha: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  tarde: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-900",
  "24h": "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  sobreaviso: "bg-slate-200 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 border-slate-300 dark:border-slate-700",
  folga: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 border-orange-200 dark:border-orange-900",
  ferias: "bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200 dark:border-teal-900",
  lp: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900",
  atestado: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-900",
  outro: "bg-muted text-foreground border-border",
};

const STATUS_OVERLAY: Record<string, string> = {
  cancelado: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-900 line-through opacity-80",
  pendente: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900",
};

function getCellClass(tipo: string, status: string) {
  if (status === "cancelado") return STATUS_OVERLAY.cancelado;
  if (status === "pendente") return STATUS_OVERLAY.pendente;
  return CAT_CLASS[categoryFromTipo(tipo)] || CAT_CLASS.outro;
}

// Sigla heurística quando o tipo não está cadastrado
function siglaFallback(tipo: string): string {
  const cat = categoryFromTipo(tipo);
  switch (cat) {
    case "diurno": return "D";
    case "noturno": return "N";
    case "manha": return "M";
    case "tarde": return "T";
    case "24h": return "24";
    case "sobreaviso": return "SA";
    case "folga": return "F";
    case "ferias": return "FE";
    case "lp": return "LP";
    case "atestado": return "A";
    default: return (tipo?.[0] || "?").toUpperCase();
  }
}

export const MonthlyConsolidatedGrid = memo(function MonthlyConsolidatedGrid({ shifts, tipos, initialMonth }: Props) {
  const today = new Date();
  const defaultMonth = initialMonth || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [mes, setMes] = useState<string>(defaultMonth);

  const [year, monthIdx] = useMemo(() => {
    const [y, m] = mes.split("-").map(Number);
    return [y, m - 1];
  }, [mes]);

  const diasNoMes = useMemo(() => new Date(year, monthIdx + 1, 0).getDate(), [year, monthIdx]);
  const dias = useMemo(() => Array.from({ length: diasNoMes }, (_, i) => i + 1), [diasNoMes]);

  const tipoToSigla = (tipo?: string) => {
    if (!tipo) return "?";
    const found = tipos.find((t) => t.value === tipo);
    return found?.sigla || siglaFallback(tipo);
  };

  // Agrupa por Unidade -> Setor -> Profissão -> Profissional (filtra apenas o mês exibido)
  const groupedData = useMemo(() => {
    type ProfRow = { id: string; nome: string; profissao?: string; porDia: Map<number, MonthlyShift[]>; horas: number };
    const tree = new Map<string, Map<string, Map<string, Map<string, ProfRow>>>>();

    for (const s of shifts) {
      if (!s.data) continue;
      const [y, m, d] = s.data.split("-").map(Number);
      if (y !== year || m - 1 !== monthIdx) continue;

      const unidade = s.unidade_nome || "Unidade não informada";
      const setor = s.setor_nome || "Setor não informado";
      const profissao = s.profissao || "Outras Profissões";
      const profId = s.profissional_id;

      if (!tree.has(unidade)) tree.set(unidade, new Map());
      const unidadeMap = tree.get(unidade)!;

      if (!unidadeMap.has(setor)) unidadeMap.set(setor, new Map());
      const setorMap = unidadeMap.get(setor)!;

      if (!setorMap.has(profissao)) setorMap.set(profissao, new Map());
      const profissaoMap = setorMap.get(profissao)!;

      let row = profissaoMap.get(profId);
      if (!row) {
        row = { id: profId, nome: s.profissional_nome || "Sem nome", profissao: s.profissao, porDia: new Map(), horas: 0 };
        profissaoMap.set(profId, row);
      }

      const arr = row.porDia.get(d) || [];
      arr.push(s);
      row.porDia.set(d, arr);

      const carga = Number(s.carga_horaria || 0);
      if (s.status !== "cancelado" && !["folga", "indisponibilidade"].includes((s.tipo_plantao || "").toLowerCase())) {
        row.horas += carga;
      }
    }

    // Converte para array ordenado para renderização
    const result: { type: 'header-unidade' | 'header-setor' | 'header-profissao' | 'row', label?: string, row?: ProfRow, key: string }[] = [];

    const sortedUnidades = Array.from(tree.keys()).sort();
    for (const u of sortedUnidades) {
      result.push({ type: 'header-unidade', label: u, key: `u-${u}` });
      const unidadeMap = tree.get(u)!;
      const sortedSetores = Array.from(unidadeMap.keys()).sort();
      for (const s of sortedSetores) {
        result.push({ type: 'header-setor', label: s, key: `s-${u}-${s}` });
        const setorMap = unidadeMap.get(s)!;
        const sortedProfissoes = Array.from(setorMap.keys()).sort();
        for (const p of sortedProfissoes) {
          result.push({ type: 'header-profissao', label: p, key: `p-${u}-${s}-${p}` });
          const profissaoMap = setorMap.get(p)!;
          const sortedProfs = Array.from(profissaoMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));
          for (const row of sortedProfs) {
            result.push({ type: 'row', row, key: `r-${u}-${s}-${p}-${row.id}` });
          }
        }
      }
    }
    return result;
  }, [shifts, year, monthIdx]);

  const navMes = (delta: number) => {
    const d = new Date(year, monthIdx + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const mesLabel = new Date(year, monthIdx, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // Tipos efetivos para legenda (combina o que veio do banco com fallback se vazio)
  const legendaTipos = useMemo(() => {
    if (tipos.length > 0) return tipos;
    return [
      { value: "Diurno 12h", sigla: "D", start: "07:00", end: "19:00", carga: 12 },
      { value: "Noturno 12h", sigla: "N", start: "19:00", end: "07:00", carga: 12 },
      { value: "Manhã", sigla: "M", start: "07:00", end: "13:00", carga: 6 },
      { value: "Tarde", sigla: "T", start: "13:00", end: "19:00", carga: 6 },
      { value: "Plantão 24h", sigla: "24", start: "07:00", end: "07:00", carga: 24 },
      { value: "Sobreaviso", sigla: "SA", start: "00:00", end: "23:59", carga: 24 },
      { value: "Folga", sigla: "F", start: "", end: "", carga: 0 },
    ];
  }, [tipos]);

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-[var(--shadow-card)] overflow-hidden">
      {/* Cabeçalho com navegador de mês */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border/60">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-primary" />
          <h3 className="font-display font-semibold text-foreground capitalize">Escala Mensal Consolidada — {mesLabel}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => navMes(-1)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition" title="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="bg-background border border-input rounded-md px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring/40"
          />
          <button onClick={() => navMes(1)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition" title="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-muted/50 sticky top-0 z-10">
              <th className="text-left font-semibold text-foreground p-2 border-b border-border sticky left-0 bg-muted/80 backdrop-blur z-20 min-w-[180px]">
                Profissional
              </th>
              {dias.map((d) => {
                const dt = new Date(year, monthIdx, d);
                const dow = dt.getDay();
                const isFds = dow === 0 || dow === 6;
                return (
                  <th key={d} className={`p-1 border-b border-border text-center font-medium ${isFds ? "bg-muted text-muted-foreground" : "text-foreground"}`}>
                    <div className="text-[11px] leading-none">{d}</div>
                    <div className="text-[9px] mt-0.5 text-muted-foreground">{DIA_SEMANA_ABREV[dow]}</div>
                  </th>
                );
              })}
              <th className="text-center font-semibold text-foreground p-2 border-b border-border bg-muted/80 sticky right-0 z-20 min-w-[60px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {groupedData.length === 0 ? (
              <tr>
                <td colSpan={dias.length + 2} className="p-10 text-center text-muted-foreground text-sm">
                  Nenhum plantão encontrado para os filtros aplicados neste mês.
                </td>
              </tr>
            ) : (
              groupedData.map((item) => {
                if (item.type === 'header-unidade') {
                  return (
                    <tr key={item.key} className="bg-primary/5 print:bg-slate-100">
                      <td colSpan={dias.length + 2} className="p-2 border-b border-border font-bold text-[11px] text-primary uppercase tracking-wider">
                        Unidade: {item.label}
                      </td>
                    </tr>
                  );
                }
                if (item.type === 'header-setor') {
                  return (
                    <tr key={item.key} className="bg-muted/30 print:bg-slate-50">
                      <td colSpan={dias.length + 2} className="p-1.5 pl-4 border-b border-border font-bold text-[10px] text-foreground/80 uppercase">
                        Setor: {item.label}
                      </td>
                    </tr>
                  );
                }
                if (item.type === 'header-profissao') {
                  return (
                    <tr key={item.key} className="bg-muted/10 print:bg-white">
                      <td colSpan={dias.length + 2} className="p-1 pl-6 border-b border-border/60 font-semibold text-[9px] text-muted-foreground uppercase">
                        {item.label}
                      </td>
                    </tr>
                  );
                }

                const row = item.row!;
                return (
                  <tr key={item.key} className="border-b border-border/40 hover:bg-muted/30 transition-colors print:break-inside-avoid">
                    <td className="p-2 pl-8 sticky left-0 bg-card z-10 border-r border-border/60 print:relative print:bg-transparent">
                      <p className="font-medium text-foreground truncate max-w-[170px]" title={row.nome}>{row.nome}</p>
                      {row.profissao && <p className="text-[10px] text-muted-foreground truncate">{row.profissao}</p>}
                    </td>
                    {dias.map((d) => {
                      const lista = row.porDia.get(d) || [];
                      if (lista.length === 0) {
                        const dt = new Date(year, monthIdx, d);
                        const dow = dt.getDay();
                        const isFds = dow === 0 || dow === 6;
                        return <td key={d} className={`p-1 text-center align-middle ${isFds ? "bg-muted/30" : ""}`}>—</td>;
                      }
                      const siglas = lista.map((l) => tipoToSigla(l.tipo_plantao));
                      const hasConflict = lista.length > 1 && lista.some((s1, i) =>
                        lista.some((s2, j) =>
                          i !== j && s1.status !== 'cancelado' && s2.status !== 'cancelado' &&
                          (s1.hora_inicio || '00:00') < (s2.hora_fim || '23:59') && (s2.hora_inicio || '00:00') < (s1.hora_fim || '23:59')
                        )
                      );
                      const tipoBase = lista[0].tipo_plantao || "";
                      const statusBase = lista[0].status || "";
                      const cls = getCellClass(tipoBase, statusBase);
                      const tooltip = (hasConflict ? "⚠️ CONFLITO DE HORÁRIO\n" : "") + lista
                        .map((l) => `${l.tipo_plantao || "?"} ${(l.hora_inicio || "").slice(0, 5)}-${(l.hora_fim || "").slice(0, 5)}${l.status ? ` · ${l.status}` : ""}`)
                        .join("\n");
                      return (
                        <td key={d} className="p-0.5 text-center align-middle">
                          <div
                            className={`inline-flex items-center justify-center min-w-[26px] h-6 px-1 rounded border text-[10px] font-semibold gap-0.5 ${hasConflict ? 'ring-1 ring-destructive border-destructive bg-destructive/10 text-destructive' : cls}`}
                            title={tooltip}
                          >
                            {hasConflict && <AlertTriangle className="h-2.5 w-2.5 shrink-0" />}
                            {siglas.join("/")}
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-2 text-center font-semibold text-foreground sticky right-0 bg-card z-10 border-l border-border/60 print:relative print:bg-transparent">
                      {row.horas}h
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div className="border-t border-border/60 p-3 bg-muted/20">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
          <span className="font-semibold text-foreground mr-1">Legenda:</span>
          {legendaTipos.map((t) => {
            const cls = CAT_CLASS[categoryFromTipo(t.value)] || CAT_CLASS.outro;
            const horario = t.start && t.end ? `${t.start} às ${t.end}` : t.value;
            return (
              <span key={t.value} className="inline-flex items-center gap-1.5">
                <span className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1 rounded border text-[10px] font-bold ${cls}`}>
                  {t.sigla}
                </span>
                <span className="text-muted-foreground">= {horario}</span>
              </span>
            );
          })}
          <span className="inline-flex items-center gap-1.5">
            <span className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1 rounded border text-[10px] font-bold ${STATUS_OVERLAY.pendente}`}>!</span>
            <span className="text-muted-foreground">= Pendente</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1 rounded border text-[10px] font-bold ${STATUS_OVERLAY.cancelado}`}>X</span>
            <span className="text-muted-foreground">= Cancelado</span>
          </span>
        </div>
      </div>
    </div>
  );
});
