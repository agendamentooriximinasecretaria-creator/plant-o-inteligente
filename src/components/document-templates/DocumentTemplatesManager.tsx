import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  FileText, Plus, Edit3, Copy, Trash2, Eye, Search, Filter, Lock,
  Globe, Building2, Layers, User as UserIcon, Save, X, Printer, Download,
  AlertTriangle, Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { RichEditor } from './RichEditor';
import {
  DocumentTemplate, DocumentTemplateType, DocumentScope, ABNTConfig,
  TIPO_LABEL, VARIAVEIS_PADRAO, DEFAULT_ABNT,
} from './types';
import { gerarPdfDocumentTemplate } from '@/lib/printDocumentTemplate';
import { extractVariables, findUnknownVariables } from '@/lib/documentVariables';

const SCOPE_ICON: Record<DocumentScope, JSX.Element> = {
  global: <Globe className="h-3.5 w-3.5" />,
  unidade: <Building2 className="h-3.5 w-3.5" />,
  setor: <Layers className="h-3.5 w-3.5" />,
  pessoal: <UserIcon className="h-3.5 w-3.5" />,
};

const SCOPE_LABEL: Record<DocumentScope, string> = {
  global: 'Global', unidade: 'Unidade', setor: 'Setor', pessoal: 'Pessoal',
};

export default function DocumentTemplatesManager() {
  const qc = useQueryClient();
  const { isMaster, isCoordinator, isProfessional, professionalId } = useAuth();
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [filterEscopo, setFilterEscopo] = useState<string>('todos');
  const [editing, setEditing] = useState<DocumentTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['document-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .order('is_system_default', { ascending: false })
        .order('tipo')
        .order('nome');
      if (error) throw error;
      return (data as any[] as DocumentTemplate[]);
    },
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units-list'],
    queryFn: async () => {
      const { data } = await supabase.from('units').select('id, nome').order('nome');
      return data || [];
    },
  });

  const { data: sectors = [] } = useQuery({
    queryKey: ['sectors-list'],
    queryFn: async () => {
      const { data } = await supabase.from('sectors').select('id, nome, unidade_id').order('nome');
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (filterTipo !== 'todos' && t.tipo !== filterTipo) return false;
      if (filterEscopo !== 'todos' && t.escopo !== filterEscopo) return false;
      if (search && !t.nome.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [templates, filterTipo, filterEscopo, search]);

  const canEdit = (t: DocumentTemplate) => {
    if (t.is_system_default) return false;
    if (isMaster) return true;
    if (isCoordinator) return t.escopo === 'unidade' || t.escopo === 'setor';
    if (isProfessional) return t.escopo === 'pessoal' && t.owner_profissional_id === professionalId;
    return false;
  };

  const canDelete = canEdit;

  const canCreate = isMaster || isCoordinator || isProfessional;

  const duplicate = useMutation({
    mutationFn: async (t: DocumentTemplate) => {
      const novo: any = {
        nome: `${t.nome} (cópia)`,
        tipo: t.tipo,
        descricao: t.descricao,
        sigla: t.sigla,
        escopo: isProfessional && !isMaster && !isCoordinator ? 'pessoal' : t.escopo === 'global' && !isMaster ? 'unidade' : t.escopo,
        unidade_id: t.unidade_id,
        setor_id: t.setor_id,
        owner_profissional_id: isProfessional ? professionalId : t.owner_profissional_id,
        perfis_uso: t.perfis_uso,
        perfis_edicao: t.perfis_edicao,
        conteudo_html: t.conteudo_html,
        abnt_config: t.abnt_config,
        variaveis_disponiveis: t.variaveis_disponiveis,
        ativo: true,
        is_system_default: false,
        is_personalizado: true,
      };
      const { data, error } = await supabase.from('document_templates').insert(novo).select('*').single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success('Modelo duplicado!'); qc.invalidateQueries({ queryKey: ['document-templates'] }); },
    onError: (e: any) => toast.error('Erro ao duplicar: ' + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('document_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Modelo removido!'); qc.invalidateQueries({ queryKey: ['document-templates'] }); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const previewPdf = async (t: DocumentTemplate, acao: 'open' | 'save' | 'print' = 'open') => {
    try {
      // Tenta usar dados reais do usuário corrente quando aplicável; cai em samples se não houver.
      const ctx: any = { profissionalId: professionalId || undefined };
      const now = new Date();
      ctx.mes = now.getMonth() + 1;
      ctx.ano = now.getFullYear();
      ctx.unidadeId = t.unidade_id || undefined;
      ctx.setorId = t.setor_id || undefined;
      await gerarPdfDocumentTemplate({
        nome: t.nome,
        conteudoHtml: t.conteudo_html,
        abnt: t.abnt_config,
        context: ctx,
        useSamples: !professionalId, // sem profissional vinculado, usa amostras
        acao,
      });
    } catch (e: any) {
      toast.error('Erro ao gerar PDF: ' + e.message);
    }
  };

  if (editing || creating) {
    return (
      <TemplateEditor
        template={editing}
        isCreating={creating}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={() => { qc.invalidateQueries({ queryKey: ['document-templates'] }); setEditing(null); setCreating(false); }}
        units={units}
        sectors={sectors}
        canChooseScope={{ master: isMaster, coordenador: isCoordinator, professional: isProfessional }}
        professionalId={professionalId}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className="w-full pl-9 pr-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
          className="bg-muted border border-border rounded-lg px-3 py-2 text-sm">
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPO_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={filterEscopo} onChange={e => setFilterEscopo(e.target.value)}
          className="bg-muted border border-border rounded-lg px-3 py-2 text-sm">
          <option value="todos">Todos escopos</option>
          <option value="global">Global</option>
          <option value="unidade">Unidade</option>
          <option value="setor">Setor</option>
          <option value="pessoal">Pessoal</option>
        </select>
        {canCreate && (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="h-4 w-4" /> Novo Modelo
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando modelos...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum modelo encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(t => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)] flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {SCOPE_ICON[t.escopo]} {SCOPE_LABEL[t.escopo]}
                    </span>
                    {t.is_system_default && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        <Lock className="h-3 w-3" /> Padrão
                      </span>
                    )}
                    {!t.ativo && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-warning/10 text-warning">Inativo</span>
                    )}
                  </div>
                  <h4 className="font-display font-semibold text-sm text-foreground truncate" title={t.nome}>{t.nome}</h4>
                  <p className="text-xs text-muted-foreground truncate">{TIPO_LABEL[t.tipo]}</p>
                </div>
              </div>
              {t.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{t.descricao}</p>}
              <div className="flex items-center gap-1.5 mt-auto pt-2 border-t border-border">
                <button onClick={() => previewPdf(t, 'open')} title="Pré-visualizar PDF"
                  className="p-1.5 rounded hover:bg-muted text-foreground"><Eye className="h-4 w-4" /></button>
                <button onClick={() => previewPdf(t, 'save')} title="Baixar PDF"
                  className="p-1.5 rounded hover:bg-muted text-foreground"><Download className="h-4 w-4" /></button>
                <button onClick={() => previewPdf(t, 'print')} title="Imprimir"
                  className="p-1.5 rounded hover:bg-muted text-foreground"><Printer className="h-4 w-4" /></button>
                <div className="flex-1" />
                {canCreate && (
                  <button onClick={() => duplicate.mutate(t)} title="Duplicar"
                    className="p-1.5 rounded hover:bg-muted text-foreground"><Copy className="h-4 w-4" /></button>
                )}
                {canEdit(t) && (
                  <button onClick={() => setEditing(t)} title="Editar"
                    className="p-1.5 rounded hover:bg-muted text-primary"><Edit3 className="h-4 w-4" /></button>
                )}
                {canDelete(t) && (
                  <button onClick={() => { if (confirm(`Excluir o modelo "${t.nome}"?`)) remove.mutate(t.id); }}
                    title="Excluir" className="p-1.5 rounded hover:bg-destructive/10 text-destructive">
                    <Trash2 className="h-4 w-4" /></button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============== EDITOR ==============

function TemplateEditor({
  template, isCreating, onClose, onSaved, units, sectors,
  canChooseScope, professionalId,
}: {
  template: DocumentTemplate | null;
  isCreating: boolean;
  onClose: () => void;
  onSaved: () => void;
  units: any[];
  sectors: any[];
  canChooseScope: { master: boolean; coordenador: boolean; professional: boolean };
  professionalId: string | null;
}) {
  const isNew = isCreating;
  const initialTipo: DocumentTemplateType = template?.tipo || 'personalizado';
  const initialEscopo: DocumentScope = template?.escopo
    || (canChooseScope.master ? 'global' : canChooseScope.coordenador ? 'unidade' : 'pessoal');

  const [form, setForm] = useState({
    nome: template?.nome || '',
    tipo: initialTipo,
    descricao: template?.descricao || '',
    sigla: template?.sigla || '',
    escopo: initialEscopo,
    unidade_id: template?.unidade_id || null as string | null,
    setor_id: template?.setor_id || null as string | null,
    owner_profissional_id: template?.owner_profissional_id || (initialEscopo === 'pessoal' ? professionalId : null),
    perfis_uso: template?.perfis_uso || ['gestor_master', 'coordenador', 'profissional_saude'],
    perfis_edicao: template?.perfis_edicao || ['gestor_master'],
    ativo: template?.ativo ?? true,
    is_personalizado: template?.is_personalizado ?? true,
  });
  const [conteudo, setConteudo] = useState<string>(template?.conteudo_html || '');
  const [abnt, setAbnt] = useState<ABNTConfig>(template?.abnt_config || DEFAULT_ABNT);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const variaveis = VARIAVEIS_PADRAO[form.tipo] || [];
  const usadas = useMemo(() => extractVariables(conteudo), [conteudo]);
  const desconhecidas = useMemo(() => findUnknownVariables(conteudo), [conteudo]);

  const updateAbnt = <K extends keyof ABNTConfig>(k: K, v: ABNTConfig[K]) => setAbnt(p => ({ ...p, [k]: v }));

  async function save() {
    if (!form.nome.trim()) { toast.error('Informe um nome para o modelo.'); return; }
    if (desconhecidas.length > 0) {
      const ok = window.confirm(
        `Atenção: ${desconhecidas.length} variável(is) não reconhecida(s):\n\n${desconhecidas.map(v => `{{${v}}}`).join(', ')}\n\nElas serão renderizadas como vazias. Deseja salvar mesmo assim?`
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const payload: any = {
        nome: form.nome.trim(),
        tipo: form.tipo,
        descricao: form.descricao || null,
        sigla: form.sigla || null,
        escopo: form.escopo,
        unidade_id: form.escopo === 'unidade' || form.escopo === 'setor' ? form.unidade_id : null,
        setor_id: form.escopo === 'setor' ? form.setor_id : null,
        owner_profissional_id: form.escopo === 'pessoal' ? professionalId : null,
        perfis_uso: form.perfis_uso,
        perfis_edicao: form.perfis_edicao,
        conteudo_html: conteudo,
        abnt_config: abnt as any,
        variaveis_disponiveis: usadas, // chaves realmente referenciadas no conteúdo
        ativo: form.ativo,
        is_personalizado: form.is_personalizado,
      };

      if (isNew) {
        const { data: u } = await supabase.auth.getUser();
        payload.created_by = u.user?.id || null;
        const { error } = await supabase.from('document_templates').insert(payload);
        if (error) throw error;
        toast.success('Modelo criado!');
      } else if (template) {
        const { error } = await supabase
          .from('document_templates')
          .update({ ...payload, versao: (template.versao || 1) + 1 })
          .eq('id', template.id);
        if (error) throw error;
        toast.success('Modelo atualizado!');
      }
      onSaved();
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function previewPdf(acao: 'open' | 'print', modo: 'amostras' | 'reais' = 'amostras') {
    try {
      await gerarPdfDocumentTemplate({
        nome: form.nome || 'preview',
        conteudoHtml: conteudo,
        abnt,
        useSamples: modo === 'amostras',
        context: modo === 'reais' ? {
          profissionalId: professionalId || undefined,
          unidadeId: form.unidade_id || undefined,
          setorId: form.setor_id || undefined,
          mes: new Date().getMonth() + 1,
          ano: new Date().getFullYear(),
        } : undefined,
        acao,
      });
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  }

  function restaurarPadrao() {
    setAbnt(DEFAULT_ABNT);
    toast.success('Configurações ABNT restauradas para o padrão.');
  }

  const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
  const labelClass = "text-xs font-medium text-muted-foreground mb-1 block";

  const escoposPermitidos: DocumentScope[] = canChooseScope.master
    ? ['global', 'unidade', 'setor', 'pessoal']
    : canChooseScope.coordenador
      ? ['unidade', 'setor']
      : ['pessoal'];

  const setoresFiltrados = form.unidade_id ? sectors.filter(s => s.unidade_id === form.unidade_id) : sectors;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={onClose} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-1">
            <X className="h-4 w-4" /> Voltar
          </button>
          <h2 className="font-display text-xl font-semibold text-foreground">
            {isNew ? 'Novo Modelo de Documento' : `Editar: ${template?.nome}`}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => previewPdf('open', 'amostras')}
            className="flex items-center gap-2 border border-border px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted">
            <Eye className="h-4 w-4" /> Pré-visualizar
          </button>
          <button onClick={() => previewPdf('open', 'reais')}
            className="flex items-center gap-2 border border-border px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted"
            title="Substitui variáveis com dados reais do sistema">
            <Sparkles className="h-4 w-4" /> Pré-visualizar com dados reais
          </button>
          <button onClick={restaurarPadrao}
            className="flex items-center gap-2 border border-border px-3 py-2 rounded-lg text-sm hover:bg-muted">
            Restaurar ABNT
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {desconhecidas.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>Variáveis não reconhecidas detectadas:</strong>{' '}
            {desconhecidas.map(v => <code key={v} className="font-mono mx-0.5">{`{{${v}}}`}</code>)}
            . Elas serão renderizadas como vazias na exportação.
          </div>
        </div>
      )}
      {usadas.length > 0 && desconhecidas.length === 0 && (
        <div className="text-[11px] text-muted-foreground px-1">
          {usadas.length} variável(is) em uso: {usadas.map(v => <code key={v} className="font-mono mx-0.5 px-1 bg-muted rounded">{`{{${v}}}`}</code>)}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-4">
        {/* Editor */}
        <div className="space-y-3">
          <RichEditor
            value={conteudo}
            onChange={setConteudo}
            variaveis={variaveis}
            font={abnt.font}
            fontSize={abnt.fontSize}
            lineHeight={abnt.lineHeight}
          />
        </div>

        {/* Sidebar de configurações */}
        <div className="space-y-4">
          {/* Identificação */}
          <Section title="Identificação">
            <div>
              <label className={labelClass}>Nome do modelo *</label>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                className={inputClass} placeholder="Ex: Escala UTI - Junho/2026" />
            </div>
            <div>
              <label className={labelClass}>Tipo</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as DocumentTemplateType }))}
                className={inputClass}>
                {Object.entries(TIPO_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Sigla</label>
              <input value={form.sigla} onChange={e => setForm(f => ({ ...f, sigla: e.target.value }))}
                className={inputClass} maxLength={10} />
            </div>
            <div>
              <label className={labelClass}>Descrição</label>
              <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                rows={2} className={inputClass} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
              Ativo
            </label>
          </Section>

          {/* Escopo / vínculos */}
          <Section title="Escopo & Vínculos">
            <div>
              <label className={labelClass}>Escopo</label>
              <select value={form.escopo} onChange={e => setForm(f => ({ ...f, escopo: e.target.value as DocumentScope }))}
                className={inputClass}
                disabled={escoposPermitidos.length === 1 && !isNew}>
                {escoposPermitidos.map(s => <option key={s} value={s}>{SCOPE_LABEL[s]}</option>)}
              </select>
            </div>
            {(form.escopo === 'unidade' || form.escopo === 'setor') && (
              <div>
                <label className={labelClass}>Unidade</label>
                <select value={form.unidade_id || ''} onChange={e => setForm(f => ({ ...f, unidade_id: e.target.value || null, setor_id: null }))}
                  className={inputClass}>
                  <option value="">— selecione —</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
            )}
            {form.escopo === 'setor' && (
              <div>
                <label className={labelClass}>Setor</label>
                <select value={form.setor_id || ''} onChange={e => setForm(f => ({ ...f, setor_id: e.target.value || null }))}
                  className={inputClass}>
                  <option value="">— selecione —</option>
                  {setoresFiltrados.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
            )}
          </Section>

          {/* Permissões */}
          <Section title="Permissões">
            <div>
              <label className={labelClass}>Quem pode usar</label>
              {(['gestor_master', 'coordenador', 'profissional_saude'] as const).map(p => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.perfis_uso.includes(p)}
                    onChange={e => setForm(f => ({ ...f, perfis_uso: e.target.checked ? [...f.perfis_uso, p] : f.perfis_uso.filter(x => x !== p) }))} />
                  {p === 'gestor_master' ? 'Gestor Master' : p === 'coordenador' ? 'Coordenador' : 'Profissional'}
                </label>
              ))}
            </div>
            <div>
              <label className={labelClass}>Quem pode editar</label>
              {(['gestor_master', 'coordenador', 'profissional_saude'] as const).map(p => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.perfis_edicao.includes(p)}
                    onChange={e => setForm(f => ({ ...f, perfis_edicao: e.target.checked ? [...f.perfis_edicao, p] : f.perfis_edicao.filter(x => x !== p) }))} />
                  {p === 'gestor_master' ? 'Gestor Master' : p === 'coordenador' ? 'Coordenador' : 'Profissional'}
                </label>
              ))}
            </div>
          </Section>

          {/* ABNT */}
          <Section title="Configuração ABNT">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Orientação</label>
                <select value={abnt.orientation} onChange={e => updateAbnt('orientation', e.target.value as any)} className={inputClass}>
                  <option value="portrait">Retrato</option>
                  <option value="landscape">Paisagem</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Página</label>
                <input value="A4" disabled className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Fonte</label>
                <select value={abnt.font} onChange={e => updateAbnt('font', e.target.value as any)} className={inputClass}>
                  <option value="Times">Times New Roman</option>
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Courier">Courier</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Tamanho (pt)</label>
                <input type="number" min={8} max={24} value={abnt.fontSize}
                  onChange={e => updateAbnt('fontSize', parseInt(e.target.value) || 12)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Espaçamento</label>
                <input type="number" step="0.1" min={1} max={3} value={abnt.lineHeight}
                  onChange={e => updateAbnt('lineHeight', parseFloat(e.target.value) || 1.5)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Recuo (cm)</label>
                <input type="number" step="0.05" min={0} max={5} value={abnt.indent}
                  onChange={e => updateAbnt('indent', parseFloat(e.target.value) || 0)} className={inputClass} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Alinhamento padrão</label>
                <select value={abnt.align} onChange={e => updateAbnt('align', e.target.value as any)} className={inputClass}>
                  <option value="left">Esquerda</option>
                  <option value="center">Centralizado</option>
                  <option value="right">Direita</option>
                  <option value="justify">Justificado</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Margens (mm)</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['top', 'right', 'bottom', 'left'] as const).map(side => (
                  <div key={side}>
                    <span className="text-[10px] text-muted-foreground uppercase">{side === 'top' ? 'Sup' : side === 'bottom' ? 'Inf' : side === 'left' ? 'Esq' : 'Dir'}</span>
                    <input type="number" min={5} max={60} value={abnt.margins[side]}
                      onChange={e => updateAbnt('margins', { ...abnt.margins, [side]: parseInt(e.target.value) || 20 })}
                      className={inputClass} />
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Cabeçalho/Rodapé */}
          <Section title="Cabeçalho">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={abnt.header.enabled}
                onChange={e => updateAbnt('header', { ...abnt.header, enabled: e.target.checked })} />
              Habilitar cabeçalho
            </label>
            {abnt.header.enabled && (
              <>
                <input value={abnt.header.text}
                  onChange={e => updateAbnt('header', { ...abnt.header, text: e.target.value })}
                  placeholder="Texto do cabeçalho" className={inputClass} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={abnt.header.showLogo}
                    onChange={e => updateAbnt('header', { ...abnt.header, showLogo: e.target.checked })} />
                  Mostrar logo
                </label>
              </>
            )}
          </Section>

          <Section title="Rodapé">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={abnt.footer.enabled}
                onChange={e => updateAbnt('footer', { ...abnt.footer, enabled: e.target.checked })} />
              Habilitar rodapé
            </label>
            {abnt.footer.enabled && (
              <>
                <input value={abnt.footer.text}
                  onChange={e => updateAbnt('footer', { ...abnt.footer, text: e.target.value })}
                  placeholder="Texto do rodapé" className={inputClass} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={abnt.footer.showPageNumber}
                    onChange={e => updateAbnt('footer', { ...abnt.footer, showPageNumber: e.target.checked })} />
                  Numerar páginas
                </label>
              </>
            )}
          </Section>

          <Section title="Assinatura / Carimbo">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={abnt.signature.enabled}
                onChange={e => updateAbnt('signature', { ...abnt.signature, enabled: e.target.checked })} />
              Bloco de assinatura
            </label>
            {abnt.signature.enabled && (
              <input value={abnt.signature.text}
                onChange={e => updateAbnt('signature', { ...abnt.signature, text: e.target.value })}
                placeholder="Nome / cargo do responsável" className={inputClass} />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={abnt.stamp.enabled}
                onChange={e => updateAbnt('stamp', { ...abnt.stamp, enabled: e.target.checked })} />
              Carimbo digital
            </label>
            {abnt.stamp.enabled && (
              <input value={abnt.stamp.imageUrl || ''}
                onChange={e => updateAbnt('stamp', { ...abnt.stamp, imageUrl: e.target.value || null })}
                placeholder="URL da imagem do carimbo" className={inputClass} />
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
