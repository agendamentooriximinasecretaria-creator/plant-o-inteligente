-- Adiciona campo de elegibilidade para adicional noturno no cadastro de profissionais
ALTER TABLE public.professionals 
ADD COLUMN recebe_adicional_noturno BOOLEAN DEFAULT false;

-- Adiciona comentário para documentação
COMMENT ON COLUMN public.professionals.recebe_adicional_noturno IS 'Indica se o profissional é elegível para receber Adicional Noturno (ADN).';

-- Garante que as configurações de sistema existam para o ADN
INSERT INTO public.system_settings (key, value)
VALUES 
  ('exibir_adn_escala_consolidada', 'true'::jsonb),
  ('regra_calculo_adn', '{"inicio": "22:00", "fim": "05:00", "multiplicador": 1}'::jsonb)
ON CONFLICT (key) DO NOTHING;
