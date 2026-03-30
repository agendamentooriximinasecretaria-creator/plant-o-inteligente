-- Fix: swap_history INSERT policy is too permissive (WITH CHECK true)
-- Replace with restricted policy that only allows managers or swap participants

DROP POLICY IF EXISTS "Authenticated can insert swap history" ON swap_history;

CREATE POLICY "swap_history_insert_restricted"
  ON swap_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_manager(auth.uid())
    OR EXISTS (
      SELECT 1 FROM shift_swaps sw
      WHERE sw.id = swap_history.swap_id
        AND (
          sw.solicitante_id = get_my_professional_id()
          OR sw.destinatario_id = get_my_professional_id()
        )
    )
  );