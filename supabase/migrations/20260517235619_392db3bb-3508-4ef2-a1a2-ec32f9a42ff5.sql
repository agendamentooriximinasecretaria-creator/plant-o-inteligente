
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS shifts_created_by_fkey;
ALTER TABLE public.shifts ADD CONSTRAINT shifts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.system_settings DROP CONSTRAINT IF EXISTS system_settings_updated_by_fkey;
ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.system_monitoring_snapshots DROP CONSTRAINT IF EXISTS system_monitoring_snapshots_created_by_fkey;
ALTER TABLE public.system_monitoring_snapshots ADD CONSTRAINT system_monitoring_snapshots_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.system_monitoring_alerts DROP CONSTRAINT IF EXISTS system_monitoring_alerts_resolved_by_fkey;
ALTER TABLE public.system_monitoring_alerts ADD CONSTRAINT system_monitoring_alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.system_cleanup_logs DROP CONSTRAINT IF EXISTS system_cleanup_logs_created_by_fkey;
ALTER TABLE public.system_cleanup_logs ADD CONSTRAINT system_cleanup_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
