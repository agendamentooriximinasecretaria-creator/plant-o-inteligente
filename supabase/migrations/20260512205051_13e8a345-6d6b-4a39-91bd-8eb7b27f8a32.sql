-- Create tables for system monitoring
CREATE TABLE IF NOT EXISTS public.system_monitoring_snapshots (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    status_geral TEXT NOT NULL,
    db_status TEXT NOT NULL,
    storage_status TEXT NOT NULL,
    hosting_status TEXT NOT NULL,
    total_registros INTEGER,
    total_arquivos INTEGER,
    alertas_count INTEGER DEFAULT 0,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.system_monitoring_alerts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
    title TEXT NOT NULL,
    description TEXT,
    source TEXT,
    recommendation TEXT,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.system_cleanup_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    cleanup_type TEXT NOT NULL,
    items_count INTEGER DEFAULT 0,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS public.system_monitoring_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    hosting_type TEXT DEFAULT 'Lovable',
    public_url TEXT,
    api_url TEXT,
    coolify_url TEXT,
    monitoring_enabled BOOLEAN DEFAULT true,
    config JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.system_monitoring_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_cleanup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_monitoring_settings ENABLE ROW LEVEL SECURITY;

-- Create Policies (Master only)
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

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_monitoring_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_system_monitoring_settings_updated_at
BEFORE UPDATE ON public.system_monitoring_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_monitoring_settings_updated_at();

-- Function to get table sizes (needs to be created in public to be callable via RPC safely if permitted)
CREATE OR REPLACE FUNCTION public.get_system_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
    table_stats JSONB;
BEGIN
    -- Check if user is master
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'gestor_master') THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    -- Collect basic table counts
    SELECT jsonb_agg(t) INTO table_stats FROM (
        SELECT 
            relname as table_name, 
            n_live_tup as row_count,
            pg_size_pretty(pg_total_relation_size(relid)) as total_size
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
    ) t;

    result = jsonb_build_object(
        'timestamp', now(),
        'tables', table_stats,
        'db_version', version()
    );

    RETURN result;
END;
$$;
