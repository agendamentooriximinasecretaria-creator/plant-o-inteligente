
-- ENUM TYPES
CREATE TYPE public.app_role AS ENUM ('gestor_master', 'coordenador', 'profissional');
CREATE TYPE public.profissao_type AS ENUM ('medico', 'enfermeiro', 'fisioterapeuta', 'tecnico_enfermagem', 'biomedico', 'psicologo', 'terapeuta_ocupacional', 'nutricionista', 'fonoaudiologo', 'farmaceutico', 'outro');
CREATE TYPE public.shift_status AS ENUM ('agendado', 'confirmado', 'pendente', 'em_aberto', 'trocando', 'concluido', 'cancelado');
CREATE TYPE public.swap_status AS ENUM ('solicitada', 'aguardando_resposta', 'aceita', 'recusada', 'aguardando_aprovacao', 'aprovada', 'rejeitada', 'cancelada', 'concluida');

-- TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- USER ROLES
CREATE TABLE public.user_roles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role app_role NOT NULL, UNIQUE (user_id, role));
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'gestor_master'));

-- UNITS
CREATE TABLE public.units (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), nome TEXT NOT NULL, tipo TEXT NOT NULL DEFAULT 'hospital', endereco TEXT, telefone TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read units" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage units" ON public.units FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'gestor_master'));
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SECTORS
CREATE TABLE public.sectors (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), nome TEXT NOT NULL, unidade_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read sectors" ON public.sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage sectors" ON public.sectors FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'gestor_master'));
CREATE TRIGGER update_sectors_updated_at BEFORE UPDATE ON public.sectors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PROFESSIONALS
CREATE TABLE public.professionals (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, nome TEXT NOT NULL, profissao profissao_type NOT NULL, especialidade TEXT, conselho TEXT, registro TEXT, cpf TEXT, telefone TEXT, email TEXT NOT NULL, data_nascimento DATE, endereco TEXT, banco TEXT, agencia TEXT, conta TEXT, chave_pix TEXT, valor_hora NUMERIC(10,2) NOT NULL DEFAULT 0, valor_plantao NUMERIC(10,2) DEFAULT 0, unidade_principal_id UUID REFERENCES public.units(id), setor_principal_id UUID REFERENCES public.sectors(id), vinculo TEXT, status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')), observacoes TEXT, avatar_url TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read professionals" ON public.professionals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert professionals" ON public.professionals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'gestor_master'));
CREATE POLICY "Admins can update professionals" ON public.professionals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'gestor_master'));
CREATE POLICY "Admins can delete professionals" ON public.professionals FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'gestor_master'));
CREATE TRIGGER update_professionals_updated_at BEFORE UPDATE ON public.professionals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SHIFTS
CREATE TABLE public.shifts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), unidade_id UUID NOT NULL REFERENCES public.units(id), setor_id UUID NOT NULL REFERENCES public.sectors(id), profissao profissao_type NOT NULL, profissional_id UUID NOT NULL REFERENCES public.professionals(id), data DATE NOT NULL, hora_inicio TIME NOT NULL, hora_fim TIME NOT NULL, carga_horaria NUMERIC(5,2) NOT NULL, tipo_plantao TEXT NOT NULL DEFAULT 'regular', valor_hora NUMERIC(10,2) NOT NULL DEFAULT 0, valor_total NUMERIC(10,2) NOT NULL DEFAULT 0, observacoes TEXT, status shift_status NOT NULL DEFAULT 'agendado', created_by UUID REFERENCES auth.users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read shifts" ON public.shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert shifts" ON public.shifts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'gestor_master'));
CREATE POLICY "Admins can update shifts" ON public.shifts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'gestor_master'));
CREATE POLICY "Admins can delete shifts" ON public.shifts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'gestor_master'));
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Conflict detection
CREATE OR REPLACE FUNCTION public.check_shift_conflict(p_profissional_id UUID, p_data DATE, p_hora_inicio TIME, p_hora_fim TIME, p_exclude_id UUID DEFAULT NULL) RETURNS TABLE(conflicting_shift_id UUID, conflicting_start TIME, conflicting_end TIME) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT id, hora_inicio, hora_fim FROM public.shifts WHERE profissional_id = p_profissional_id AND data = p_data AND status NOT IN ('cancelado') AND (p_exclude_id IS NULL OR id != p_exclude_id) AND (p_hora_inicio < hora_fim AND p_hora_fim > hora_inicio) $$;

-- SHIFT SWAPS
CREATE TABLE public.shift_swaps (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), shift_id UUID NOT NULL REFERENCES public.shifts(id), solicitante_id UUID NOT NULL REFERENCES public.professionals(id), destinatario_id UUID REFERENCES public.professionals(id), motivo TEXT NOT NULL, status swap_status NOT NULL DEFAULT 'solicitada', tipo TEXT NOT NULL DEFAULT 'direto' CHECK (tipo IN ('direto', 'grupo')), observacao_gestor TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE public.shift_swaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read swaps" ON public.shift_swaps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert swaps" ON public.shift_swaps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can update swaps" ON public.shift_swaps FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'gestor_master'));
CREATE TRIGGER update_swaps_updated_at BEFORE UPDATE ON public.shift_swaps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SWAP HISTORY
CREATE TABLE public.swap_history (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), swap_id UUID NOT NULL REFERENCES public.shift_swaps(id) ON DELETE CASCADE, acao TEXT NOT NULL, usuario TEXT NOT NULL, user_id UUID REFERENCES auth.users(id), detalhes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE public.swap_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read swap history" ON public.swap_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert swap history" ON public.swap_history FOR INSERT TO authenticated WITH CHECK (true);

-- NOTIFICATIONS
CREATE TABLE public.notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id), professional_id UUID REFERENCES public.professionals(id), tipo TEXT NOT NULL, titulo TEXT NOT NULL, mensagem TEXT NOT NULL, lida BOOLEAN NOT NULL DEFAULT false, canal TEXT DEFAULT 'sistema', status_envio TEXT DEFAULT 'pendente' CHECK (status_envio IN ('pendente', 'enviado', 'erro', 'fallback')), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read notifications" ON public.notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update notifications" ON public.notifications FOR UPDATE TO authenticated USING (true);

-- AUDIT LOGS
CREATE TABLE public.audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id), usuario_nome TEXT, acao TEXT NOT NULL, modulo TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'sucesso' CHECK (status IN ('sucesso', 'erro')), detalhes JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'gestor_master'));
CREATE POLICY "Authenticated can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- SYSTEM SETTINGS
CREATE TABLE public.system_settings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), key TEXT NOT NULL UNIQUE, value JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID REFERENCES auth.users(id));
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read settings" ON public.system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage settings" ON public.system_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'gestor_master'));
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MESSAGE TEMPLATES
CREATE TABLE public.message_templates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tipo TEXT NOT NULL, categoria TEXT NOT NULL DEFAULT 'profissional' CHECK (categoria IN ('profissional', 'paciente')), assunto TEXT NOT NULL, mensagem TEXT NOT NULL, ativo BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read templates" ON public.message_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage templates" ON public.message_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'gestor_master'));
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SEED: Settings
INSERT INTO public.system_settings (key, value) VALUES
  ('hospital', '{"nome": "Hospital Central São Lucas", "cnpj": "12.345.678/0001-90", "endereco": "Av. Brasil, 1200 - São Paulo/SP"}'),
  ('conflict_rules', '{"limite_horas_dia": 24, "limite_horas_semana": 60, "descanso_minimo": 6, "aprovacao_gestor_trocas": true}'),
  ('webhook', '{"url": "https://hook.us2.make.com/48rbpcb5o2vye4tmn7iur5gtv4hnmlk7", "ativo": false, "status": "inativo"}'),
  ('gmail_smtp', '{"email_remetente": "agendamentooriximinasecretaria@gmail.com", "servidor": "smtp.gmail.com", "porta": 587, "senha_configurada": false, "status": "pendente"}'),
  ('notification_channel', '{"canal_paciente": "ambos", "canal_profissional": "sistema"}'),
  ('notifications_config', '{"plantao_criado": true, "plantao_alterado": true, "plantao_cancelado": true, "troca_solicitada": true, "troca_aceita": true, "troca_recusada": true, "troca_aprovada": true, "troca_rejeitada": true, "lembrete_plantao": true, "pagamento_processado": true, "conflito_detectado": true}');

-- SEED: Units
INSERT INTO public.units (id, nome, tipo, endereco) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Hospital Central São Lucas', 'hospital', 'Av. Brasil, 1200 - São Paulo/SP'),
  ('a2222222-2222-2222-2222-222222222222', 'UPA 24h Norte', 'upa', 'Rua das Flores, 500 - São Paulo/SP'),
  ('a3333333-3333-3333-3333-333333333333', 'Maternidade Santa Clara', 'maternidade', 'Av. Paulista, 800 - São Paulo/SP'),
  ('a4444444-4444-4444-4444-444444444444', 'Clínica Saúde Total', 'clinica', 'Rua Augusta, 350 - São Paulo/SP');

-- SEED: Sectors
INSERT INTO public.sectors (id, nome, unidade_id) VALUES
  ('b1111111-1111-1111-1111-111111111111', 'UTI Adulto', 'a1111111-1111-1111-1111-111111111111'),
  ('b2222222-2222-2222-2222-222222222222', 'Pronto Socorro', 'a1111111-1111-1111-1111-111111111111'),
  ('b3333333-3333-3333-3333-333333333333', 'Centro Cirúrgico', 'a1111111-1111-1111-1111-111111111111'),
  ('b4444444-4444-4444-4444-444444444444', 'Clínica Médica', 'a1111111-1111-1111-1111-111111111111'),
  ('b5555555-5555-5555-5555-555555555555', 'Emergência', 'a2222222-2222-2222-2222-222222222222'),
  ('b6666666-6666-6666-6666-666666666666', 'Sala de Parto', 'a3333333-3333-3333-3333-333333333333'),
  ('b7777777-7777-7777-7777-777777777777', 'Neonatologia', 'a3333333-3333-3333-3333-333333333333'),
  ('b8888888-8888-8888-8888-888888888888', 'Ambulatório', 'a4444444-4444-4444-4444-444444444444');

-- SEED: Professionals
INSERT INTO public.professionals (nome, profissao, especialidade, conselho, registro, cpf, telefone, email, valor_hora, unidade_principal_id, setor_principal_id, status) VALUES
  ('Dr. Carlos Silva', 'medico', 'Cardiologia', 'CRM', 'CRM/SP 123456', '111.111.111-11', '(11) 99999-0001', 'carlos.silva@hospital.com', 250, 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'ativo'),
  ('Dra. Ana Souza', 'medico', 'Clínica Geral', 'CRM', 'CRM/SP 234567', '222.222.222-22', '(11) 99999-0002', 'ana.souza@hospital.com', 220, 'a1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'ativo'),
  ('Enf. Maria Santos', 'enfermeiro', 'UTI', 'COREN', 'COREN/SP 345678', '333.333.333-33', '(11) 99999-0003', 'maria.santos@hospital.com', 120, 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'ativo'),
  ('Ft. João Lima', 'fisioterapeuta', 'Respiratória', 'CREFITO', 'CREFITO/SP 456789', '444.444.444-44', '(11) 99999-0004', 'joao.lima@hospital.com', 130, 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'ativo'),
  ('Téc. Paula Oliveira', 'tecnico_enfermagem', 'Geral', 'COREN', 'COREN/SP 567890', '555.555.555-55', '(11) 99999-0005', 'paula.oliveira@hospital.com', 80, 'a2222222-2222-2222-2222-222222222222', 'b5555555-5555-5555-5555-555555555555', 'ativo'),
  ('Dr. Roberto Costa', 'medico', 'Obstetrícia', 'CRM', 'CRM/SP 678901', '666.666.666-66', '(11) 99999-0006', 'roberto.costa@hospital.com', 280, 'a3333333-3333-3333-3333-333333333333', 'b6666666-6666-6666-6666-666666666666', 'ativo'),
  ('Dra. Fernanda Reis', 'medico', 'Pediatria', 'CRM', 'CRM/SP 789012', '777.777.777-77', '(11) 99999-0007', 'fernanda.reis@hospital.com', 240, 'a3333333-3333-3333-3333-333333333333', 'b7777777-7777-7777-7777-777777777777', 'ativo'),
  ('Psic. Camila Duarte', 'psicologo', 'Hospitalar', 'CRP', 'CRP/SP 890123', '888.888.888-88', '(11) 99999-0008', 'camila.duarte@hospital.com', 150, 'a4444444-4444-4444-4444-444444444444', 'b8888888-8888-8888-8888-888888888888', 'ativo'),
  ('Nutr. Beatriz Mendes', 'nutricionista', 'Clínica', 'CRN', 'CRN/SP 901234', '999.999.999-99', '(11) 99999-0009', 'beatriz.mendes@hospital.com', 110, 'a1111111-1111-1111-1111-111111111111', 'b4444444-4444-4444-4444-444444444444', 'ativo'),
  ('Farm. Lucas Almeida', 'farmaceutico', 'Hospitalar', 'CRF', 'CRF/SP 012345', '000.000.000-00', '(11) 99999-0010', 'lucas.almeida@hospital.com', 100, 'a1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'ativo');

-- SEED: Message templates
INSERT INTO public.message_templates (tipo, categoria, assunto, mensagem) VALUES
  ('plantao_criado', 'profissional', 'Novo plantão atribuído', E'Olá, {{nome_profissional}}.\n\nUm novo plantão foi atribuído para você.\n\nUnidade: {{unidade}}\nSetor: {{setor}}\nData: {{data}}\nHorário: {{hora_inicio}} às {{hora_fim}}\n\nAcesse o sistema para mais detalhes.'),
  ('troca_solicitada', 'profissional', 'Solicitação de troca de plantão', E'Olá, {{nome_profissional}}.\n\nVocê recebeu uma solicitação de troca de plantão de {{solicitante}}.\n\nData: {{data}}\nHorário: {{hora_inicio}} às {{hora_fim}}\nSetor: {{setor}}\n\nEntre no sistema para aceitar ou recusar.'),
  ('troca_aceita', 'profissional', 'Troca aceita', E'Olá, {{nome_profissional}}.\n\nSua solicitação de troca foi aceita por {{responsavel}} e está aguardando aprovação final.'),
  ('troca_recusada', 'profissional', 'Troca recusada', E'Olá, {{nome_profissional}}.\n\nSua solicitação de troca foi recusada por {{responsavel}}.\n\nMotivo: {{motivo}}'),
  ('troca_aprovada', 'profissional', 'Troca aprovada', E'Olá, {{nome_profissional}}.\n\nSua troca de plantão foi aprovada e a escala já foi atualizada.'),
  ('lembrete_plantao', 'profissional', 'Lembrete de plantão', E'Olá, {{nome_profissional}}.\n\nEste é um lembrete do seu próximo plantão.\n\nData: {{data}}\nHorário: {{hora_inicio}} às {{hora_fim}}\nSetor: {{setor}}\nUnidade: {{unidade}}'),
  ('confirmacao_agendamento', 'paciente', 'Confirmação de agendamento', E'Olá, {{nome_paciente}}.\n\nSeu agendamento foi confirmado com sucesso.\n\nData: {{data}}\nHorário: {{hora}}\nUnidade: {{unidade}}\nProfissional: {{profissional}}'),
  ('reagendamento', 'paciente', 'Seu agendamento foi reagendado', E'Olá, {{nome_paciente}}.\n\nSeu atendimento foi reagendado.\n\nNova data: {{nova_data}}\nNovo horário: {{novo_horario}}\nUnidade: {{unidade}}\nProfissional: {{profissional}}'),
  ('cancelamento', 'paciente', 'Atendimento cancelado', E'Olá, {{nome_paciente}}.\n\nInformamos que seu atendimento foi cancelado.\n\nMotivo: {{motivo}}\n\nSe necessário, entre em contato para novo agendamento.'),
  ('lembrete_atendimento', 'paciente', 'Lembrete de atendimento', E'Olá, {{nome_paciente}}.\n\nLembramos que você possui atendimento agendado para:\n\nData: {{data}}\nHorário: {{hora}}\nUnidade: {{unidade}}\nProfissional: {{profissional}}');
