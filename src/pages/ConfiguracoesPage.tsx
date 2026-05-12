import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { Building2, Shield, Bell, Mail, Webhook, ArrowLeftRight, Save, TestTube, Power, Loader2, Eye, EyeOff, Clock, FileText, Activity, LineChart } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ShiftTypesManager } from "@/components/ShiftTypesManager";
import DocumentTemplatesManager from "@/components/document-templates/DocumentTemplatesManager";
import SwapAttachmentSettingsManager from "@/components/SwapAttachmentSettingsManager";
import CarimbosAssinaturasManager from "@/components/CarimbosAssinaturasManager";

// Strip credentials/secrets before logging settings to audit trail.
function sanitizeSettingForAudit(key: string, value: any): any {
  if (value == null || typeof value !== 'object') return value;
  const SENSITIVE = ['senha', 'password', 'token', 'secret', 'api_key', 'apikey', 'auth'];
  const clone: any = Array.isArray(value) ? [...value] : { ...value };
  for (const k of Object.keys(clone)) {
    if (SENSITIVE.some((s) => k.toLowerCase().includes(s))) {
      clone[k] = '[REDACTED]';
    }
  }
  return clone;
}

export default function ConfiguracoesPage() {
  const qc = useQueryClient();
  const { data: settings = {} } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings').select('*');
      return Object.fromEntries((data || []).map(s => [s.key, s.value]));
    },
  });

  const [hospital, setHospital] = useState({ nome: '', cnpj: '', endereco: '' });
  const [conflictRules, setConflictRules] = useState({ limite_horas_dia: 24, limite_horas_semana: 60, descanso_minimo: 6, aprovacao_gestor_trocas: true });
  const [usageRules, setUsageRules] = useState({ limite_trocas_plantao_default: 3, limite_trocas_paciente_default: 5 });
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookAtivo, setWebhookAtivo] = useState(false);
  const [gmailEmail, setGmailEmail] = useState('');
  const [gmailSenha, setGmailSenha] = useState('');
  const [gmailServidor, setGmailServidor] = useState('smtp.gmail.com');
  const [gmailPorta, setGmailPorta] = useState(587);
  const [gmailStatus, setGmailStatus] = useState('pendente');
  const [showPassword, setShowPassword] = useState(false);
  const [applyToAll, setApplyToAll] = useState(false);
  const [testing, setTesting] = useState('');

  useEffect(() => {
    if (settings.hospital) { const h = settings.hospital as any; setHospital({ nome: h.nome || '', cnpj: h.cnpj || '', endereco: h.endereco || '' }); }
    if (settings.conflict_rules) { const c = settings.conflict_rules as any; setConflictRules({ limite_horas_dia: c.limite_horas_dia || 24, limite_horas_semana: c.limite_horas_semana || 60, descanso_minimo: c.descanso_minimo || 6, aprovacao_gestor_trocas: c.aprovacao_gestor_trocas ?? true }); }
    if (settings.usage_rules) { const u = settings.usage_rules as any; setUsageRules({ limite_trocas_plantao_default: u.limite_trocas_plantao_default ?? 3, limite_trocas_paciente_default: u.limite_trocas_paciente_default ?? 5 }); }
    if (settings.webhook) { const w = settings.webhook as any; setWebhookUrl(w.url || ''); setWebhookAtivo(w.ativo || false); }
    if (settings.gmail_smtp) { const g = settings.gmail_smtp as any; setGmailEmail(g.email_remetente || ''); setGmailServidor(g.servidor || 'smtp.gmail.com'); setGmailPorta(g.porta || 587); setGmailStatus(g.status || 'pendente'); }
  }, [settings]);

  const saveSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { data: existing } = await supabase.from('system_settings').select('id, value').eq('key', key).maybeSingle();
      const valorAnterior = existing?.value ?? null;
      if (existing) {
        const { error } = await supabase.from('system_settings').update({ value }).eq('key', key);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('system_settings').insert({ key, value });
        if (error) throw error;
      }
      // Sanitize value: strip credentials before audit
      const sanitized = sanitizeSettingForAudit(key, value);
      const sanitizedAnterior = sanitizeSettingForAudit(key, valorAnterior);
      await logAudit(`Configuração salva: ${key}`, 'configuracoes', { key, valor_anterior: sanitizedAnterior, valor_novo: sanitized });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['system-settings'] }); toast.success('Configuração salva!'); },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const saveUsageRules = useMutation({
    mutationFn: async () => {
      // Save default
      await saveSetting.mutateAsync({ key: 'usage_rules', value: usageRules });
      // Optionally apply to all professionals
      if (applyToAll) {
        const { error } = await supabase.from('professionals').update({
          limite_trocas_plantao_mes: usageRules.limite_trocas_plantao_default,
          limite_trocas_paciente_mes: usageRules.limite_trocas_paciente_default,
        }).neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        await logAudit('Limites aplicados a todos profissionais', 'configuracoes', usageRules);
      }
    },
    onSuccess: () => { toast.success(applyToAll ? 'Regras salvas e aplicadas a todos os profissionais!' : 'Regras salvas como padrão!'); },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const testWebhook = async () => {
    setTesting('webhook');
    try {
      const payload = { evento: 'teste', timestamp: new Date().toISOString() };
      const resp = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (resp.ok) {
        toast.success('Webhook testado com sucesso!');
        await logAudit('Teste de webhook realizado', 'configuracoes', { url: webhookUrl, http_status: resp.status }, 'sucesso');
      } else {
        toast.error(`Webhook retornou status ${resp.status}`);
        await logAudit('Teste de webhook falhou', 'configuracoes', { url: webhookUrl, http_status: resp.status }, 'falha');
      }
    } catch (e: any) {
      toast.error('Erro ao testar webhook: ' + e.message);
      await logAudit('Teste de webhook erro', 'configuracoes', { url: webhookUrl, erro: e?.message }, 'falha');
    } finally { setTesting(''); }
  };

  const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
  const sectionClass = "bg-card rounded-lg border border-border p-5 shadow-[var(--shadow-card)]";

  return (
    <div className="space-y-6">
      <div><h1 className="module-title">Configurações</h1><p className="text-muted-foreground text-sm mt-1">Configurações gerais do sistema</p></div>

      <div className="space-y-4">
        {/* Hospital */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={sectionClass}>
          <div className="flex items-start gap-3 mb-4"><div className="p-2 rounded-lg bg-primary/10"><Building2 className="h-5 w-5 text-primary" /></div><div><h3 className="font-display font-semibold text-foreground">Dados da Instituição</h3><p className="text-sm text-muted-foreground">Nome, CNPJ e endereço</p></div></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-foreground">Nome</label><input value={hospital.nome} onChange={e => setHospital(h => ({ ...h, nome: e.target.value }))} className={inputClass} /></div>
            <div><label className="text-sm font-medium text-foreground">CNPJ</label><input value={hospital.cnpj} onChange={e => setHospital(h => ({ ...h, cnpj: e.target.value }))} className={inputClass} /></div>
            <div className="md:col-span-2"><label className="text-sm font-medium text-foreground">Endereço</label><input value={hospital.endereco} onChange={e => setHospital(h => ({ ...h, endereco: e.target.value }))} className={inputClass} /></div>
          </div>
          <button onClick={() => saveSetting.mutate({ key: 'hospital', value: hospital })} className="mt-4 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"><Save className="h-4 w-4" /> Salvar</button>
        </motion.div>

        {/* Tipos de Plantão */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }} className={sectionClass}>
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10"><Clock className="h-5 w-5 text-primary" /></div>
            <div>
              <h3 className="font-display font-semibold text-foreground">Tipos de Plantão</h3>
              <p className="text-sm text-muted-foreground">Configure os turnos disponíveis no formulário de Novo Plantão (Diurno, Noturno, 24h, etc.)</p>
            </div>
          </div>
          <ShiftTypesManager />
        </motion.div>

        {/* Regras de Utilização (Limites de Trocas) */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className={sectionClass}>
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10"><ArrowLeftRight className="h-5 w-5 text-primary" /></div>
            <div>
              <h3 className="font-display font-semibold text-foreground">Regras de Utilização</h3>
              <p className="text-sm text-muted-foreground">Limites mensais padrão para novos profissionais</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Limite Padrão — Trocas de Plantão / mês</label>
              <input type="number" min={0} max={50} value={usageRules.limite_trocas_plantao_default}
                onChange={e => setUsageRules(u => ({ ...u, limite_trocas_plantao_default: Math.max(0, parseInt(e.target.value) || 0) }))} className={inputClass} />
              <p className="text-[11px] text-muted-foreground mt-1">Bloqueia novas solicitações ao atingir o limite (validado no banco).</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Limite Padrão — Trocas de Paciente / mês</label>
              <input type="number" min={0} max={50} value={usageRules.limite_trocas_paciente_default}
                onChange={e => setUsageRules(u => ({ ...u, limite_trocas_paciente_default: Math.max(0, parseInt(e.target.value) || 0) }))} className={inputClass} />
              <p className="text-[11px] text-muted-foreground mt-1">Limite mensal de transferências de pacientes.</p>
            </div>
          </div>
          <label className="flex items-center gap-2 mt-4 text-sm text-foreground cursor-pointer">
            <input type="checkbox" checked={applyToAll} onChange={e => setApplyToAll(e.target.checked)} className="rounded" />
            Aplicar estes limites a <strong>todos</strong> os profissionais existentes (sobrescreve valores individuais)
          </label>
          <button onClick={() => saveUsageRules.mutate()} disabled={saveUsageRules.isPending} className="mt-4 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saveUsageRules.isPending ? 'Salvando...' : 'Salvar Regras'}
          </button>
        </motion.div>

        {/* Anexos em Trocas de Plantão */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.045 }} className={sectionClass}>
          <SwapAttachmentSettingsManager />
        </motion.div>

        {/* Assinaturas e Carimbos (Gestor Master) */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.047 }} className={sectionClass}>
          <CarimbosAssinaturasManager />
        </motion.div>


        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={sectionClass}>
          <div className="flex items-start gap-3 mb-4"><div className="p-2 rounded-lg bg-primary/10"><Shield className="h-5 w-5 text-primary" /></div><div><h3 className="font-display font-semibold text-foreground">Regras de Conflito</h3><p className="text-sm text-muted-foreground">Limites e validações automáticas</p></div></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-foreground">Limite horas/dia</label><input type="number" value={conflictRules.limite_horas_dia} onChange={e => setConflictRules(c => ({ ...c, limite_horas_dia: Number(e.target.value) }))} className={inputClass} /></div>
            <div><label className="text-sm font-medium text-foreground">Limite horas/semana</label><input type="number" value={conflictRules.limite_horas_semana} onChange={e => setConflictRules(c => ({ ...c, limite_horas_semana: Number(e.target.value) }))} className={inputClass} /></div>
            <div><label className="text-sm font-medium text-foreground">Descanso mínimo (h)</label><input type="number" value={conflictRules.descanso_minimo} onChange={e => setConflictRules(c => ({ ...c, descanso_minimo: Number(e.target.value) }))} className={inputClass} /></div>
            <div className="flex items-center gap-2 pt-6"><input type="checkbox" checked={conflictRules.aprovacao_gestor_trocas} onChange={e => setConflictRules(c => ({ ...c, aprovacao_gestor_trocas: e.target.checked }))} className="rounded" /><label className="text-sm text-foreground">Aprovação do gestor para trocas</label></div>
          </div>
          <button onClick={() => saveSetting.mutate({ key: 'conflict_rules', value: conflictRules })} className="mt-4 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"><Save className="h-4 w-4" /> Salvar</button>
        </motion.div>

        {/* Webhook */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={sectionClass}>
          <div className="flex items-start gap-3 mb-4"><div className="p-2 rounded-lg bg-primary/10"><Webhook className="h-5 w-5 text-primary" /></div><div className="flex-1">
            <div className="flex items-center gap-3"><h3 className="font-display font-semibold text-foreground">Webhook</h3><span className={`status-badge text-[10px] ${webhookAtivo ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{webhookAtivo ? 'Ativo' : 'Inativo'}</span></div>
            <p className="text-sm text-muted-foreground">Integração via webhook para automações</p>
          </div></div>
          <div className="space-y-3">
            <div><label className="text-sm font-medium text-foreground">URL do Webhook</label><input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://hook.us2.make.com/..." className={inputClass} /></div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { saveSetting.mutate({ key: 'webhook', value: { url: webhookUrl, ativo: true, status: 'ativo' } }); setWebhookAtivo(true); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"><Save className="h-4 w-4" /> Salvar</button>
              <button onClick={testWebhook} disabled={!webhookUrl || testing === 'webhook'} className="flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
                {testing === 'webhook' ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />} Testar
              </button>
              <button onClick={() => { saveSetting.mutate({ key: 'webhook', value: { url: webhookUrl, ativo: false, status: 'inativo' } }); setWebhookAtivo(false); }} className="flex items-center gap-2 border border-destructive/30 text-destructive px-4 py-2 rounded-lg text-sm font-medium hover:bg-destructive/10"><Power className="h-4 w-4" /> Desativar</button>
            </div>
          </div>
        </motion.div>

        {/* Monitoramento do Sistema (Gestor Master Only) */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className={sectionClass}>
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10"><Activity className="h-5 w-5 text-primary" /></div>
            <div className="flex-1">
              <h3 className="font-display font-semibold text-foreground">Monitoramento do Sistema</h3>
              <p className="text-sm text-muted-foreground">Acompanhe a saúde do banco de dados, storage e infraestrutura.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
             <div className="flex-1 p-3 rounded-lg bg-muted/20 border border-border/50">
                <p className="text-xs text-muted-foreground">Métricas em tempo real, auditoria de logs e limpeza segura de dados temporários.</p>
             </div>
             <button 
               onClick={() => window.location.href = '/configuracoes/monitoramento'} 
               className="flex items-center justify-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
             >
               <LineChart className="h-4 w-4" /> Acessar Monitoramento
             </button>
          </div>
        </motion.div>

        {/* Gmail SMTP */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={sectionClass}>
          <div className="flex items-start gap-3 mb-4"><div className="p-2 rounded-lg bg-primary/10"><Mail className="h-5 w-5 text-primary" /></div><div className="flex-1">
            <div className="flex items-center gap-3"><h3 className="font-display font-semibold text-foreground">Gmail SMTP</h3><span className={`status-badge text-[10px] ${gmailStatus === 'ativo' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>{gmailStatus === 'ativo' ? 'Ativo' : 'Pendente'}</span></div>
            <p className="text-sm text-muted-foreground">Envio de e-mails via Gmail</p>
          </div></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-foreground">E-mail remetente</label><input value={gmailEmail} onChange={e => setGmailEmail(e.target.value)} className={inputClass} /></div>
            <div><label className="text-sm font-medium text-foreground">Senha de aplicativo</label>
              <div className="relative"><input type={showPassword ? 'text' : 'password'} value={gmailSenha} onChange={e => setGmailSenha(e.target.value)} placeholder="••••••••" className={inputClass} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-muted-foreground">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div></div>
            <div><label className="text-sm font-medium text-foreground">Servidor SMTP</label><input value={gmailServidor} onChange={e => setGmailServidor(e.target.value)} className={inputClass} /></div>
            <div><label className="text-sm font-medium text-foreground">Porta</label><input type="number" value={gmailPorta} onChange={e => setGmailPorta(Number(e.target.value))} className={inputClass} /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => { const newStatus = gmailSenha ? 'ativo' : 'pendente'; setGmailStatus(newStatus); saveSetting.mutate({ key: 'gmail_smtp', value: { email_remetente: gmailEmail, servidor: gmailServidor, porta: gmailPorta, senha_configurada: !!gmailSenha, status: newStatus } }); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"><Save className="h-4 w-4" /> Salvar</button>
          </div>
        </motion.div>

        {/* Notifications */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className={sectionClass}>
          <div className="flex items-start gap-3 mb-4"><div className="p-2 rounded-lg bg-primary/10"><Bell className="h-5 w-5 text-primary" /></div><div><h3 className="font-display font-semibold text-foreground">Eventos de Notificação</h3><p className="text-sm text-muted-foreground">Eventos do sistema que geram notificações</p></div></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ['plantao_criado', 'Plantão criado'], ['plantao_alterado', 'Plantão alterado'], ['plantao_cancelado', 'Plantão cancelado'],
              ['troca_solicitada', 'Troca solicitada'], ['troca_aceita', 'Troca aceita'], ['troca_recusada', 'Troca recusada'],
              ['troca_aprovada', 'Troca aprovada'], ['lembrete_plantao', 'Lembrete de plantão'], ['conflito_detectado', 'Conflito detectado'],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-foreground">{label}</span>
                <span className="text-xs font-medium text-success">Ativo</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Modelos de Documentos */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className={sectionClass}>
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10"><FileText className="h-5 w-5 text-primary" /></div>
            <div>
              <h3 className="font-display font-semibold text-foreground">Modelos de Documentos</h3>
              <p className="text-sm text-muted-foreground">Editor profissional ABNT — escala, comprovantes, declarações e documentos personalizados.</p>
            </div>
          </div>
          <DocumentTemplatesManager />
        </motion.div>
      </div>
    </div>
  );
}
