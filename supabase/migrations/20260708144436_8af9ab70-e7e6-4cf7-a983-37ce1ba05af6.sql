
CREATE POLICY "Managers can delete shift swaps"
ON public.shift_swaps FOR DELETE TO authenticated
USING (public.is_manager(auth.uid()));

CREATE POLICY "Managers can delete swap history"
ON public.swap_history FOR DELETE TO authenticated
USING (public.is_manager(auth.uid()));

CREATE POLICY "Managers can delete swap attachments"
ON public.swap_attachments FOR DELETE TO authenticated
USING (public.is_manager(auth.uid()));
