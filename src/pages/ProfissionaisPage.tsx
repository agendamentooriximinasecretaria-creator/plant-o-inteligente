import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import {
  Search, Plus, User2, Edit, Calendar as CalIcon, X, MoreHorizontal,
  Printer, MessageSquare, FileCheck2, History, AlertTriangle, Filter,
  Upload, Download, Trash2,
} from "lucide-react";
import { MoreActionsMenu } from "@/components/MoreActionsMenu";
import { ContactActionButton } from "@/components/ContactActionButton";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { calcularHorasPorProfissional, calcularCargaPercentual, CLT_LIMITE_MENSAL } from "@/lib/horas";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
import { printFichaProfissional } from "@/lib/printFichaProfissional";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { CardListSkeleton } from "@/components/PageSkeleton";

function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return v;
}

const norm = (s: any) => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const PROFISSAO_OPTIONS = [
  { value: 'medico', label: 'Médico(a)' },
  { value: 'enfermeiro', label: 'Enfermeiro(a)' },
  { value: 'fisioterapeuta', label: 'Fisioterapeuta' },
  { value: 'tecnico_enfermagem', label: 'Téc. Enfermagem' },
  { value: 'biomedico', label: 'Biomédico(a)' },
  { value: 'psicologo', label: 'Psicólogo(a)' },
  { value: 'terapeuta_ocupacional', label: 'Terapeuta Ocupacional' },
  { value: 'nutricionista', label: 'Nutricionista' },
  { value: 'fonoaudiologo', label: 'Fonoaudiólogo(a)' },
  { value: 'farmaceutico', label: 'Farmacêutico(a)' },
  { value: 'outro', label: 'Outro' },
] as const;

type ProfissaoValue = typeof PROFISSAO_OPTIONS[number]['value'];

const PROFISSAO_LABELS: Record<string, string> = Object.fromEntries(PROFISSAO_OPTIONS.map(p => [p.value, p.label]));

const COMPETENCIAS_POR_PROFISSAO: Record<string, string[]> = {
  medico: ['Clínica Geral', 'Emergência', 'UTI', 'Pediatria', 'Cirurgia', 'Obstetrícia', 'Cardiologia'],
  enfermeiro: ['UTI Neonatal', 'Triagem', 'Emergência', 'Curativos', 'Centro Cirúrgico', 'Ventilação Mecânica', 'Hemodiálise'],
  fisioterapeuta: ['Respiratória', 'Motora', 'Neurológica', 'Pediátrica', 'Aquática', 'Cardiovascular'],
  tecnico_enfermagem: ['UTI', 'Emergência', 'Centro Cirúrgico', 'Hemodiálise', 'Enfermaria', 'Triagem'],
  biomedico: ['Análises Clínicas', 'Hemoterapia', 'Imunologia', 'Microbiologia'],
  farmaceutico: ['Hospitalar', 'Clínica', 'Manipulação', 'Oncologia'],
};

const LIMITE_HORAS_MENSAL = CLT_LIMITE_MENSAL;

const emptyForm = {
  nome: '', profissao: 'medico' as ProfissaoValue, especialidade: '', conselho: '', registro: '',
  cpf: '', telefone: '', email: '',
  unidade_principal_id: '', setor_principal_id: '', status: 'ativo',
  observacoes: '', vinculo: '',
  documento_conselho: '', documento_numero: '', documento_validade: '',
  competencias: [] as string[],
  limite_trocas_plantao_mes: 3,
  limite_trocas_paciente_mes: 5,
};

export default function ProfissionaisPage() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 300);
  const [filterProfissao, setFilterProfissao] = useState('');
  const [filterUnidade, setFilterUnidade] = useState('');
  const [filterSetor, setFilterSetor] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'ativo' | 'inativo'>('');
  const [filterDisponivel, setFilterDisponivel] = useState(false);
  const [filterDocVencido, setFilterDocVencido] = useState(false);
  const [filterDocVencendo, setFilterDocVencendo] = useState(false);
  const [filterSobrecarga, setFilterSobrecarga] = useState(false);
  const [filterSemPlantao, setFilterSemPlantao] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();
  const navigate = useNavigate();

  useRealtimeInvalidation({
    tables: ["shifts", "shift_swaps", "professionals"],
    invalidate: [["professionals"], ["professionals-month-shifts"]],
    channelId: "profissionais-realtime",
  });

  const { data: professionals = [], isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['professionals'],
    queryFn: async () => {
      // PII-safe listing: explicit columns only, NO cpf/observacoes/banking/limites.
      // Sensitive fields are fetched on-demand when opening the edit modal.
      const { data, error } = await supabase
        .from('professionals')
        .select('id, nome, profissao, especialidade, conselho, registro, telefone, email, status, vinculo, unidade_principal_id, setor_principal_id, competencias, documento_conselho, documento_numero, documento_validade, avatar_url, units:unidade_principal_id(nome), sectors:setor_principal_id(nome)')
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  const { data: monthShifts = [] } = useQuery({
    queryKey: ['professionals-month-shifts'],
    queryFn: async () => {
      const now = new Date();
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const lastStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
      const { data } = await supabase.from('shifts').select('profissional_id, carga_horaria, data, hora_inicio, hora_fim, status, tipo_plantao, sectors:setor_id(nome)').gte('data', firstDay).lte('data', lastStr).neq('status', 'cancelado').order('data', { ascending: false });
      return data || [];
    },
  });

  const horasPorProfissional = useMemo(
    () => calcularHorasPorProfissional(monthShifts as any[]),
    [monthShifts]
  );

  // Últimos 3 plantões e disponibilidade hoje
  const ultimosPorProf = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const s of monthShifts as any[]) {
      if (!map[s.profissional_id]) map[s.profissional_id] = [];
      if (map[s.profissional_id].length < 3) map[s.profissional_id].push(s);
    }
    return map;
  }, [monthShifts]);

  const hojeStr = new Date().toISOString().split('T')[0];
  const ocupadosHoje = useMemo(() => {
    const set = new Set<string>();
    for (const s of monthShifts as any[]) {
      if (s.data === hojeStr) set.add(s.profissional_id);
    }
    return set;
  }, [monthShifts, hojeStr]);

  const { data: units = [] } = useQuery({ queryKey: ['units'], queryFn: async () => { const { data } = await supabase.from('units').select('*').order('nome'); return data || []; } });
  const { data: sectors = [] } = useQuery({ queryKey: ['sectors'], queryFn: async () => { const { data } = await supabase.from('sectors').select('*').order('nome'); return data || []; } });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const payload: any = {
        nome: data.nome, profissao: data.profissao, especialidade: data.especialidade || null,
        conselho: data.conselho || null, registro: data.registro || null, cpf: data.cpf || null,
        telefone: data.telefone || null, email: data.email,
        unidade_principal_id: data.unidade_principal_id || null, setor_principal_id: data.setor_principal_id || null,
        status: data.status, observacoes: data.observacoes || null, vinculo: data.vinculo || null,
        documento_conselho: data.documento_conselho || null, documento_numero: data.documento_numero || null,
        documento_validade: data.documento_validade || null,
        competencias: data.competencias.length > 0 ? data.competencias : null,
        limite_trocas_plantao_mes: data.limite_trocas_plantao_mes,
        limite_trocas_paciente_mes: data.limite_trocas_paciente_mes,
      };
      if (editingId) {
        const { error } = await supabase.from('professionals').update(payload).eq('id', editingId);
        if (error) throw error;
        await logAudit('Profissional editado', 'profissionais', { id: editingId, nome: data.nome });
      } else {
        const { error } = await supabase.from('professionals').insert(payload);
        if (error) throw error;
        await logAudit('Profissional cadastrado', 'profissionais', { nome: data.nome });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['professionals'] });
      toast.success(editingId ? 'Profissional atualizado!' : 'Profissional cadastrado!');
      closeModal();
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase.from('professionals').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      await logAudit(`Profissional ${newStatus === 'ativo' ? 'ativado' : 'inativado'}`, 'profissionais', { id });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['professionals'] }); toast.success('Status atualizado!'); },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const closeModal = () => { setModalOpen(false); setEditingId(null); setForm(emptyForm); };

  const openEdit = async (p: any) => {
    setEditingId(p.id);
    // Fetch sensitive fields on demand (not in listing)
    const { data: sensitive } = await supabase
      .from('professionals')
      .select('cpf, observacoes, limite_trocas_plantao_mes, limite_trocas_paciente_mes')
      .eq('id', p.id)
      .maybeSingle();
    setForm({
      nome: p.nome, profissao: p.profissao, especialidade: p.especialidade || '', conselho: p.conselho || '',
      registro: p.registro || '', cpf: sensitive?.cpf || '', telefone: p.telefone || '', email: p.email,
      unidade_principal_id: p.unidade_principal_id || '', setor_principal_id: p.setor_principal_id || '',
      status: p.status, observacoes: sensitive?.observacoes || '', vinculo: p.vinculo || '',
      documento_conselho: p.documento_conselho || '', documento_numero: p.documento_numero || '', documento_validade: p.documento_validade || '',
      competencias: Array.isArray(p.competencias) ? p.competencias : [],
      limite_trocas_plantao_mes: sensitive?.limite_trocas_plantao_mes ?? 3,
      limite_trocas_paciente_mes: sensitive?.limite_trocas_paciente_mes ?? 5,
    });
    setModalOpen(true);
  };

  // Document expiry helpers
  const docInfo = (validade?: string | null) => {
    if (!validade) return { vencido: false, vencendo: false, dias: null as number | null };
    const today = new Date(); today.setHours(0,0,0,0);
    const v = new Date(validade + 'T12:00:00');
    const dias = Math.round((v.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { vencido: dias < 0, vencendo: dias >= 0 && dias <= 30, dias };
  };

  const filtered = (professionals as any[]).filter((p: any) => {
    if (search) {
      const q = norm(search);
      const haystack = norm([
        p.nome, PROFISSAO_LABELS[p.profissao] || p.profissao, p.profissao,
        p.especialidade, p.conselho, p.registro, p.documento_conselho, p.documento_numero,
        p.email, p.telefone,
        (p.units as any)?.nome, (p.sectors as any)?.nome,
      ].filter(Boolean).join(' '));
      if (!haystack.includes(q)) return false;
    }
    if (filterProfissao && p.profissao !== filterProfissao) return false;
    if (filterUnidade && p.unidade_principal_id !== filterUnidade) return false;
    if (filterSetor && p.setor_principal_id !== filterSetor) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    if (filterDisponivel && (ocupadosHoje.has(p.id) || p.status !== 'ativo')) return false;
    const di = docInfo(p.documento_validade);
    if (filterDocVencido && !di.vencido) return false;
    if (filterDocVencendo && !di.vencendo) return false;
    const horasMes = horasPorProfissional[p.id] || 0;
    if (filterSobrecarga && horasMes < LIMITE_HORAS_MENSAL * 0.9) return false;
    if (filterSemPlantao && horasMes > 0) return false;
    return true;
  });

  const toggleCompetencia = (comp: string) => {
    setForm(f => ({
      ...f,
      competencias: f.competencias.includes(comp)
        ? f.competencias.filter(c => c !== comp)
        : [...f.competencias, comp],
    }));
  };

  const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
  const hasFilters = !!(
    filterProfissao || filterUnidade || filterSetor || filterStatus || filterDisponivel ||
    filterDocVencido || filterDocVencendo || filterSobrecarga || filterSemPlantao || search
  );

  const limparFiltros = () => {
    setSearchInput(''); setFilterProfissao(''); setFilterUnidade(''); setFilterSetor('');
    setFilterStatus(''); setFilterDisponivel(false); setFilterDocVencido(false);
    setFilterDocVencendo(false); setFilterSobrecarga(false); setFilterSemPlantao(false);
  };

  const printFicha = async (p: any) => {
    const horasMes = horasPorProfissional[p.id] || 0;
    const ultimos = ultimosPorProf[p.id] || [];
    const { data: { user } } = await supabase.auth.getUser();
    printFichaProfissional({
      profissionalId: p.id,
      nome: p.nome,
      profissao: PROFISSAO_LABELS[p.profissao] || p.profissao,
      especialidade: p.especialidade,
      conselho: p.conselho,
      registro: p.registro,
      unidadePrincipal: (p.units as any)?.nome || null,
      setorPrincipal: (p.sectors as any)?.nome || null,
      status: p.status,
      horasMes,
      limiteMes: LIMITE_HORAS_MENSAL,
      documentoConselho: p.documento_conselho,
      documentoNumero: p.documento_numero,
      documentoValidade: p.documento_validade,
      ultimosPlantoes: ultimos.map((s: any) => ({
        data: s.data, horaInicio: s.hora_inicio, horaFim: s.hora_fim, setor: (s.sectors as any)?.nome,
      })),
      emitidoPor: user?.email || undefined,
    });
    await logAudit('Ficha de profissional impressa', 'profissionais', { id: p.id });
  };

  const enviarMensagem = (p: any) => {
    const tel = (p.telefone || '').replace(/\D/g, '');
    if (!tel) {
      const subject = encodeURIComponent('Mensagem GestorPlantão');
      const body = encodeURIComponent(`Olá ${p.nome},\n\n`);
      window.open(`mailto:${p.email || ''}?subject=${subject}&body=${body}`, '_blank');
      return;
    }
    const msg = encodeURIComponent(`Olá ${p.nome}, mensagem da gestão da escala.`);
    window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank');
  };

  const validarDocumentos = (p: any) => {
    const di = docInfo(p.documento_validade);
    if (!p.documento_conselho && !p.documento_numero && !p.documento_validade) {
      toast.error('Profissional sem documento profissional cadastrado.');
      return;
    }
    if (di.vencido) {
      toast.error(`Documento ${p.documento_conselho || ''} ${p.documento_numero || ''} VENCIDO há ${Math.abs(di.dias!)} dias.`);
      return;
    }
    if (di.vencendo) {
      toast.warning(`Documento vence em ${di.dias} dias. Atualize antes do vencimento.`);
      return;
    }
    toast.success(`Documento válido${di.dias !== null ? ` por ${di.dias} dias` : ''}.`);
  };

  // ===== Ações do menu "Mais ações" (operam sobre lista filtrada) =====
  const exportarListaCSV = () => {
    if (filtered.length === 0) { toast.info('Nada para exportar com os filtros atuais.'); return; }
    const headers = ['Nome', 'Profissão', 'Conselho', 'Registro', 'E-mail', 'Telefone', 'Status', 'Vínculo'];
    const rows = filtered.map((p: any) => [
      p.nome || '', p.profissao || '', p.documento_conselho || p.conselho || '',
      p.documento_numero || p.registro || '', p.email || '', p.telefone || '',
      p.status || '', p.vinculo || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = '\ufeff' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `profissionais_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast.success(`${filtered.length} profissionais exportados.`);
    logAudit('Profissionais exportados (CSV)', 'profissionais', { total: filtered.length });
  };

  const imprimirLista = () => {
    if (filtered.length === 0) { toast.info('Nada para imprimir com os filtros atuais.'); return; }
    const w = window.open('', '_blank');
    if (!w) { toast.error('Bloqueio de pop-up. Permita janelas para imprimir.'); return; }
    const linhas = filtered.map((p: any) => `
      <tr>
        <td>${p.nome || ''}</td>
        <td>${(p.profissao || '').replace(/_/g, ' ')}</td>
        <td>${p.documento_conselho || p.conselho || ''} ${p.documento_numero || p.registro || ''}</td>
        <td>${p.email || ''}</td>
        <td>${p.telefone || ''}</td>
        <td>${p.status || ''}</td>
      </tr>`).join('');
    w.document.write(`<html><head><title>Profissionais</title>
      <style>body{font-family:Inter,Arial,sans-serif;padding:24px;color:#0f172a}
      h1{font-size:18px;margin:0 0 4px}p{font-size:12px;color:#64748b;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
      th{background:#f1f5f9}</style></head><body>
      <h1>Profissionais</h1>
      <p>Total: ${filtered.length} · Emitido em ${new Date().toLocaleString('pt-BR')}</p>
      <table><thead><tr><th>Nome</th><th>Profissão</th><th>Conselho/Registro</th><th>E-mail</th><th>Telefone</th><th>Status</th></tr></thead>
      <tbody>${linhas}</tbody></table>
      <script>window.onload=()=>{setTimeout(()=>window.print(),250)}</script>
      </body></html>`);
    w.document.close();
    logAudit('Lista de profissionais impressa', 'profissionais', { total: filtered.length });
  };

  const validarTodosDocumentos = () => {
    if (filtered.length === 0) { toast.info('Sem profissionais para validar.'); return; }
    let vencidos = 0, vencendo = 0, semDoc = 0, ok = 0;
    filtered.forEach((p: any) => {
      const di = docInfo(p.documento_validade);
      if (!p.documento_conselho && !p.documento_numero && !p.documento_validade) semDoc++;
      else if (di.vencido) vencidos++;
      else if (di.vencendo) vencendo++;
      else ok++;
    });
    if (vencidos > 0) toast.error(`${vencidos} documento(s) VENCIDO(s).`);
    if (vencendo > 0) toast.warning(`${vencendo} vencendo em até 30 dias.`);
    if (semDoc > 0) toast.info(`${semDoc} sem documento cadastrado.`);
    if (ok > 0) toast.success(`${ok} documento(s) regular(es).`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="module-title">Profissionais</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} de {professionals.length} profissionais</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <button onClick={() => { setForm(emptyForm); setEditingId(null); setModalOpen(true); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="h-4 w-4" /> Novo Profissional
          </button>
          <MoreActionsMenu
            triggerClassName="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
            items={[
              { id: 'importar', label: 'Importar', icon: <Upload />, onClick: () => toast.info('Importação por CSV em breve. Use a Edge Function user-admin para criar acessos.'), group: 'Documentos' },
              { id: 'exportar', label: 'Exportar CSV', icon: <Download />, onClick: exportarListaCSV, group: 'Documentos' },
              { id: 'imprimir', label: 'Imprimir lista', icon: <Printer />, onClick: imprimirLista, group: 'Documentos' },
              { id: 'validar', label: 'Validar documentos', icon: <FileCheck2 />, onClick: validarTodosDocumentos, group: 'Gestão' },
            ]}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 flex-1 min-w-[240px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input type="text"
              placeholder="Buscar por nome, profissão, conselho, registro, e-mail, telefone, unidade, setor..."
              value={searchInput} onChange={e => setSearchInput(e.target.value)}
              className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground" />
            {searchInput && (
              <button onClick={() => setSearchInput('')} aria-label="Limpar busca" className="p-0.5 rounded hover:bg-muted text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <select value={filterProfissao} onChange={e => setFilterProfissao(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
            <option value="">Todas profissões</option>
            {PROFISSAO_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={filterUnidade} onChange={e => { setFilterUnidade(e.target.value); setFilterSetor(''); }} className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
            <option value="">Todas unidades</option>
            {(units as any[]).map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
          <select value={filterSetor} onChange={e => setFilterSetor(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
            <option value="">Todos setores</option>
            {(sectors as any[]).filter((s: any) => !filterUnidade || s.unidade_id === filterUnidade).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
            <option value="">Todos status</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>
          <button onClick={() => setShowAdvanced(v => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border bg-card text-foreground border-border hover:bg-muted">
            <Filter className="h-4 w-4" /> Mais filtros
          </button>
          {hasFilters && (
            <button onClick={limparFiltros}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1">
              <X className="h-3 w-3" /> Limpar
            </button>
          )}
        </div>

        {showAdvanced && (
          <div className="flex flex-wrap gap-2 items-center pt-1">
            {([
              { state: filterDisponivel, set: setFilterDisponivel, label: 'Disponível hoje', icon: CalIcon, on: 'bg-success text-success-foreground border-success', off: 'hover:border-success/50' },
              { state: filterDocVencido, set: setFilterDocVencido, label: 'Documento vencido', icon: AlertTriangle, on: 'bg-destructive text-destructive-foreground border-destructive', off: 'hover:border-destructive/50' },
              { state: filterDocVencendo, set: setFilterDocVencendo, label: 'Documento vencendo (30d)', icon: AlertTriangle, on: 'bg-warning text-warning-foreground border-warning', off: 'hover:border-warning/50' },
              { state: filterSobrecarga, set: setFilterSobrecarga, label: 'Sobrecarga (≥90%)', icon: AlertTriangle, on: 'bg-destructive text-destructive-foreground border-destructive', off: 'hover:border-destructive/50' },
              { state: filterSemPlantao, set: setFilterSemPlantao, label: 'Sem plantão no mês', icon: CalIcon, on: 'bg-primary text-primary-foreground border-primary', off: 'hover:border-primary/50' },
            ] as const).map((f, idx) => {
              const Icon = f.icon;
              return (
                <button key={idx} onClick={() => f.set(!f.state as any)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${f.state ? f.on : `bg-card text-muted-foreground border-border ${f.off}`}`}>
                  <Icon className="h-3.5 w-3.5" /> {f.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isLoading ? (
        <CardListSkeleton count={6} />
      ) : isError ? (
        <ErrorState
          title="Não foi possível carregar os profissionais"
          description="Erro ao consultar a lista de profissionais. Tente novamente."
          onRetry={() => refetch()}
          retryLoading={isRefetching}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p: any, i: number) => {
            const horasMes = horasPorProfissional[p.id] || 0;
            const percentHoras = calcularCargaPercentual(horasMes, LIMITE_HORAS_MENSAL);
            const horasColor = percentHoras >= 90 ? 'text-destructive' : percentHoras >= 70 ? 'text-warning' : 'text-success';
            const ultimos = ultimosPorProf[p.id] || [];
            const ocupadoHoje = ocupadosHoje.has(p.id);
            const disponivel = p.status === 'ativo' && !ocupadoHoje;
            const di = docInfo(p.documento_validade);
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}
                className="bg-card rounded-xl border border-border p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all">
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.nome} className="h-12 w-12 rounded-full object-cover border-2 border-border" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center font-display font-semibold text-primary">
                        {p.nome.split(' ').map((n: string) => n[0]).slice(0,2).join('')}
                      </div>
                    )}
                    {p.status === 'ativo' && (
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${disponivel ? 'bg-success' : 'bg-warning'}`} title={disponivel ? 'Disponível hoje' : 'Em plantão hoje'} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-semibold text-foreground truncate">{p.nome}</h3>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`status-badge text-[10px] cursor-pointer ${p.status === 'ativo' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}
                          onClick={() => toggleStatusMutation.mutate({ id: p.id, newStatus: p.status === 'ativo' ? 'inativo' : 'ativo' })}>
                          {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </span>
                        <button onClick={() => openEdit(p)} className="p-1 rounded hover:bg-muted" title="Editar"><Edit className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 rounded hover:bg-muted" title="Ações rápidas">
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => navigate(`/escala?profissional=${p.id}`)}>
                              <CalIcon className="h-4 w-4 mr-2" /> Ver escala
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/escala?profissional=${p.id}&aba=historico`)}>
                              <History className="h-4 w-4 mr-2" /> Ver histórico
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/escala?profissional=${p.id}&novo=1`)}>
                              <Plus className="h-4 w-4 mr-2" /> Criar plantão
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => printFicha(p)}>
                              <Printer className="h-4 w-4 mr-2" /> Imprimir ficha resumida
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => enviarMensagem(p)}>
                              <MessageSquare className="h-4 w-4 mr-2" /> Enviar mensagem
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => validarDocumentos(p)}>
                              <FileCheck2 className="h-4 w-4 mr-2" /> Validar documentos
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <p className="text-sm text-primary font-medium">{PROFISSAO_LABELS[p.profissao] || p.profissao}</p>
                    <p className="text-xs text-muted-foreground">{p.especialidade || '—'}{p.registro ? ` · ${p.registro}` : ''}</p>

                    {(di.vencido || di.vencendo) && (
                      <div className={`mt-2 flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border ${di.vencido ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-warning/10 text-warning border-warning/30'}`}>
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span className="font-medium">
                          {di.vencido ? `Documento VENCIDO há ${Math.abs(di.dias!)}d` : `Documento vence em ${di.dias}d`}
                        </span>
                      </div>
                    )}

                    {p.status === 'ativo' && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-muted-foreground">Horas no mês</span>
                          <span className={`text-[10px] font-semibold ${horasColor}`}>{horasMes.toFixed(0)}h / {LIMITE_HORAS_MENSAL}h</span>
                        </div>
                        <Progress value={percentHoras} className="h-1.5" />
                      </div>
                    )}

                    {ultimos.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Últimos plantões</p>
                        <div className="space-y-1">
                          {ultimos.map((s: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-[11px]">
                              <span className="text-foreground">{new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                              <span className="text-muted-foreground font-mono">{s.hora_inicio?.slice(0,5)}–{s.hora_fim?.slice(0,5)}</span>
                              <span className="text-muted-foreground truncate max-w-[80px]">{(s.sectors as any)?.nome || '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border gap-2">
                      <span className="text-xs text-muted-foreground truncate">{(p.units as any)?.nome || '—'}</span>
                      <ContactActionButton profissional={{ nome: p.nome, telefone: p.telefone }} contexto={{ tipo: 'geral' }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon={User2}
                title="Nenhum profissional encontrado"
                description="Ajuste a busca ou os filtros para localizar profissionais."
              />
            </div>
          )}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Profissional' : 'Novo Profissional'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-sm font-medium text-foreground">Nome completo *</label><input required value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-foreground">Profissão *</label>
                <select required value={form.profissao} onChange={e => setForm(f => ({ ...f, profissao: e.target.value as ProfissaoValue, competencias: [] }))} className={inputClass}>
                  {PROFISSAO_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div><label className="text-sm font-medium text-foreground">Especialidade</label><input value={form.especialidade} onChange={e => setForm(f => ({ ...f, especialidade: e.target.value }))} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-foreground">Conselho</label><input value={form.conselho} onChange={e => setForm(f => ({ ...f, conselho: e.target.value }))} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-foreground">Registro</label><input value={form.registro} onChange={e => setForm(f => ({ ...f, registro: e.target.value }))} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-foreground">CPF</label><input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-foreground">Telefone</label><input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-foreground">E-mail *</label><input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-foreground">Unidade principal</label>
                <select value={form.unidade_principal_id} onChange={e => setForm(f => ({ ...f, unidade_principal_id: e.target.value }))} className={inputClass}>
                  <option value="">Selecione...</option>
                  {units.map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
              <div><label className="text-sm font-medium text-foreground">Setor principal</label>
                <select value={form.setor_principal_id} onChange={e => setForm(f => ({ ...f, setor_principal_id: e.target.value }))} className={inputClass}>
                  <option value="">Selecione...</option>
                  {sectors.filter((s: any) => !form.unidade_principal_id || s.unidade_id === form.unidade_principal_id).map((s: any) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
              <div><label className="text-sm font-medium text-foreground">Vínculo</label><input value={form.vinculo} onChange={e => setForm(f => ({ ...f, vinculo: e.target.value }))} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-foreground">Conselho (CRM/COREN)</label><input placeholder="Ex: CRM" value={form.documento_conselho} onChange={e => setForm(f => ({ ...f, documento_conselho: e.target.value }))} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-foreground">Nº Documento</label><input value={form.documento_numero} onChange={e => setForm(f => ({ ...f, documento_numero: e.target.value }))} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-foreground">Validade do Documento</label><input type="date" value={form.documento_validade} onChange={e => setForm(f => ({ ...f, documento_validade: e.target.value }))} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-foreground">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
                  <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
                </select>
              </div>
            </div>

            {/* Limites mensais */}
            <div className="border border-border rounded-lg p-3 bg-muted/30">
              <h4 className="text-sm font-semibold text-foreground mb-2">Regras de Utilização (mensal)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Limite de Trocas de Plantão</label>
                  <input type="number" min={0} max={50} value={form.limite_trocas_plantao_mes} onChange={e => setForm(f => ({ ...f, limite_trocas_plantao_mes: Math.max(0, parseInt(e.target.value) || 0) }))} className={inputClass} />
                  <p className="text-[11px] text-muted-foreground mt-1">Máximo de trocas que este profissional pode solicitar por mês.</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Limite de Trocas de Paciente</label>
                  <input type="number" min={0} max={50} value={form.limite_trocas_paciente_mes} onChange={e => setForm(f => ({ ...f, limite_trocas_paciente_mes: Math.max(0, parseInt(e.target.value) || 0) }))} className={inputClass} />
                  <p className="text-[11px] text-muted-foreground mt-1">Máximo de transferências de pacientes por mês.</p>
                </div>
              </div>
            </div>

            {COMPETENCIAS_POR_PROFISSAO[form.profissao] && (
              <div className="border border-border rounded-lg p-3">
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Competências / Certificações ({PROFISSAO_LABELS[form.profissao]})
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMPETENCIAS_POR_PROFISSAO[form.profissao].map(comp => (
                    <button key={comp} type="button" onClick={() => toggleCompetencia(comp)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        form.competencias.includes(comp)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                      }`}>
                      {form.competencias.includes(comp) ? '✓ ' : ''}{comp}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div><label className="text-sm font-medium text-foreground">Observações internas</label><textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} className={inputClass} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saveMutation.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
