INSERT INTO public.system_settings (key, value)
VALUES ('exibir_total_escala_consolidada', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;