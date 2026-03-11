import { useState } from "react";
import { shifts } from "@/data/mockData";
import { SHIFT_STATUS_LABELS, PROFISSAO_LABELS } from "@/types/hospital";
import type { ShiftStatus } from "@/types/hospital";
import { Calendar, List, Clock, Filter, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

const statusClasses: Record<ShiftStatus, string> = {
  agendado: 'status-badge bg-info/10 text-info',
  confirmado: 'status-badge bg-success/10 text-success',
  pendente: 'status-badge bg-warning/10 text-warning',
  em_aberto: 'status-badge bg-muted text-muted-foreground',
  trocando: 'status-badge bg-primary/10 text-primary',
  concluido: 'status-badge bg-accent/10 text-accent',
  cancelado: 'status-badge bg-destructive/10 text-destructive',
};

export default function EscalaPage() {
  const [view, setView] = useState<'lista' | 'calendario'>('lista');
  const [filterSetor, setFilterSetor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const filtered = shifts.filter(s => {
    if (filterSetor && s.setor !== filterSetor) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });

  const setores = [...new Set(shifts.map(s => s.setor))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="module-title">Escala de Plantões</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} plantões encontrados</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('lista')}
            className={`p-2 rounded-lg transition-colors ${view === 'lista' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('calendario')}
            className={`p-2 rounded-lg transition-colors ${view === 'calendario' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            <Calendar className="h-4 w-4" />
          </button>
          <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="h-4 w-4" /> Novo Plantão
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={filterSetor}
          onChange={e => setFilterSetor(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos os setores</option>
          {setores.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos os status</option>
          {Object.entries(SHIFT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {view === 'lista' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-lg border border-border overflow-hidden shadow-[var(--shadow-card)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="text-left p-3">Profissional</th>
                  <th className="text-left p-3">Setor</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Horário</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">Valor</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer">
                    <td className="p-3">
                      <div>
                        <p className="font-medium text-foreground">{s.profissionalNome}</p>
                        <p className="text-xs text-muted-foreground">{PROFISSAO_LABELS[s.profissao]}</p>
                      </div>
                    </td>
                    <td className="p-3">
                      <div>
                        <p className="text-foreground">{s.setor}</p>
                        <p className="text-xs text-muted-foreground">{s.unidade}</p>
                      </div>
                    </td>
                    <td className="p-3 text-foreground">{new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 text-foreground">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {s.horaInicio} - {s.horaFim}
                      </div>
                      <p className="text-xs text-muted-foreground">{s.cargaHoraria}h</p>
                    </td>
                    <td className="p-3 text-foreground">{s.tipoPlantao}</td>
                    <td className="p-3 font-medium text-foreground">R$ {s.valorTotal.toLocaleString('pt-BR')}</td>
                    <td className="p-3">
                      <span className={statusClasses[s.status]}>{SHIFT_STATUS_LABELS[s.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-lg border border-border p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-6">
            <button className="p-2 hover:bg-muted rounded-lg transition-colors"><ChevronLeft className="h-5 w-5 text-muted-foreground" /></button>
            <h3 className="font-display font-semibold text-foreground text-lg">
              {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </h3>
            <button className="p-2 hover:bg-muted rounded-lg transition-colors"><ChevronRight className="h-5 w-5 text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <div key={d} className="text-xs font-semibold text-muted-foreground py-2">{d}</div>
            ))}
            {Array.from({ length: 35 }, (_, i) => {
              const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay();
              const day = i - firstDay + 1;
              const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
              const isValid = day >= 1 && day <= daysInMonth;
              const isToday = isValid && day === new Date().getDate();
              const dateStr = isValid ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
              const dayShifts = isValid ? shifts.filter(s => s.data === dateStr) : [];

              return (
                <div key={i} className={`min-h-[70px] p-1 rounded-lg border transition-colors ${isValid ? 'border-border/50 hover:border-primary/30 cursor-pointer' : 'border-transparent'} ${isToday ? 'bg-primary/5 border-primary/30' : ''}`}>
                  {isValid && (
                    <>
                      <span className={`text-xs font-medium ${isToday ? 'text-primary font-bold' : 'text-foreground'}`}>{day}</span>
                      <div className="space-y-0.5 mt-1">
                        {dayShifts.slice(0, 2).map(s => (
                          <div key={s.id} className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary truncate">{s.profissionalNome.split(' ')[0]}</div>
                        ))}
                        {dayShifts.length > 2 && <div className="text-[9px] text-muted-foreground">+{dayShifts.length - 2}</div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
