import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { Search, Plus, User2, Edit, Calendar as CalIcon, X } from "lucide-react";
import { ContactActionButton } from "@/components/ContactActionButton";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

const LIMITE_HORAS_MENSAL = 220;

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
  const [search, setSearch] = useState('');
  const [filterProfissao, setFilterProfissao] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();

  const { data: professionals = [], isLoading } = useQuery({
    queryKey: ['professionals'],
    queryFn: async () => {
      const { data, error } = await supabase.from('professionals').select('*, units:unidade_principal_id(nome), sectors:setor_principal_id(nome)').order('nome');
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
      const { data } = await supabase.from('shifts').select('profissional_id, carga_horaria').gte('data', firstDay).lte('data', lastStr).neq('status', 'cancelado');
      return data || [];
    },
  });

  const horasPorProfissional = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of monthShifts as any[]) {
      map[s.profissional_id] = (map[s.profissional_id] || 0) + Number(s.carga_horaria);
    }
    return map;
  }, [monthShifts]);

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

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      nome: p.nome, profissao: p.profissao, especialidade: p.especialidade || '', conselho: p.conselho || '',
      registro: p.registro || '', cpf: p.cpf || '', telefone: p.telefone || '', email: p.email,
      unidade_principal_id: p.unidade_principal_id || '', setor_principal_id: p.setor_principal_id || '',
      status: p.status, observacoes: p.observacoes || '', vinculo: p.vinculo || '',
      documento_conselho: p.documento_conselho || '', documento_numero: p.documento_numero || '', documento_validade: p.documento_validade || '',
      competencias: Array.isArray(p.competencias) ? p.competencias : [],
      limite_trocas_plantao_mes: p.limite_trocas_plantao_mes ?? 3,
      limite_trocas_paciente_mes: p.limite_trocas_paciente_mes ?? 5,
    });
    setModalOpen(true);
  };

  const filtered = (professionals as any[]).filter((p: any) => {
    if (search && !p.nome.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterProfissao && p.profissao !== filterProfissao) return false;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="module-title">Profissionais</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} profissionais cadastrados</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditingId(null); setModalOpen(true); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity self-start">
          <Plus className="h-4 w-4" /> Novo Profissional
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent text-sm outline-none w-48 placeholder:text-muted-foreground" />
        </div>
        <select value={filterProfissao} onChange={e => setFilterProfissao(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
          <option value="">Todas as profissões</option>
          {PROFISSAO_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p: any, i: number) => {
            const horasMes = horasPorProfissional[p.id] || 0;
            const percentHoras = Math.min(100, (horasMes / LIMITE_HORAS_MENSAL) * 100);
            const horasColor = percentHoras >= 90 ? 'text-destructive' : percentHoras >= 70 ? 'text-warning' : 'text-success';
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="bg-card rounded-lg border border-border p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-semibold text-foreground truncate">{p.nome}</h3>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(p)} className="p-1 rounded hover:bg-muted"><Edit className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <span className={`status-badge text-[10px] cursor-pointer ${p.status === 'ativo' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}
                          onClick={() => toggleStatusMutation.mutate({ id: p.id, newStatus: p.status === 'ativo' ? 'inativo' : 'ativo' })}>
                          {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-primary font-medium">{PROFISSAO_LABELS[p.profissao] || p.profissao}</p>
                    <p className="text-xs text-muted-foreground">{p.especialidade} • {p.registro}</p>

                    {p.status === 'ativo' && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-muted-foreground">Horas no mês</span>
                          <span className={`text-[10px] font-semibold ${horasColor}`}>{horasMes.toFixed(0)}h / {LIMITE_HORAS_MENSAL}h</span>
                        </div>
                        <Progress value={percentHoras} className="h-1.5" />
                      </div>
                    )}

                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="truncate">{p.email}</span>
                      <ContactActionButton profissional={{ nome: p.nome, telefone: p.telefone }} contexto={{ tipo: 'geral' }} />
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                      <span className="text-xs text-muted-foreground truncate">{(p.units as any)?.nome || '—'}</span>
                      <span className="text-[10px] text-muted-foreground">
                        Trocas: <strong className="text-foreground">{p.limite_trocas_plantao_mes ?? 3}/mês</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
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
