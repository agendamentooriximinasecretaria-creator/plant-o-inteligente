
-- Create profiles and user_roles for existing users who don't have them
INSERT INTO public.user_roles (user_id, role)
SELECT '2e0a467a-8309-44f5-a94a-fc6d5cbc4f17', 'gestor_master'::app_role
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '2e0a467a-8309-44f5-a94a-fc6d5cbc4f17');

INSERT INTO public.profiles (user_id, email, nome, role, ativo)
SELECT '2e0a467a-8309-44f5-a94a-fc6d5cbc4f17', 'agendamentooriximinasecretaria@gmail.com', 'Gestor Master', 'gestor_master', true
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = '2e0a467a-8309-44f5-a94a-fc6d5cbc4f17');

INSERT INTO public.user_roles (user_id, role)
SELECT '81a732f5-abc7-4f22-bbaa-e6376c91f374', 'gestor_master'::app_role
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '81a732f5-abc7-4f22-bbaa-e6376c91f374');

INSERT INTO public.profiles (user_id, email, nome, role, ativo)
SELECT '81a732f5-abc7-4f22-bbaa-e6376c91f374', 'admin2311@gmail.com', 'Admin', 'gestor_master', true
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = '81a732f5-abc7-4f22-bbaa-e6376c91f374');

INSERT INTO public.user_roles (user_id, role)
SELECT '47eb675a-4247-4ab1-a482-aac5826dc261', 'gestor_master'::app_role
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '47eb675a-4247-4ab1-a482-aac5826dc261');

INSERT INTO public.profiles (user_id, email, nome, role, ativo)
SELECT '47eb675a-4247-4ab1-a482-aac5826dc261', 'artemiosouza99@gmail.com', 'Artemio', 'gestor_master', true
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = '47eb675a-4247-4ab1-a482-aac5826dc261');
