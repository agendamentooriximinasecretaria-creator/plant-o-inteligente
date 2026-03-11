import { Settings, Building2, Shield, Bell, Mail, Palette } from "lucide-react";
import { motion } from "framer-motion";

const sections = [
  { icon: Building2, title: 'Dados da Instituição', desc: 'Nome, logo, cores e identidade visual do hospital', fields: [
    { label: 'Nome do Hospital', value: 'Hospital Central São Lucas' },
    { label: 'CNPJ', value: '12.345.678/0001-90' },
    { label: 'Endereço', value: 'Av. Brasil, 1200 - São Paulo/SP' },
  ]},
  { icon: Shield, title: 'Regras de Conflito', desc: 'Configure limites e validações automáticas', fields: [
    { label: 'Limite de horas/dia', value: '24h' },
    { label: 'Limite de horas/semana', value: '60h' },
    { label: 'Descanso mínimo entre plantões', value: '6h' },
    { label: 'Aprovação do gestor para trocas', value: 'Sim' },
  ]},
  { icon: Bell, title: 'Notificações', desc: 'Configure quais eventos geram notificações', fields: [
    { label: 'Plantão criado', value: 'Ativo' },
    { label: 'Troca solicitada', value: 'Ativo' },
    { label: 'Lembrete de plantão', value: 'Ativo (24h antes)' },
    { label: 'Conflito detectado', value: 'Ativo' },
  ]},
  { icon: Mail, title: 'Configuração de E-mail', desc: 'Configure canais de envio de e-mail', fields: [
    { label: 'Canal ativo', value: 'Webhook + Gmail SMTP' },
    { label: 'E-mail remetente', value: 'noreply@hospital.com' },
    { label: 'Status Webhook', value: 'Configurado' },
    { label: 'Status Gmail SMTP', value: 'Ativo' },
  ]},
];

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="module-title">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Configurações gerais do sistema</p>
      </div>

      <div className="space-y-4">
        {sections.map((s, i) => (
          <motion.div key={s.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card rounded-lg border border-border p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10"><s.icon className="h-5 w-5 text-primary" /></div>
              <div>
                <h3 className="font-display font-semibold text-foreground">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {s.fields.map(f => (
                <div key={f.label} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">{f.label}</span>
                  <span className="text-sm font-medium text-foreground">{f.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
