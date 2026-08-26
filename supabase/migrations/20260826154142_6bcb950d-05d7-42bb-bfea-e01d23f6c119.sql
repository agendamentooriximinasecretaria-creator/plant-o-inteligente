ALTER TABLE public.shift_types
  ADD COLUMN IF NOT EXISTS adn_modo text NOT NULL DEFAULT 'auto';

ALTER TABLE public.shift_types
  DROP CONSTRAINT IF EXISTS shift_types_adn_modo_check;

ALTER TABLE public.shift_types
  ADD CONSTRAINT shift_types_adn_modo_check CHECK (adn_modo IN ('nunca','auto','sempre'));

UPDATE public.shift_types
SET adn_modo = CASE WHEN COALESCE(gera_adicional_noturno, false) THEN 'auto' ELSE 'nunca' END;