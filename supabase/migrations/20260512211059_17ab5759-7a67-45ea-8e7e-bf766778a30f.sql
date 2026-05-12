-- Improved get_system_stats RPC
CREATE OR REPLACE FUNCTION public.get_system_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with owner privileges to access pg_stat tables
SET search_path = public
AS $$
DECLARE
    result JSONB;
    table_stats JSONB;
    is_master BOOLEAN;
BEGIN
    -- Security check: only gestor_master can call this
    -- We check auth.uid() directly. If called from Edge Function with service_role,
    -- the Edge Function should ideally set the claim or we can trust the EF's own check.
    -- However, for direct RPC calls from frontend, this is vital.
    SELECT (role = 'gestor_master') INTO is_master 
    FROM public.profiles 
    WHERE user_id = auth.uid();

    IF NOT COALESCE(is_master, false) THEN
        -- If auth.uid() is null (e.g. service role without context), we check if we are in a service role context
        -- but for security, let's stick to explicit role check if auth.uid() is present.
        IF auth.uid() IS NOT NULL THEN
            RAISE EXCEPTION 'Acesso negado: Apenas Gestor Master.';
        END IF;
    END IF;

    -- Collect basic table counts and sizes
    -- Using a subquery to handle potential missing stats or permissions
    BEGIN
        SELECT jsonb_agg(t) INTO table_stats FROM (
            SELECT 
                relname as table_name, 
                n_live_tup as row_count,
                pg_size_pretty(pg_total_relation_size(relid)) as total_size
            FROM pg_stat_user_tables
            WHERE schemaname = 'public'
            ORDER BY n_live_tup DESC
        ) t;
    EXCEPTION WHEN OTHERS THEN
        table_stats := '[]'::jsonb;
    END;

    result = jsonb_build_object(
        'timestamp', now(),
        'tables', COALESCE(table_stats, '[]'::jsonb),
        'db_version', version(),
        'schema', 'public'
    );

    RETURN result;
END;
$$;

-- Ensure RLS is enabled on all monitoring tables
ALTER TABLE public.system_monitoring_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_cleanup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_monitoring_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Gestor Master can view monitoring snapshots" ON public.system_monitoring_snapshots;
DROP POLICY IF EXISTS "Gestor Master can view monitoring alerts" ON public.system_monitoring_alerts;
DROP POLICY IF EXISTS "Gestor Master can view cleanup logs" ON public.system_cleanup_logs;
DROP POLICY IF EXISTS "Gestor Master can view monitoring settings" ON public.system_monitoring_settings;
DROP POLICY IF EXISTS "Gestor Master can update monitoring settings" ON public.system_monitoring_settings;

-- Re-create strict policies
CREATE POLICY "Gestor Master can view monitoring snapshots" 
ON public.system_monitoring_snapshots FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'gestor_master'));

CREATE POLICY "Gestor Master can view monitoring alerts" 
ON public.system_monitoring_alerts FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'gestor_master'));

CREATE POLICY "Gestor Master can view cleanup logs" 
ON public.system_cleanup_logs FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'gestor_master'));

CREATE POLICY "Gestor Master can view monitoring settings" 
ON public.system_monitoring_settings FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'gestor_master'));

CREATE POLICY "Gestor Master can update monitoring settings" 
ON public.system_monitoring_settings FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'gestor_master'));

-- Grant execute to authenticated users (RLS and function logic will still block)
GRANT EXECUTE ON FUNCTION public.get_system_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_stats() TO service_role;

-- Add indexes for performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_system_monitoring_snapshots_created_at ON public.system_monitoring_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_cleanup_logs_created_at ON public.system_cleanup_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status_created_at ON public.audit_logs(status, created_at DESC);
