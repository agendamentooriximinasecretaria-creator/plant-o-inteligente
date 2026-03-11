import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { Settings, Building2, Shield, Bell, Mail, Webhook, Users, Save, TestTube, Power, Loader2, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

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
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookAtivo, setWebhookAtivo] = useState(false);
  const [gmailEmail, setGmailEmail] = useState('');
  const [gmailSenha, setGmailSenha] = useState('');
  const [gmailServidor, setGmailServidor] = useState('smtp.gmail.com');
  const [gmailPorta, setGmailPorta] = useState(587);
  const [gmailStatus, setGmailStatus] = useState('pendente');
  const [showPassword, setShowPassword] = useState(false);
  const [canalPaciente, setCanalPaciente] = useState('ambos');
  const [testing, setTesting] = useState('');

  useEffect(() => {
    if (settings.hospital) { const h = settings.hospital as any; setHospital({ nome: h.nome || '', cnpj: h.cnpj || '', endereco: h.endereco || '' }); }
    if (settings.conflict_rules) { const c = settings.conflict_rules as any; setConflictRules({ limite_horas_dia: c.limite_horas_dia || 24, limite_horas_semana: c.limite_horas_semana || 60, descanso_minimo: c.descanso_minimo || 6, aprovacao_gestor_trocas: c.aprovacao_gestor_trocas ?? true }); }
    if (settings.webhook) { const w = settings.webhook as any; setWebhookUrl(w.url || ''); setWebhookAtivo(w.ativo || false); }
    if (settings.gmail_smtp) { const g = settings.gmail_smtp as any; setGmailEmail(g.email_remetente || ''); setGmailServidor(g.servidor || 'smtp.gmail.com'); setGmailPorta(g.porta || 587); setGmailStatus(g.status || 'pendente'); }
    if (settings.notification_channel) { const n = settings.notification_channel as any; setCanalPaciente(n.canal_paciente || 'ambos'); }
  }, [settings]);

  const saveSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { data: existing } = await supabase.from('system_settings').select('id').eq('key', key).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('system_settings').update({ value }).eq('key', key);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('system_settings').insert({ key, value });
        if (error) throw error;
      }
      await logAudit(`Configuração salva: ${key}`, 'configuracoes', { key });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['system-settings'] }); toast.success('Configuração salva!'); },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const testWebhook = async () => {
    setTesting('webhook');
    try {
      const payload = {
        evento: 'teste', status: 'teste', timestamp: new Date().toISOString(),
        paciente: { nome: 'Teste', email: 'teste@email.com', telefone: '00000000000' },
        profissional: { nome: 'Dr. Teste', profissao: 'Médico', setor: 'UTI' },
        unidade: { nome: 'Hospital Teste', setor: 'UTI' },
        agendamento: { data: new Date().toISOString().slice(0, 10), hora: '14:00', status: 'teste' },
      };
      const resp = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (resp.ok) {
        toast.success('Webhook testado com sucesso!');
        await logAudit('Teste de webhook realizado', 'configuracoes', { url: webhookUrl, status: 'sucesso' });
      } else {
        toast.error(`Webhook retornou status ${resp.status}`);
        await logAudit('Teste de webhook falhou', 'configuracoes', { url: webhookUrl, status: 'erro', httpStatus: resp.status }, 'erro');
      }
    } catch (e: any) {
      toast.error('Erro ao testar webhook: ' + e.message);
      await logAudit('Teste de webhook falhou', 'configuracoes', { url: webhookUrl, erro: e.message }, 'erro');
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

        {/* Conflict Rules */}
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

        {/* Webhook Make.com */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={sectionClass}>
          <div className="flex items-start gap-3 mb-4"><div className="p-2 rounded-lg bg-primary/10"><Webhook className="h-5 w-5 text-primary" /></div><div className="flex-1">
            <div className="flex items-center gap-3"><h3 className="font-display font-semibold text-foreground">Webhook Make.com</h3><span className={`status-badge text-[10px] ${webhookAtivo ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{webhookAtivo ? 'Ativo' : 'Inativo'}</span></div>
            <p className="text-sm text-muted-foreground">Integração via webhook para automações</p>
          </div></div>
          <div className="space-y-3">
            <div><label className="text-sm font-medium text-foreground">URL do Webhook</label><input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://hook.us2.make.com/..." className={inputClass} /></div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { saveSetting.mutate({ key: 'webhook', value: { url: webhookUrl, ativo: true, status: 'ativo' } }); setWebhookAtivo(true); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"><Save className="h-4 w-4" /> Salvar Webhook</button>
              <button onClick={testWebhook} disabled={!webhookUrl || testing === 'webhook'} className="flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
                {testing === 'webhook' ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />} Testar
              </button>
              <button onClick={() => { saveSetting.mutate({ key: 'webhook', value: { url: webhookUrl, ativo: false, status: 'inativo' } }); setWebhookAtivo(false); }} className="flex items-center gap-2 border border-destructive/30 text-destructive px-4 py-2 rounded-lg text-sm font-medium hover:bg-destructive/10"><Power className="h-4 w-4" /> Desativar</button>
            </div>
          </div>
        </motion.div>

        {/* Gmail SMTP */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={sectionClass}>
          <div className="flex items-start gap-3 mb-4"><div className="p-2 rounded-lg bg-primary/10"><Mail className="h-5 w-5 text-primary" /></div><div className="flex-1">
            <div className="flex items-center gap-3"><h3 className="font-display font-semibold text-foreground">Gmail SMTP</h3><span className={`status-badge text-[10px] ${gmailStatus === 'ativo' ? 'bg-success/10 text-success' : gmailStatus === 'erro' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>{gmailStatus === 'ativo' ? 'Ativo' : gmailStatus === 'erro' ? 'Erro' : 'Pendente'}</span></div>
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
          <p className="text-xs text-muted-foreground mt-3">ℹ️ Gere uma senha de aplicativo em <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary underline">myaccount.google.com → Segurança → Senhas de app</a></p>
          <div className="flex gap-2 mt-4">
            <button onClick={() => { const newStatus = gmailSenha ? 'ativo' : 'pendente'; setGmailStatus(newStatus); saveSetting.mutate({ key: 'gmail_smtp', value: { email_remetente: gmailEmail, servidor: gmailServidor, porta: gmailPorta, senha_configurada: !!gmailSenha, status: newStatus } }); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"><Save className="h-4 w-4" /> Salvar</button>
            <button onClick={() => toast.info('Para testar o envio real de e-mail, uma Edge Function SMTP precisa ser configurada no backend.')} className="flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted"><TestTube className="h-4 w-4" /> Testar Envio</button>
          </div>
        </motion.div>

        {/* Canal de Notificação ao Paciente */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={sectionClass}>
          <div className="flex items-start gap-3 mb-4"><div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div><div><h3 className="font-display font-semibold text-foreground">Canal de Notificação ao Paciente</h3><p className="text-sm text-muted-foreground">Define como o paciente recebe e-mails e notificações</p></div></div>
          <div>
            <label className="text-sm font-medium text-foreground">Canal ativo para envio</label>
            <select value={canalPaciente} onChange={e => setCanalPaciente(e.target.value)} className={inputClass}>
              <option value="webhook">Webhook</option><option value="gmail">Gmail</option><option value="ambos">Ambos (Webhook + Gmail)</option>
            </select>
            <p className="text-xs text-muted-foreground mt-2">Se o canal for "Ambos" e o webhook falhar, o Gmail será usado automaticamente como fallback.</p>
          </div>
          <button onClick={() => saveSetting.mutate({ key: 'notification_channel', value: { canal_paciente: canalPaciente } })} className="mt-4 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"><Save className="h-4 w-4" /> Salvar</button>
        </motion.div>

        {/* Notifications Config */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className={sectionClass}>
          <div className="flex items-start gap-3 mb-4"><div className="p-2 rounded-lg bg-primary/10"><Bell className="h-5 w-5 text-primary" /></div><div><h3 className="font-display font-semibold text-foreground">Eventos de Notificação</h3><p className="text-sm text-muted-foreground">Configure quais eventos geram notificações</p></div></div>
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
      </div>
    </div>
  );
}
