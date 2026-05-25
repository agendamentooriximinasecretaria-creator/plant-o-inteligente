import { useMemo, useState, memo } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertTriangle, Info } from "lucide-react";

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
  recebe_adn?: boolean;
  gera_adn?: boolean;
}

export interface TipoPlantaoLegenda {
  value: string;
  sigla: string;
  start?: string;
  end?: string;
  carga?: number;
  gera_adn?: boolean;
}

interface Props {
  shifts: MonthlyShift[];
  tipos: TipoPlantaoLegenda[];
  /** Mês de referência YYYY-MM. Se não informado, usa o mês atual. */
  initialMonth?: string;
  showTotalHours?: boolean;
  showADN?: boolean;
  onCellClick?: (date: string, shifts: MonthlyShift[]) => void;
}

const DIA_SEMANA_ABREV = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

// Categorização por tipo de plantão -> classe de cor (mais profissional e suave)
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
  diurno: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
  noturno: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800",
  manha: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
  tarde: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800",
  "24h": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
  sobreaviso: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700",
  folga: "bg-slate-50 text-slate-400 border-slate-100 dark:bg-slate-900/10 dark:text-slate-500 dark:border-slate-800",
  ferias: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800",
  lp: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800",
  atestado: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800",
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

export const MonthlyConsolidatedGrid = memo(function MonthlyConsolidatedGrid({ shifts, tipos, initialMonth, showTotalHours = true, showADN = false, onCellClick }: Props) {
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
    type ProfRow = { id: string; nome: string; profissao?: string; porDia: Map<number, MonthlyShift[]>; horas: number; adn: number; elegivelAdn: boolean };
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
        row = { id: profId, nome: s.profissional_nome || "Sem nome", profissao: s.profissao, porDia: new Map(), horas: 0, adn: 0, elegivelAdn: !!s.recebe_adn || String((s as any).cargo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes('plantonista') };
        profissaoMap.set(profId, row);
      }

      const arr = row.porDia.get(d) || [];
      arr.push(s);
      row.porDia.set(d, arr);

      const carga = Number(s.carga_horaria || 0);
      if (s.status !== "cancelado" && !["folga", "indisponibilidade"].includes((s.tipo_plantao || "").toLowerCase())) {
        row.horas += carga;
        
        // Cálculo do ADN (Adicional Noturno)
        if (row.elegivelAdn) {
          const geraAdn = s.gera_adn !== undefined ? s.gera_adn : (
            (s.tipo_plantao || "").toLowerCase().includes("not") || 
            (s.tipo_plantao || "").toLowerCase().includes("24")
          );

          if (geraAdn) {
            // Se for 24h, assume 10h de ADN (noite anterior + noite atual)
            // Se for noturno 12h, assume 7h (22h as 05h)
            const tipo = (s.tipo_plantao || "").toLowerCase();
            const adnNoPlantao = tipo.includes("24") ? 10 : 7;
            row.adn += adnNoPlantao;
          }
        }
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
    <div className="bg-card rounded-xl border border-border/60 shadow-lg overflow-hidden print:border-none print:shadow-none print:m-0">
      <style>{`
        @media print {
          .print-no-break { page-break-inside: avoid; }
          .print-header { display: table-header-group; }
          .print-footer { display: table-footer-group; }
          table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; }
          th, td { border: 1px solid #111 !important; padding: 2px !important; }
          .bg-muted\\/50 { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; }
          .bg-primary\\/5 { background-color: #e2e8f0 !important; -webkit-print-color-adjust: exact; border-bottom: 2px solid #111 !important; }
          .bg-muted\\/30 { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; border-bottom: 1.5px solid #111 !important; }
          .bg-muted\\/10 { background-color: #ffffff !important; -webkit-print-color-adjust: exact; border-bottom: 1px solid #ccc !important; }
          .bg-card { background-color: #fff !important; }
          .text-primary { color: #000 !important; }
          .text-muted-foreground { color: #444 !important; }
          .row-prof td { border-bottom: 0.5px solid #eee !important; }
          button, input[type="month"], .no-print { display: none !important; }
          @page { size: landscape; margin: 8mm; }
        }
      `}</style>
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
        <table className="w-full text-[11px] border-collapse table-fixed">
          <thead>
            <tr className="bg-slate-200/80 dark:bg-slate-900/90 sticky top-0 z-30">
              <th className="text-left font-bold text-slate-900 dark:text-slate-100 p-4 border-b-2 border-slate-400 dark:border-slate-700 sticky left-0 bg-slate-200 dark:bg-slate-900 z-40 w-[220px] shadow-[2px_0_4px_rgba(0,0,0,0.1)] text-sm print:relative">
                Profissional
              </th>
              {dias.map((d) => {
                const dt = new Date(year, monthIdx, d);
                const dow = dt.getDay();
                const isFds = dow === 0 || dow === 6;
                const isLastInWeek = dow === 6; // Sábado
                return (
                  <th key={d} className={`p-2 border-b-2 border-slate-400 dark:border-slate-700 text-center font-bold text-xs border-r border-slate-200 dark:border-slate-800 ${isFds ? "bg-slate-300/50 text-slate-800" : "text-slate-700"} ${isLastInWeek ? "border-r-2 border-r-slate-400 dark:border-r-slate-600" : ""}`}>
                    <div className="text-base leading-none mb-1">{d}</div>
                    <div className="text-[10px] uppercase tracking-wider opacity-80">{DIA_SEMANA_ABREV[dow]}</div>
                  </th>
                );
              })}
              {showTotalHours && (
                <th className="text-center font-bold text-slate-900 dark:text-slate-100 p-4 border-b-2 border-slate-400 dark:border-slate-700 bg-slate-200 dark:bg-slate-900 sticky right-[80px] z-40 w-[80px] shadow-[-2px_0_4px_rgba(0,0,0,0.1)] text-sm border-l-2 border-l-slate-400 print:table-cell">
                  Total
                </th>
              )}
              {showADN && (
                <th className="text-center font-bold text-indigo-900 dark:text-indigo-100 p-4 border-b-2 border-indigo-400 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950 sticky right-0 z-40 w-[80px] shadow-[-2px_0_4px_rgba(0,0,0,0.1)] text-sm border-l-2 border-l-indigo-400 print:table-cell" title="Adicional Noturno">
                  ADN
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {groupedData.length === 0 ? (
              <tr>
                <td colSpan={dias.length + (showTotalHours ? 1 : 0) + (showADN ? 1 : 0) + 1} className="p-16 text-center text-muted-foreground text-base italic">
                  Nenhum plantão encontrado para este período.
                </td>
              </tr>
            ) : (
              groupedData.map((item) => {
                if (item.type === 'header-unidade') {
                  return (
                    <tr key={item.key} className="bg-slate-800 dark:bg-slate-950">
                      <td colSpan={dias.length + (showTotalHours ? 1 : 0) + (showADN ? 1 : 0) + 1} className="px-6 py-4 border-b border-slate-700 font-black text-sm text-slate-100 uppercase tracking-[0.2em]">
                        {item.label}
                      </td>
                    </tr>
                  );
                }
                if (item.type === 'header-setor') {
                  return (
                    <tr key={item.key} className="bg-slate-100 dark:bg-slate-900/50">
                      <td colSpan={dias.length + (showTotalHours ? 1 : 0) + (showADN ? 1 : 0) + 1} className="px-6 py-3 border-y-2 border-slate-300 dark:border-slate-700 font-extrabold text-sm text-slate-700 dark:text-slate-300 tracking-wide">
                        <div className="flex items-center gap-3">
                          <span className="w-1.5 h-6 bg-primary rounded-full"></span>
                          SETOR: {item.label}
                        </div>
                      </td>
                    </tr>
                  );
                }
                if (item.type === 'header-profissao') {
                  return (
                    <tr key={item.key} className="bg-white dark:bg-transparent">
                      <td colSpan={dias.length + (showTotalHours ? 1 : 0) + (showADN ? 1 : 0) + 1} className="px-8 py-2 border-b border-slate-200 dark:border-slate-800 font-bold text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-widest italic">
                        {item.label}
                      </td>
                    </tr>
                  );
                }

                const row = item.row!;
                return (
                  <tr key={item.key} className="border-b border-slate-200 dark:border-slate-800 even:bg-slate-50/50 dark:even:bg-slate-800/10 hover:bg-slate-100/80 dark:hover:bg-slate-800/40 transition-all print:break-inside-avoid group">
                    <td className="px-4 py-3 sticky left-0 bg-white dark:bg-background z-20 border-r-2 border-slate-300 dark:border-slate-700 print:relative shadow-[2px_0_4px_rgba(0,0,0,0.05)] group-hover:bg-slate-100 dark:group-hover:bg-slate-800 transition-colors">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-snug">{row.nome}</div>
                      <div className="text-[10px] text-slate-500 font-medium uppercase mt-0.5 tracking-tight">{row.profissao}</div>
                    </td>
                    {dias.map((d) => {
                      const lista = row.porDia.get(d) || [];
                      const dt = new Date(year, monthIdx, d);
                      const isFds = dt.getDay() === 0 || dt.getDay() === 6;
                      const isLastInWeek = dt.getDay() === 6;
                      const cellClass = `p-1 text-center align-middle border-r border-slate-100 dark:border-slate-800/50 ${isFds ? "bg-slate-100/30" : ""} ${isLastInWeek ? "border-r-2 border-r-slate-300 dark:border-r-slate-700" : ""}`;
                      
                      if (lista.length === 0) {
                        return <td key={d} className={cellClass}>
                          <div className="text-[9px] text-slate-300">—</div>
                        </td>;
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
                        <td 
                          key={d} 
                          className={`${cellClass} relative cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/30 transition-colors`}
                          onClick={() => onCellClick?.(`${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, lista)}
                        >
                          <div
                            className={`inline-flex items-center justify-center min-w-[32px] h-8 px-2 rounded-lg border shadow-sm text-[11px] font-bold transition-all hover:scale-105 z-10 relative ${hasConflict ? 'ring-2 ring-destructive border-destructive bg-destructive/10 text-destructive' : cls}`}
                            title={tooltip}
                          >
                            {hasConflict && <AlertTriangle className="h-3 w-3 shrink-0" />}
                            {siglas.join("/")}
                          </div>
                        </td>
                      );
                    })}
                    {showTotalHours && (
                      <td className={`px-4 py-3 text-center sticky ${showADN ? 'right-[80px]' : 'right-0'} bg-slate-100 dark:bg-slate-900 z-20 border-l-2 border-l-slate-300 dark:border-l-slate-700 print:relative shadow-[-2px_0_4px_rgba(0,0,0,0.05)] group-hover:bg-slate-100 dark:group-hover:bg-slate-800 transition-colors`}>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-100 text-xs">{row.horas.toFixed(1)}h</span>
                      </td>
                    )}
                    {showADN && (
                      <td className="px-4 py-3 text-center sticky right-0 bg-indigo-50 dark:bg-indigo-950 z-20 border-l-2 border-l-indigo-300 dark:border-l-indigo-700 print:relative shadow-[-2px_0_4px_rgba(0,0,0,0.05)] group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 transition-colors">
                        <span className="font-mono font-bold text-indigo-800 dark:text-indigo-100 text-xs">
                          {row.elegivelAdn ? `${row.adn.toFixed(1)}h` : "—"}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legenda Profissional */}
      <div className="border-t border-border/60 p-5 bg-slate-50/50 dark:bg-slate-900/40">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Info className="h-3 w-3" />
          Legenda de Plantões e Horários
        </h4>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          {legendaTipos.map((t) => {
            const cls = CAT_CLASS[categoryFromTipo(t.value)] || CAT_CLASS.outro;
            return (
              <div key={t.value} className="flex items-center gap-3 group">
                <div className={`flex items-center justify-center min-w-[32px] h-8 px-2 rounded-lg border shadow-sm text-[11px] font-bold ${cls}`}>
                  {t.sigla}
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-tight">{t.value}</span>
                  {t.start && t.end && <span className="text-[10px] text-slate-400 font-medium tracking-tight">{t.start} — {t.end}</span>}
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center min-w-[32px] h-8 px-2 rounded-lg border shadow-sm text-[11px] font-bold ${STATUS_OVERLAY.pendente}`}>
              !
            </div>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Pendente</span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center min-w-[32px] h-8 px-2 rounded-lg border shadow-sm text-[11px] font-bold ${STATUS_OVERLAY.cancelado}`}>
              X
            </div>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Cancelado</span>
          </div>
        </div>
      </div>
    </div>
  );
});
