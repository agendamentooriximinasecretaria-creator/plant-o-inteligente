-- Fix: Create a secure view that masks sensitive financial fields for non-gestor_master users
-- Coordenadores can see professional info but NOT financial/personal data (CPF, bank, PIX)

CREATE OR REPLACE VIEW public.professionals_safe AS
SELECT
  id, nome, email, telefone, profissao, especialidade, registro, conselho,
  status, competencias, avatar_url, user_id, setor_principal_id, unidade_principal_id,
  valor_hora, valor_plantao, data_nascimento, documento_validade, vinculo, observacoes,
  created_at, updated_at, endereco, documento_numero, documento_conselho,
  CASE WHEN has_role(auth.uid(), 'gestor_master'::app_role) OR user_id = auth.uid() THEN cpf ELSE NULL END as cpf,
  CASE WHEN has_role(auth.uid(), 'gestor_master'::app_role) OR user_id = auth.uid() THEN banco ELSE NULL END as banco,
  CASE WHEN has_role(auth.uid(), 'gestor_master'::app_role) OR user_id = auth.uid() THEN agencia ELSE NULL END as agencia,
  CASE WHEN has_role(auth.uid(), 'gestor_master'::app_role) OR user_id = auth.uid() THEN conta ELSE NULL END as conta,
  CASE WHEN has_role(auth.uid(), 'gestor_master'::app_role) OR user_id = auth.uid() THEN chave_pix ELSE NULL END as chave_pix
FROM professionals;