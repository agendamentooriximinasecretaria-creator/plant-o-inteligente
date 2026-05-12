-- Ensure the table exists and has all required fields
CREATE TABLE IF NOT EXISTS public.system_cleanup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    cleanup_type TEXT NOT NULL,
    items_count INTEGER DEFAULT 0,
    status TEXT NOT NULL, -- 'Sucesso', 'Erro'
    details JSONB DEFAULT '{}'::jsonb,
    error_message TEXT
);

-- Enable RLS
ALTER TABLE public.system_cleanup_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Gestor Master can view cleanup logs" ON public.system_cleanup_logs;
DROP POLICY IF EXISTS "System can insert cleanup logs" ON public.system_cleanup_logs;

-- Re-create policies
CREATE POLICY "Gestor Master can view cleanup logs" 
ON public.system_cleanup_logs FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'gestor_master'));

-- Only the backend (service_role) should insert logs normally, 
-- but we allow service_role specifically or an internal call.
-- For the Edge Function to insert, it uses the service_role key.
CREATE POLICY "System can insert cleanup logs" 
ON public.system_cleanup_logs FOR INSERT 
WITH CHECK (true); -- Usually inserted via service_role which bypasses RLS, but explicit policy for clarity if needed

-- Add indexes for history performance
CREATE INDEX IF NOT EXISTS idx_system_cleanup_logs_created_at ON public.system_cleanup_logs(created_at DESC);
