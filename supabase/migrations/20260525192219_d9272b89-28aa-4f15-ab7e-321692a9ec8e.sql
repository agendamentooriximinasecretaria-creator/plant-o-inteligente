-- Adiciona coluna is_plantonista à tabela de profissionais
ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS is_plantonista BOOLEAN DEFAULT false;

-- Adiciona coluna gera_adicional_noturno à tabela de tipos de plantão
ALTER TABLE public.shift_types 
ADD COLUMN IF NOT EXISTS gera_adicional_noturno BOOLEAN DEFAULT false;

-- Atualiza os tipos de plantão existentes que comprovadamente são noturnos
UPDATE public.shift_types 
SET gera_adicional_noturno = true 
WHERE nome ILIKE '%noturno%' 
   OR nome ILIKE '%24h%' 
   OR (hora_inicio >= '19:00:00' OR hora_fim <= '07:00:00' AND hora_inicio > hora_fim);
