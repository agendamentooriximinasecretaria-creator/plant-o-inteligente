-- Add columns to shift_swaps to record stamps used
ALTER TABLE public.shift_swaps 
ADD COLUMN IF NOT EXISTS stamp_solicitante_id UUID REFERENCES public.professional_stamps(id),
ADD COLUMN IF NOT EXISTS stamp_destinatario_id UUID REFERENCES public.professional_stamps(id),
ADD COLUMN IF NOT EXISTS stamp_aprovador_id UUID REFERENCES public.professional_stamps(id);

-- Create a function to check if a professional has an active stamp
CREATE OR REPLACE FUNCTION public.check_professional_has_stamp(p_profissional_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.professional_stamps
  WHERE profissional_id = p_profissional_id 
    AND bloqueado = false;
  
  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to prevent swaps without stamps for the professionals involved
CREATE OR REPLACE FUNCTION public.enforce_stamp_on_swap()
RETURNS TRIGGER AS $$
BEGIN
  -- If it's a new swap or updating to 'solicitada'
  IF (TG_OP = 'INSERT') THEN
    IF NOT public.check_professional_has_stamp(NEW.solicitante_id) THEN
      RAISE EXCEPTION 'O solicitante deve ter um carimbo cadastrado e ativo.';
    END IF;
  END IF;

  -- If the swap is being accepted
  IF (TG_OP = 'UPDATE' AND NEW.status = 'aceita' AND OLD.status != 'aceita') THEN
    IF NOT public.check_professional_has_stamp(NEW.destinatario_id) THEN
      RAISE EXCEPTION 'O destinatário deve ter um carimbo cadastrado e ativo para aceitar a troca.';
    END IF;
  END IF;

  -- If the swap is being approved by a manager
  IF (TG_OP = 'UPDATE' AND NEW.status = 'aprovada' AND OLD.status != 'aprovada') THEN
    -- The approver is usually the current user, we can't easily check their stamp here 
    -- without knowing which professional record corresponds to the auth.uid().
    -- We will rely on frontend validation for the approver for now, or use a lookup.
    NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_enforce_stamp_on_swap
BEFORE INSERT OR UPDATE ON public.shift_swaps
FOR EACH ROW EXECUTE FUNCTION public.enforce_stamp_on_swap();
