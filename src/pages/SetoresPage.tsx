import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { dispatchNotification } from "@/lib/notifyHelper";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Building2, MapPin, Layers, Plus, Edit, Trash2, ChevronDown, Users, AlertTriangle,
  CheckCircle2, Search, Filter, X, Calendar, Printer, Settings2, Megaphone, MoreHorizontal,
  Eye, UserPlus, FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { abrirVisualizacaoImpressao, diaSemanaPt, type PrintLinha, type PrintCabecalho, type PrintOptions } from "@/lib/printEscala";
import { MoreActionsMenu } from "@/components/MoreActionsMenu";

type SectorRow = { id: string; nome: string; unidade_id: string; min_profissionais_diurno: number | null; min_profissionais_noturno: number | null; min_profissionais_fds: number | null; units?: { nome?: string } };
type ShiftToday = { setor_id: string; status: string; tipo_plantao: string };

type CoverageStatus = 'descoberto' | 'deficit' | 'completo' | 'extra';

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

export default function SetoresPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isMaster, isCoordinator, profileName } = useAuth();
  const canManage = isMaster || isCoordinator;

  const [unitModal, setUnitModal] = useState(false);
  const [sectorModal, setSectorModal] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingSectorId, setEditingSectorId] = useState<string | null>(null);
  const [unitForm, setUnitForm] = useState({ nome: '', tipo: 'hospital', endereco: '', telefone: '' });
  const [sectorForm, setSectorForm] = useState({ nome: '', unidade_id: '', min_profissionais_diurno: 1, min_profissionais_noturno: 1, min_profissionais_fds: 1 });
  const [expandedUnit, setExpandedUnit] = useState<Record<string, boolean>>({});

  // Filtros e busca
  const [busca, setBusca] = useState('');
  const buscaDeb = useDebounce(busca, 300);
  const [filtroUnidade, setFiltroUnidade] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<'' | CoverageStatus>('');
  const [showFilters, setShowFilters] = useState(false);

  // Modal: profissionais vinculados ao setor
  const [profsModal, setProfsModal] = useState<{ open: boolean; sector?: SectorRow }>({ open: false });

  const { data: units = [], isLoading: loadingUnits } = useQuery({
    queryKey: ['units'],
    queryFn: async () => { const { data, error } = await supabase.from('units').select('*').order('nome'); if (error) throw error; return data; },
  });

  const { data: sectors = [], isLoading: loadingSectors } = useQuery({
    queryKey: ['sectors'],
    queryFn: async () => { const { data, error } = await supabase.from('sectors').select('*, units:unidade_id(nome)').order('nome'); if (error) throw error; return data as SectorRow[]; },
  });

  const { data: shiftsToday = [], refetch: refetchToday } = useQuery({
    queryKey: ['sectors-today-coverage'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase.from('shifts').select('setor_id, status, tipo_plantao').eq('data', today);
      return (data || []) as ShiftToday[];
    },
  });

  useEffect(() => {
    const ch = supabase.channel('sectors-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => refetchToday()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetchToday]);

  const coverageBySector = useMemo(() => {
    const map: Record<string, { confirmados: number; pendentes: number; total: number }> = {};
    for (const s of shiftsToday) {
      if (s.tipo_plantao === 'folga' || s.tipo_plantao === 'indisponibilidade') continue;
      if (!map[s.setor_id]) map[s.setor_id] = { confirmados: 0, pendentes: 0, total: 0 };
      map[s.setor_id].total++;
      if (s.status === 'confirmado' || s.status === 'concluido') map[s.setor_id].confirmados++;
      else if (s.status !== 'cancelado') map[s.setor_id].pendentes++;
    }
    return map;
  }, [shiftsToday]);

  const isWeekend = useMemo(() => { const d = new Date().getDay(); return d === 0 || d === 6; }, []);
  const getMinForSector = (s: SectorRow) => isWeekend ? (s.min_profissionais_fds || 1) : (s.min_profissionais_diurno || 1);

  const sectorStatus = (s: SectorRow): CoverageStatus => {
    const cov = coverageBySector[s.id] || { confirmados: 0, pendentes: 0, total: 0 };
    const min = getMinForSector(s);
    const ativo = cov.confirmados + cov.pendentes;
    if (ativo === 0) return 'descoberto';
    if (ativo < min) return 'deficit';
    if (ativo > min) return 'extra';
    return 'completo';
  };

  // Setores filtrados (busca + filtros)
  const sectorsFiltered = useMemo(() => {
    const term = norm(buscaDeb);
    return (sectors as SectorRow[]).filter(s => {
      if (filtroUnidade && s.unidade_id !== filtroUnidade) return false;
      if (filtroStatus && sectorStatus(s) !== filtroStatus) return false;
      if (!term) return true;
      const u = (units as any[]).find(x => x.id === s.unidade_id) || {};
      const status = sectorStatus(s);
      const hay = norm([s.nome, u.nome, u.tipo, u.endereco, status].filter(Boolean).join(' '));
      return hay.includes(term);
    });
  }, [sectors, units, filtroUnidade, filtroStatus, buscaDeb, coverageBySector, isWeekend]);

  // Unidades filtradas: mantém unidades que casam por busca direta OU que possuem ao menos 1 setor visível
  const unitsFiltered = useMemo(() => {
    const term = norm(buscaDeb);
    const sectorsByUnit = new Map<string, SectorRow[]>();
    sectorsFiltered.forEach(s => {
      const arr = sectorsByUnit.get(s.unidade_id) || [];
      arr.push(s); sectorsByUnit.set(s.unidade_id, arr);
    });
    return (units as any[]).filter(u => {
      if (filtroUnidade && u.id !== filtroUnidade) return false;
      const matchesBusca = !term || norm([u.nome, u.tipo, u.endereco].filter(Boolean).join(' ')).includes(term);
      const hasVisibleSectors = (sectorsByUnit.get(u.id) || []).length > 0;
      // Se há filtro de status, exige setores visíveis
      if (filtroStatus) return hasVisibleSectors;
      return matchesBusca || hasVisibleSectors;
    });
  }, [units, sectorsFiltered, filtroUnidade, filtroStatus, buscaDeb]);

  // KPIs por status
  const statusCounts = useMemo(() => {
    const c = { descoberto: 0, deficit: 0, completo: 0, extra: 0 };
    (sectors as SectorRow[]).forEach(s => { c[sectorStatus(s)]++; });
    return c;
  }, [sectors, coverageBySector, isWeekend]);

  const limparFiltros = () => { setBusca(''); setFiltroUnidade(''); setFiltroStatus(''); };
  const hasFilters = !!(buscaDeb || filtroUnidade || filtroStatus);

  // ===== Mutations existentes (mantidas) =====
  const saveUnit = useMutation({
    mutationFn: async (form: typeof unitForm) => {
      const payload = { nome: form.nome, tipo: form.tipo, endereco: form.endereco || null, telefone: form.telefone || null };
      if (editingUnitId) {
        const { error } = await supabase.from('units').update(payload).eq('id', editingUnitId);
        if (error) throw error;
        await logAudit('Unidade editada', 'setores', { id: editingUnitId, nome: form.nome });
      } else {
        const { error } = await supabase.from('units').insert(payload);
        if (error) throw error;
        await logAudit('Unidade criada', 'setores', { nome: form.nome });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['units'] }); toast.success(editingUnitId ? 'Unidade atualizada!' : 'Unidade criada!'); setUnitModal(false); setEditingUnitId(null); setUnitForm({ nome: '', tipo: 'hospital', endereco: '', telefone: '' }); },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const deleteUnit = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('units').delete().eq('id', id); if (error) throw error; await logAudit('Unidade excluída', 'setores', { id }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['units'] }); toast.success('Unidade excluída!'); },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const saveSector = useMutation({
    mutationFn: async (form: typeof sectorForm) => {
      const payload = { nome: form.nome, unidade_id: form.unidade_id, min_profissionais_diurno: form.min_profissionais_diurno, min_profissionais_noturno: form.min_profissionais_noturno, min_profissionais_fds: form.min_profissionais_fds };
      if (editingSectorId) {
        const { error } = await supabase.from('sectors').update(payload).eq('id', editingSectorId);
        if (error) throw error;
        await logAudit('Setor editado', 'setores', { id: editingSectorId });
      } else {
        const { error } = await supabase.from('sectors').insert(payload);
        if (error) throw error;
        await logAudit('Setor criado', 'setores', { nome: form.nome });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sectors'] }); toast.success(editingSectorId ? 'Setor atualizado!' : 'Setor criado!'); setSectorModal(false); setEditingSectorId(null); setSectorForm({ nome: '', unidade_id: '', min_profissionais_diurno: 1, min_profissionais_noturno: 1, min_profissionais_fds: 1 }); },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const deleteSector = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('sectors').delete().eq('id', id); if (error) throw error; await logAudit('Setor excluído', 'setores', { id }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sectors'] }); toast.success('Setor excluído!'); },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  // ===== Ações rápidas =====

  // Criar plantão para setor — abre EscalaPage com modal pré-preenchido
  const acaoCriarPlantao = (sector: SectorRow) => {
    if (!canManage) { toast.error('Sem permissão para criar plantão.'); return; }
    sessionStorage.setItem('escala:prefillNovoPlantao', JSON.stringify({
      unidadeId: sector.unidade_id, setorId: sector.id, data: new Date().toISOString().slice(0, 10),
    }));
    logAudit('Setor: criar plantão', 'setores', { setor_id: sector.id });
    navigate('/escala');
  };

  const acaoVerEscalaSetor = (sector: SectorRow) => {
    sessionStorage.setItem('escala:prefillNovoPlantao', JSON.stringify({
      unidadeId: sector.unidade_id, setorId: sector.id, _viewOnly: true,
    }));
    // Apenas filtra: removemos o open, deixando só o filtro
    sessionStorage.removeItem('escala:prefillNovoPlantao');
    sessionStorage.setItem('escala:filtroInicial', JSON.stringify({ unidadeId: sector.unidade_id, setorId: sector.id }));
    navigate('/escala');
  };

  const acaoVerEscalaUnidade = (unitId: string) => {
    sessionStorage.setItem('escala:filtroInicial', JSON.stringify({ unidadeId: unitId, setorId: '' }));
    navigate('/escala');
  };

  // Imprime escala do setor/unidade dos plantões de hoje
  const acaoImprimirEscala = useMutation({
    mutationFn: async (params: { unitId?: string; sectorId?: string; tituloEscopo: string }) => {
      const { unitId, sectorId, tituloEscopo } = params;
      const today = new Date().toISOString().slice(0, 10);
      let q = supabase.from('shifts')
        .select('id, data, hora_inicio, hora_fim, tipo_plantao, status, observacoes, carga_horaria, professionals:profissional_id(nome, profissao, conselho, registro), units:unidade_id(nome), sectors:setor_id(nome)')
        .eq('data', today);
      if (unitId) q = q.eq('unidade_id', unitId);
      if (sectorId) q = q.eq('setor_id', sectorId);
      const { data, error } = await q.order('hora_inicio');
      if (error) throw error;
      const linhas: PrintLinha[] = (data || []).map((r: any) => ({
        profissional: r.professionals?.nome || '—',
        profissao: r.professionals?.profissao || '—',
        unidade: r.units?.nome || '',
        setor: r.sectors?.nome || '',
        data: new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR'),
        diaSemana: diaSemanaPt(r.data),
        tipo: r.tipo_plantao || '—',
        horario: `${(r.hora_inicio || '').slice(0, 5)} - ${(r.hora_fim || '').slice(0, 5)}`,
        status: r.status || '—',
        cargaHoras: Number(r.carga_horaria) || 0,
        observacoes: r.observacoes || '',
      }));
      const cab: PrintCabecalho = {
        instituicao: { nome: 'SMS Oriximiná', cnpj: '05.131.081/0001-82' },
        unidade: unitId ? (units as any[]).find(u => u.id === unitId)?.nome : undefined,
        setor: sectorId ? (sectors as SectorRow[]).find(s => s.id === sectorId)?.nome : undefined,
        periodoLabel: `Hoje · ${new Date().toLocaleDateString('pt-BR')} · ${tituloEscopo}`,
        emitidoPor: profileName || 'Gestor',
        sistema: 'GestorPlantão',
      };
      const opts: PrintOptions = { incluirObservacoes: true, incluirConselho: true } as PrintOptions;
      const ok = abrirVisualizacaoImpressao(cab, linhas, opts, true);
      if (!ok) throw new Error('Bloqueio de pop-up. Permita janelas para imprimir.');
      await logAudit('Escala impressa', 'setores', { unitId, sectorId, total: linhas.length });
    },
    onError: (e: Error) => toast.error(e.message),
    onSuccess: () => toast.success('Documento gerado para impressão.'),
  });

  // Editar regra de cobertura (atalho para o modal de setor focando em mínimos)
  const acaoEditarRegra = (s: SectorRow) => {
    if (!canManage) { toast.error('Sem permissão para editar regras.'); return; }
    setEditingSectorId(s.id);
    setSectorForm({ nome: s.nome, unidade_id: s.unidade_id, min_profissionais_diurno: s.min_profissionais_diurno || 1, min_profissionais_noturno: s.min_profissionais_noturno || 1, min_profissionais_fds: s.min_profissionais_fds || 1 });
    setSectorModal(true);
  };

  // Enviar alerta de setor descoberto a todos os gestores
  const acaoEnviarAlerta = useMutation({
    mutationFn: async (sector: SectorRow) => {
      if (!canManage) throw new Error('Sem permissão.');
      const unidadeNome = (units as any[]).find(u => u.id === sector.unidade_id)?.nome || '';
      const cov = coverageBySector[sector.id] || { confirmados: 0, pendentes: 0, total: 0 };
      const ativo = cov.confirmados + cov.pendentes;
      const min = getMinForSector(sector);

      // Buscar gestores via roles (gestor_master + coordenador)
      const { data: roles } = await supabase
        .from('user_roles').select('user_id, role')
        .in('role', ['gestor_master' as any, 'coordenador' as any]);
      const userIds = Array.from(new Set((roles || []).map((r: any) => r.user_id))).filter(Boolean);
      if (userIds.length === 0) throw new Error('Nenhum gestor encontrado.');

      const titulo = `⚠️ Setor descoberto: ${sector.nome}`;
      const mensagem = `Unidade ${unidadeNome} — Setor ${sector.nome} está com cobertura ${ativo}/${min} hoje. Ação imediata requerida.`;
      await Promise.all(userIds.map(uid => dispatchNotification({ userId: uid, tipo: 'alerta_setor_descoberto', titulo, mensagem })));
      await logAudit('Alerta de setor descoberto enviado', 'setores', { setor_id: sector.id, gestores: userIds.length });
    },
    onSuccess: () => toast.success('Alerta enviado para os gestores.'),
    onError: (e: Error) => toast.error(e.message),
  });

  // Profissionais vinculados — abrir modal
  const { data: profsBySector = [] } = useQuery({
    queryKey: ['profs-by-sector', profsModal.sector?.id],
    enabled: !!profsModal.sector?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professionals_safe' as any)
        .select('id, nome, profissao, status, setor_principal_id, unidade_principal_id')
        .eq('setor_principal_id', profsModal.sector!.id)
        .order('nome');
      if (error) throw error;
      return data || [];
    },
  });

  // ===== UI helpers =====
  const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  const getCoverageBadge = (sector: SectorRow) => {
    const cov = coverageBySector[sector.id] || { confirmados: 0, pendentes: 0, total: 0 };
    const min = getMinForSector(sector);
    const ativo = cov.confirmados + cov.pendentes;
    const status = sectorStatus(sector);
    if (status === 'descoberto') return { color: 'bg-destructive/10 text-destructive border-destructive/20', label: `Descoberto (0/${min})`, icon: AlertTriangle };
    if (status === 'deficit') return { color: 'bg-warning/10 text-warning border-warning/20', label: `Falta ${min - ativo} (${ativo}/${min})`, icon: AlertTriangle };
    if (status === 'extra') return { color: 'bg-info/10 text-info border-info/20', label: `Cobertura extra (${ativo}/${min})`, icon: CheckCircle2 };
    return { color: 'bg-success/10 text-success border-success/20', label: `Coberto (${ativo}/${min})`, icon: CheckCircle2 };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="module-title">Setores e Unidades</h1>
          <p className="text-muted-foreground text-sm mt-1">Cobertura em tempo real · {Object.values(coverageBySector).reduce((a, b) => a + b.total, 0)} plantões hoje</p>
        </div>
      </div>

      {/* Busca + Filtros */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por unidade, setor, tipo, endereço ou status..."
              className="w-full bg-muted border border-border rounded-lg pl-9 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {busca && (
              <button onClick={() => setBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-background">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <button onClick={() => setShowFilters(v => !v)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${showFilters ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border text-foreground hover:bg-background'}`}>
            <Filter className="h-4 w-4" /> Filtros
          </button>
          {hasFilters && (
            <button onClick={limparFiltros} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
              Limpar
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Unidade</label>
              <select value={filtroUnidade} onChange={e => setFiltroUnidade(e.target.value)} className={inputClass}>
                <option value="">Todas</option>
                {(units as any[]).map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status de cobertura</label>
              <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as any)} className={inputClass}>
                <option value="">Todos</option>
                <option value="descoberto">Descobertos</option>
                <option value="deficit">Com déficit</option>
                <option value="completo">Completos</option>
                <option value="extra">Com cobertura extra</option>
              </select>
            </div>
          </div>
        )}

        {/* Chips de KPI clicáveis */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          {([
            { key: 'descoberto', label: 'Descobertos', value: statusCounts.descoberto, cls: 'bg-destructive/10 text-destructive border-destructive/20' },
            { key: 'deficit', label: 'Com déficit', value: statusCounts.deficit, cls: 'bg-warning/10 text-warning border-warning/20' },
            { key: 'completo', label: 'Completos', value: statusCounts.completo, cls: 'bg-success/10 text-success border-success/20' },
            { key: 'extra', label: 'Cobertura extra', value: statusCounts.extra, cls: 'bg-info/10 text-info border-info/20' },
          ] as const).map(k => (
            <button key={k.key}
              onClick={() => setFiltroStatus(filtroStatus === k.key ? '' : k.key as CoverageStatus)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${k.cls} ${filtroStatus === k.key ? 'ring-2 ring-ring' : 'opacity-90 hover:opacity-100'}`}>
              {k.label}: <strong className="ml-1">{k.value}</strong>
            </button>
          ))}
        </div>
      </div>

      {/* Units */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-foreground text-lg flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Unidades de Saúde</h2>
          {canManage && (
            <button onClick={() => { setUnitForm({ nome: '', tipo: 'hospital', endereco: '', telefone: '' }); setEditingUnitId(null); setUnitModal(true); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"><Plus className="h-4 w-4" /> Nova Unidade</button>
          )}
        </div>
        {loadingUnits || loadingSectors ? <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {unitsFiltered.map((u: any, i: number) => {
              const allUnitSectors = (sectors as SectorRow[]).filter(s => s.unidade_id === u.id);
              const visibleSectors = sectorsFiltered.filter(s => s.unidade_id === u.id);
              const unitSectors = (buscaDeb || filtroStatus) ? visibleSectors : allUnitSectors;
              const isExpanded = expandedUnit[u.id] ?? !!(buscaDeb || filtroStatus);
              const totalCoverage = allUnitSectors.reduce((acc, s) => {
                const cov = coverageBySector[s.id] || { confirmados: 0, pendentes: 0, total: 0 };
                return { conf: acc.conf + cov.confirmados, pend: acc.pend + cov.pendentes, min: acc.min + getMinForSector(s) };
              }, { conf: 0, pend: 0, min: 0 });
              const totalAtivo = totalCoverage.conf + totalCoverage.pend;
              const unitOk = totalAtivo >= totalCoverage.min;
              const setoresDescobertos = allUnitSectors.filter(s => sectorStatus(s) === 'descoberto').length;

              return (
                <motion.div key={u.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="bg-card rounded-xl border border-border shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2.5 rounded-lg bg-primary/10 shrink-0"><Building2 className="h-5 w-5 text-primary" /></div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display font-semibold text-foreground truncate">{u.nome}</h3>
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            <span className="status-badge bg-info/10 text-info text-[10px]">{u.tipo}</span>
                            <span className={`status-badge text-[10px] border ${unitOk ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'}`}>
                              {totalAtivo}/{totalCoverage.min} hoje
                            </span>
                            {setoresDescobertos > 0 && (
                              <span className="status-badge text-[10px] border bg-destructive/10 text-destructive border-destructive/20">
                                {setoresDescobertos} descoberto{setoresDescobertos > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          {u.endereco && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><MapPin className="h-3 w-3" />{u.endereco}</p>}
                          <p className="text-xs text-muted-foreground mt-1">{allUnitSectors.length} setores</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Ações rápidas da unidade */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded hover:bg-muted" title="Ações rápidas">
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Ações da unidade</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => acaoVerEscalaUnidade(u.id)}>
                              <Calendar className="h-4 w-4 mr-2" /> Ver escala da unidade
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={acaoImprimirEscala.isPending}
                              onClick={() => !acaoImprimirEscala.isPending && acaoImprimirEscala.mutate({ unitId: u.id, tituloEscopo: u.nome })}>
                              <Printer className="h-4 w-4 mr-2" /> Imprimir escala da unidade
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setFiltroUnidade(u.id); setFiltroStatus('descoberto'); setShowFilters(true); }}>
                              <AlertTriangle className="h-4 w-4 mr-2" /> Ver setores descobertos
                            </DropdownMenuItem>
                            {canManage && <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setSectorForm({ nome: '', unidade_id: u.id, min_profissionais_diurno: 1, min_profissionais_noturno: 1, min_profissionais_fds: 1 }); setEditingSectorId(null); setSectorModal(true); }}>
                                <Plus className="h-4 w-4 mr-2" /> Criar novo setor
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setExpandedUnit(p => ({ ...p, [u.id]: true })); toast.info('Configure cobertura nos setores abaixo'); }}>
                                <Settings2 className="h-4 w-4 mr-2" /> Configurar cobertura
                              </DropdownMenuItem>
                            </>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {canManage && <>
                          <button onClick={() => { setEditingUnitId(u.id); setUnitForm({ nome: u.nome, tipo: u.tipo, endereco: u.endereco || '', telefone: u.telefone || '' }); setUnitModal(true); }} className="p-1.5 rounded hover:bg-muted"><Edit className="h-3.5 w-3.5 text-muted-foreground" /></button>
                          {isMaster && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild><button className="p-1.5 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button></AlertDialogTrigger>
                              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir unidade?</AlertDialogTitle><AlertDialogDescription>Todos os setores vinculados serão afetados.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel disabled={deleteUnit.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deleteUnit.isPending} onClick={(e) => { e.preventDefault(); if (!deleteUnit.isPending) deleteUnit.mutate(u.id); }}>{deleteUnit.isPending ? 'Excluindo...' : 'Excluir'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                            </AlertDialog>
                          )}
                        </>}
                      </div>
                    </div>

                    {allUnitSectors.length > 0 && (
                      <button onClick={() => setExpandedUnit(p => ({ ...p, [u.id]: !(p[u.id] ?? !!(buscaDeb || filtroStatus)) }))}
                        className="mt-3 w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors py-1.5 border-t border-border pt-3">
                        <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Setores ({unitSectors.length}{unitSectors.length !== allUnitSectors.length ? `/${allUnitSectors.length}` : ''})</span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {isExpanded && unitSectors.length > 0 && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-muted/30 border-t border-border">
                        <div className="p-4 space-y-2">
                          {unitSectors.map((s: SectorRow) => {
                            const cov = coverageBySector[s.id] || { confirmados: 0, pendentes: 0, total: 0 };
                            const badge = getCoverageBadge(s);
                            const BadgeIcon = badge.icon;
                            const status = sectorStatus(s);
                            return (
                              <div key={s.id} className="bg-background rounded-lg border border-border p-3 flex items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-foreground">{s.nome}</span>
                                    <span className={`status-badge text-[10px] border ${badge.color}`}>
                                      <BadgeIcon className="h-3 w-3 mr-1" />{badge.label}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                                    <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /> {cov.confirmados} confirmados</span>
                                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {cov.pendentes} pendentes</span>
                                    <span className="font-mono">D:{s.min_profissionais_diurno || 1} N:{s.min_profissionais_noturno || 1} FDS:{s.min_profissionais_fds || 1}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Ações rápidas do setor */}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className="p-1.5 rounded hover:bg-muted" title="Ações rápidas">
                                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-60">
                                      <DropdownMenuLabel>Ações do setor</DropdownMenuLabel>
                                      {canManage && (
                                        <DropdownMenuItem onClick={() => acaoCriarPlantao(s)}>
                                          <Plus className="h-4 w-4 mr-2" /> Criar plantão para setor
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem onClick={() => acaoVerEscalaSetor(s)}>
                                        <Eye className="h-4 w-4 mr-2" /> Ver escala do setor
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        disabled={acaoImprimirEscala.isPending}
                                        onClick={() => !acaoImprimirEscala.isPending && acaoImprimirEscala.mutate({ unitId: s.unidade_id, sectorId: s.id, tituloEscopo: s.nome })}>
                                        <Printer className="h-4 w-4 mr-2" /> Imprimir escala do setor
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setProfsModal({ open: true, sector: s })}>
                                        <UserPlus className="h-4 w-4 mr-2" /> Ver profissionais vinculados
                                      </DropdownMenuItem>
                                      {canManage && <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => acaoEditarRegra(s)}>
                                          <Settings2 className="h-4 w-4 mr-2" /> Editar regra de cobertura
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          disabled={status !== 'descoberto' || acaoEnviarAlerta.isPending}
                                          onClick={() => !acaoEnviarAlerta.isPending && acaoEnviarAlerta.mutate(s)}>
                                          <Megaphone className="h-4 w-4 mr-2" /> Enviar alerta de descoberto
                                        </DropdownMenuItem>
                                      </>}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  {canManage && (
                                    <button onClick={() => { setEditingSectorId(s.id); setSectorForm({ nome: s.nome, unidade_id: s.unidade_id, min_profissionais_diurno: s.min_profissionais_diurno || 1, min_profissionais_noturno: s.min_profissionais_noturno || 1, min_profissionais_fds: s.min_profissionais_fds || 1 }); setSectorModal(true); }} className="p-1.5 rounded hover:bg-muted"><Edit className="h-3.5 w-3.5 text-muted-foreground" /></button>
                                  )}
                                  {isMaster && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild><button className="p-1.5 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button></AlertDialogTrigger>
                                      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir setor?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel disabled={deleteSector.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deleteSector.isPending} onClick={(e) => { e.preventDefault(); if (!deleteSector.isPending) deleteSector.mutate(s.id); }}>{deleteSector.isPending ? 'Excluindo...' : 'Excluir'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {canManage && (
                            <button onClick={() => { setSectorForm({ nome: '', unidade_id: u.id, min_profissionais_diurno: 1, min_profissionais_noturno: 1, min_profissionais_fds: 1 }); setEditingSectorId(null); setSectorModal(true); }}
                              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                              <Plus className="h-3.5 w-3.5" /> Adicionar setor
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
            {unitsFiltered.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-2 text-center py-8">
                {hasFilters ? 'Nenhuma unidade/setor encontrado com os filtros aplicados.' : 'Nenhuma unidade cadastrada.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Unit Modal */}
      <Dialog open={unitModal} onOpenChange={setUnitModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingUnitId ? 'Editar Unidade' : 'Nova Unidade'}</DialogTitle><DialogDescription>Preencha os dados da unidade de saúde.</DialogDescription></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); if (!saveUnit.isPending) saveUnit.mutate(unitForm); }} className="space-y-4">
            <div><label className="text-sm font-medium text-foreground">Nome *</label><input required value={unitForm.nome} onChange={e => setUnitForm(f => ({ ...f, nome: e.target.value }))} className={inputClass} /></div>
            <div><label className="text-sm font-medium text-foreground">Tipo</label>
              <select value={unitForm.tipo} onChange={e => setUnitForm(f => ({ ...f, tipo: e.target.value }))} className={inputClass}>
                <option value="hospital">Hospital</option><option value="upa">UPA</option><option value="maternidade">Maternidade</option><option value="clinica">Clínica</option><option value="pronto_atendimento">Pronto Atendimento</option>
              </select></div>
            <div><label className="text-sm font-medium text-foreground">Endereço</label><input value={unitForm.endereco} onChange={e => setUnitForm(f => ({ ...f, endereco: e.target.value }))} className={inputClass} /></div>
            <div><label className="text-sm font-medium text-foreground">Telefone</label><input value={unitForm.telefone} onChange={e => setUnitForm(f => ({ ...f, telefone: e.target.value }))} className={inputClass} /></div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setUnitModal(false)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saveUnit.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saveUnit.isPending ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sector Modal */}
      <Dialog open={sectorModal} onOpenChange={setSectorModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSectorId ? 'Editar Setor' : 'Novo Setor'}</DialogTitle><DialogDescription>Cobertura mínima determina alertas de descobertura.</DialogDescription></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); if (!saveSector.isPending) saveSector.mutate(sectorForm); }} className="space-y-4">
            <div><label className="text-sm font-medium text-foreground">Nome *</label><input required value={sectorForm.nome} onChange={e => setSectorForm(f => ({ ...f, nome: e.target.value }))} className={inputClass} /></div>
            <div><label className="text-sm font-medium text-foreground">Unidade *</label>
              <select required value={sectorForm.unidade_id} onChange={e => setSectorForm(f => ({ ...f, unidade_id: e.target.value }))} className={inputClass}>
                <option value="">Selecione...</option>{(units as any[]).map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select></div>
            <div className="border-t border-border pt-3">
              <p className="text-sm font-semibold text-foreground mb-2">Cobertura Mínima</p>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs text-muted-foreground">Diurno</label><input type="number" min={0} value={sectorForm.min_profissionais_diurno} onChange={e => setSectorForm(f => ({ ...f, min_profissionais_diurno: parseInt(e.target.value) || 0 }))} className={inputClass} /></div>
                <div><label className="text-xs text-muted-foreground">Noturno</label><input type="number" min={0} value={sectorForm.min_profissionais_noturno} onChange={e => setSectorForm(f => ({ ...f, min_profissionais_noturno: parseInt(e.target.value) || 0 }))} className={inputClass} /></div>
                <div><label className="text-xs text-muted-foreground">FDS</label><input type="number" min={0} value={sectorForm.min_profissionais_fds} onChange={e => setSectorForm(f => ({ ...f, min_profissionais_fds: parseInt(e.target.value) || 0 }))} className={inputClass} /></div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setSectorModal(false)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saveSector.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saveSector.isPending ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Profissionais vinculados */}
      <Dialog open={profsModal.open} onOpenChange={(o) => setProfsModal({ open: o, sector: o ? profsModal.sector : undefined })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Profissionais vinculados</DialogTitle>
            <DialogDescription>Setor: {profsModal.sector?.nome}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[420px] overflow-auto space-y-2">
            {(profsBySector as any[]).length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum profissional com este setor como principal.</p>
            )}
            {(profsBySector as any[]).map(p => (
              <div key={p.id} className="bg-muted/40 border border-border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{p.nome}</p>
                  <p className="text-xs text-muted-foreground capitalize">{p.profissao} · {p.status}</p>
                </div>
                <button onClick={() => { setProfsModal({ open: false }); navigate('/profissionais'); }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted">
                  <FileText className="h-3.5 w-3.5 inline mr-1" /> Ver
                </button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
