
-- Phase 1: Add columns to shift_swaps for admin swap support
ALTER TABLE public.shift_swaps 
ADD COLUMN IF NOT EXISTS shift_id_destino UUID REFERENCES public.shifts(id),
ADD COLUMN IF NOT EXISTS motivo_administrativo TEXT,
ADD COLUMN IF NOT EXISTS bypass_aprovacao BOOLEAN DEFAULT false;

-- Phase 1: Fix swap_history INSERT policy (too restrictive for managers)
DROP POLICY IF EXISTS "Authenticated can insert own swap history" ON public.swap_history;
CREATE POLICY "Authenticated can insert swap history" ON public.swap_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- Phase 1: Enable realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_swaps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
