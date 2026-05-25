-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Authenticated can read settings" ON public.system_settings;

-- Create a more secure policy for reading settings
CREATE POLICY "Authenticated can read settings" 
ON public.system_settings 
FOR SELECT 
TO authenticated 
USING (
  key != 'gmail_smtp' 
  OR 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('gestor_master', 'coordenador')
  )
);
