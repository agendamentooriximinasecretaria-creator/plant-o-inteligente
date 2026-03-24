
-- Fix UPDATE policy to restrict to own acionamentos or managers
DROP POLICY IF EXISTS "managers_update_acionamentos" ON acionamentos_reforco;
CREATE POLICY "update_acionamentos" ON acionamentos_reforco FOR UPDATE TO authenticated
USING (
  is_manager(auth.uid())
  OR profissional_id = get_my_professional_id()
);
